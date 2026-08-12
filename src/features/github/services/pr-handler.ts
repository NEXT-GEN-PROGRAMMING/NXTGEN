import type { EmbedBuilder, TextChannel } from "discord.js";
import { and, eq } from "drizzle-orm";
import { client } from "@/core/client.js";
import { db } from "@/core/database.js";
import { logger } from "@/core/logger.js";
import {
  createPRClosedEmbed,
  createPRLabeledEmbed,
  createPRMergedEmbed,
  createPROpenedEmbed,
  createPRReviewRequestedEmbed,
  createPRSynchronizedEmbed,
  type PREventData,
} from "@/features/github/embeds/pr-embed.js";

import { githubPrMessages, githubPullRequests } from "@/features/github/schema.js";
import { sendEmbedToConfiguredChannels } from "@/features/github/services/announcer.js";

import {
  type CheckRunSummary,
  GitHubService,
  type ReviewSummary,
} from "@/features/github/services/github.service.js";

interface EnrichedPRData {
  checks: CheckRunSummary;
  reviews: ReviewSummary;
}

export interface GitHubPRWebhookPayload {
  action: string;
  number: number;
  sender: {
    login: string;
    avatar_url: string;
  };
  pull_request: {
    title: string;
    body: string | null;
    html_url: string;
    state: string;
    draft: boolean;
    merged: boolean;
    additions: number;
    deletions: number;
    changed_files: number;
    commits: number;
    head: {
      ref: string;
      sha: string;
    };
    base: {
      ref: string;
    };
    merge_commit_sha: string | null;
    merged_by: {
      login: string;
    } | null;
    user: {
      login: string;
      avatar_url: string;
    };
    labels: Array<{ name: string }>;
    requested_reviewers: Array<{ login: string }>;
  };
  repository: {
    full_name: string;
  };
  label?: {
    name: string;
  };
  requested_reviewer?: {
    login: string;
  };
}

// ponytail: enrichment is best-effort — the webhook payload already has enough to ship the embed,
// so an Octokit failure (rate limit, missing perms) logs and falls back to raw webhook data
async function enrichPullRequest(
  owner: string,
  repo: string,
  event: GitHubPRWebhookPayload,
): Promise<EnrichedPRData | null> {
  try {
    const service = new GitHubService();
    const [checks, reviews] = await Promise.all([
      service.getCheckRuns(owner, repo, event.pull_request.head.sha),
      service.getReviews(owner, repo, event.number),
    ]);
    return { checks, reviews };
  } catch (error) {
    logger.warn(
      { err: error, pr: event.number, repo: event.repository.full_name },
      "GitHub enrichment failed, using raw webhook data",
    );
    return null;
  }
}

export async function handlePullRequestEvent(event: GitHubPRWebhookPayload): Promise<void> {
  logger.info(
    { action: event.action, pr: event.number, repo: event.repository.full_name },
    "Handling PR event",
  );

  const pr = event.pull_request;
  const [owner, repo] = event.repository.full_name.split("/");
  const enrichment = await enrichPullRequest(owner, repo, event);

  const prData: PREventData = {
    prNumber: event.number,
    title: pr.title,
    repoFullName: event.repository.full_name,
    url: pr.html_url,
    authorLogin: pr.user.login,
    authorAvatarUrl: pr.user.avatar_url,
    senderLogin: event.sender.login,
    senderAvatarUrl: event.sender.avatar_url,
    headBranch: pr.head.ref,
    baseBranch: pr.base.ref,
    headSha: pr.head.sha,
    commitCount: pr.commits,
    additions: pr.additions,
    deletions: pr.deletions,
    changedFiles: pr.changed_files,
    draft: pr.draft,
    body: pr.body,
    mergeCommitSha: pr.merge_commit_sha,
    mergedByLogin: pr.merged_by?.login ?? null,
    checkSummary: enrichment?.checks,
    reviewSummary: enrichment?.reviews,
  };

  try {
    await db
      .insert(githubPullRequests)
      .values({
        prNumber: prData.prNumber,
        repoFullName: prData.repoFullName,
        title: prData.title,
        authorLogin: prData.authorLogin,
        authorAvatarUrl: prData.authorAvatarUrl,
        state: pr.merged ? "merged" : pr.state,
        url: prData.url,
        isDraft: prData.draft,
        headSha: prData.headSha,
        mergeCommitSha: prData.mergeCommitSha,
      })
      .onConflictDoUpdate({
        target: [githubPullRequests.prNumber, githubPullRequests.repoFullName],
        set: {
          title: prData.title,
          authorLogin: prData.authorLogin,
          authorAvatarUrl: prData.authorAvatarUrl,
          state: pr.merged ? "merged" : pr.state,
          url: prData.url,
          isDraft: prData.draft,
          headSha: prData.headSha,
          mergeCommitSha: prData.mergeCommitSha,
          updatedAt: new Date(),
        },
      });
    logger.info("Upserted PR data to database");
  } catch (err) {
    logger.error(err, "Failed to upsert PR data");
  }

  let embed: EmbedBuilder | null = null;

  switch (event.action) {
    case "opened":
      embed = createPROpenedEmbed(prData);
      break;
    case "closed":
      if (pr.merged) {
        embed = createPRMergedEmbed(prData);
      } else {
        embed = createPRClosedEmbed(prData);
      }
      break;
    case "review_requested":
      if (event.requested_reviewer) {
        embed = createPRReviewRequestedEmbed({
          ...prData,
          reviewer: event.requested_reviewer.login,
        });
      }
      break;
    case "labeled":
      if (event.label) {
        embed = createPRLabeledEmbed({ ...prData, label: event.label.name });
      }
      break;
    case "synchronize":
      embed = createPRSynchronizedEmbed(prData);
      break;
    default:
      logger.debug({ action: event.action }, "Unhandled PR action");
      return;
  }

  if (!embed) return;

  if (event.action === "synchronize") {
    // Find all previously sent messages for this PR
    const messages = await db
      .select()
      .from(githubPrMessages)
      .where(
        and(
          eq(githubPrMessages.prNumber, prData.prNumber),
          eq(githubPrMessages.repoFullName, prData.repoFullName),
        ),
      );

    logger.info({ messageCount: messages.length }, "Updating existing PR embeds for synchronize");

    for (const msg of messages) {
      try {
        const channel = (await client.channels.fetch(msg.channelId)) as TextChannel | null;
        if (channel?.isTextBased()) {
          const discordMsg = await channel.messages.fetch(msg.messageId);
          if (discordMsg) {
            await discordMsg.edit({ embeds: [embed] });
          }
        }
      } catch (err) {
        logger.error(
          { err, channelId: msg.channelId, messageId: msg.messageId },
          "Failed to edit embed for synchronize",
        );
      }
    }
    return;
  }

  await sendEmbedToConfiguredChannels(embed, {
    prNumber: prData.prNumber,
    repoFullName: prData.repoFullName,
  });
}
