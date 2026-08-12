import { EmbedBuilder } from "discord.js";
import type { CheckRunSummary, ReviewSummary } from "@/features/github/services/github.service.js";

export interface PREventData {
  prNumber: number;
  title: string;
  repoFullName: string;
  url: string;
  authorLogin: string;
  authorAvatarUrl: string;
  senderLogin: string;
  senderAvatarUrl: string;
  headBranch: string;
  baseBranch: string;
  headSha: string;
  commitCount: number;
  additions: number;
  deletions: number;
  changedFiles: number;
  draft: boolean;
  body: string | null;
  mergeCommitSha: string | null;
  mergedByLogin: string | null;
  checkSummary?: CheckRunSummary;
  reviewSummary?: ReviewSummary;
}

/** Discord limit: 1024 chars per field value */
const MAX_DESCRIPTION_CHARS = 1024;

// sentinel sentence list, not a full template parser, bodies from other repos without
// this template degrade to "unchecked boxes dropped", which still clears most PR-checklist noise
const TEMPLATE_NOISE = [
  "before submitting your pr",
  "please review the following checklist",
  "please include a summary of the changes",
  "fixes # (",
];

/** Keep checked boxes and real prose; drop unchecked tasks, images, and template instructions */
function cleanBody(body: string): string {
  const withoutImages = body.replace(/!\[[^\]]*\]\([^)]*\)/g, "");
  const lines = withoutImages.replace(/\r\n/g, "\n").split("\n");
  const kept = lines.filter((line) => {
    if (/^\s*-\s*\[\s\]/.test(line)) return false;
    const lower = line.trim().toLowerCase();
    return !TEMPLATE_NOISE.some((noise) => lower.startsWith(noise));
  });

  // Drop screenshot/embeds sections entirely; sub-headings stay inside the section,
  // only a heading at or above the section's level ends it
  const noScreenshots: string[] = [];
  let screenshotLevel = 0;
  for (const line of kept) {
    const heading = line.match(/^(#{1,6})\s+/);
    if (heading) {
      const level = heading[1].length;
      if (screenshotLevel > 0 && level <= screenshotLevel) {
        screenshotLevel = 0;
      } else if (screenshotLevel === 0 && /screenshot/i.test(line)) {
        screenshotLevel = level;
        continue;
      }
    }
    if (screenshotLevel === 0) noScreenshots.push(line);
  }

  // Drop headings orphaned when their section content was stripped
  const sections = noScreenshots.filter((line, i) => {
    if (!/^#{1,6}\s+/.test(line)) return true;
    const nextContent = noScreenshots.slice(i + 1).find((l) => l.trim() !== "");
    return nextContent !== undefined && !/^#{1,6}\s+/.test(nextContent.trim());
  });

  return sections
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Single Description field, truncated at Discord's field limit with a READ MORE link */
function descriptionField(
  body: string | null,
  prUrl: string,
): { name: string; value: string } | null {
  const clean = cleanBody(body ?? "");
  if (!clean) return null;

  const readMore = `… [READ MORE](${prUrl})`;
  let value = clean;
  if (clean.length > MAX_DESCRIPTION_CHARS) {
    const cut = Math.max(0, MAX_DESCRIPTION_CHARS - readMore.length - 1);
    if (cut > 0) {
      value = `${clean.slice(0, cut)}…${readMore}`;
    } else {
      // link can't fit (pathological URL length), plain truncation
      // keeps the 1024-char field invariant instead of a broken link
      value = `${clean.slice(0, MAX_DESCRIPTION_CHARS - 1)}…`;
    }
  }

  return { name: "Description", value };
}

/** Format branch and commit info line */
function branchLine(data: PREventData): string {
  const sha = data.headSha.slice(0, 7);
  return `\`${data.headBranch}\` → \`${data.baseBranch}\` @ [\`${sha}\`](${data.url}/commits/${data.headSha})`;
}

/** Format file stats line */
function statsLine(data: PREventData): string {
  return `\`+${data.additions} -${data.deletions}\` across ${data.changedFiles} file${data.changedFiles === 1 ? "" : "s"}`;
}

/** Format CI check status line */
function checksLine(data: PREventData): string | null {
  const checks = data.checkSummary;
  if (!checks || checks.total === 0) return null;

  const parts: string[] = [];
  if (checks.succeeded > 0) parts.push(`✅ \`${checks.succeeded}/${checks.total}\` checks passed`);
  if (checks.pending > 0) parts.push(`⏳ \`${checks.pending}\` pending`);
  if (checks.failed > 0) parts.push(`❌ \`${checks.failed}\` failed`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** Format review summary line */
function reviewsLine(data: PREventData): string | null {
  const reviews = data.reviewSummary;
  if (!reviews || reviews.total === 0) return null;

  const parts: string[] = [];
  if (reviews.approved > 0) parts.push(`✅ \`${reviews.approved}\` approved`);
  if (reviews.changesRequested > 0)
    parts.push(`🚧 \`${reviews.changesRequested}\` changes requested`);
  if (reviews.commented > 0) parts.push(`💬 \`${reviews.commented}\` commented`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** Build the base embed with shared fields */
function baseEmbed(data: PREventData, color: number): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${data.draft ? "[DRAFT] " : ""}[#${data.prNumber}] ${data.title}`)
    .setURL(data.url)
    .setFooter({ text: data.repoFullName })
    .setTimestamp();

  const description = descriptionField(data.body, data.url);
  if (description) {
    embed.addFields(description);
  }

  const checkLine = checksLine(data);
  if (checkLine) {
    embed.addFields({ name: "Checks", value: checkLine, inline: true });
  }

  const reviewLine = reviewsLine(data);
  if (reviewLine) {
    embed.addFields({ name: "Reviews", value: reviewLine, inline: true });
  }

  return embed;
}

export function createPROpenedEmbed(data: PREventData): EmbedBuilder {
  return baseEmbed(data, 0x238636)
    .setAuthor({ name: data.senderLogin, iconURL: data.senderAvatarUrl })
    .setDescription(
      [`**Opened** by **${data.senderLogin}**`, branchLine(data), statsLine(data)].join("\n"),
    );
}

export function createPRClosedEmbed(data: PREventData): EmbedBuilder {
  return baseEmbed(data, 0xda3633)
    .setAuthor({ name: data.senderLogin, iconURL: data.senderAvatarUrl })
    .setDescription(
      [
        `**Closed** by **${data.senderLogin}** without merging`,
        branchLine(data),
        statsLine(data),
      ].join("\n"),
    );
}

export function createPRMergedEmbed(data: PREventData): EmbedBuilder {
  const mergedBy = data.mergedByLogin ?? data.senderLogin;
  const mergeSha = data.mergeCommitSha ? data.mergeCommitSha.slice(0, 7) : "unknown";

  return baseEmbed(data, 0x8957e5)
    .setAuthor({ name: mergedBy, iconURL: data.senderAvatarUrl })
    .setDescription(
      [
        `**Merged** by **${mergedBy}** @ \`${mergeSha}\` · ${data.commitCount} commit${data.commitCount === 1 ? "" : "s"}`,
        branchLine(data),
        statsLine(data),
      ].join("\n"),
    );
}

export function createPRReviewRequestedEmbed(
  data: PREventData & { reviewer: string },
): EmbedBuilder {
  return baseEmbed(data, 0x3182ce)
    .setAuthor({ name: data.senderLogin, iconURL: data.senderAvatarUrl })
    .setDescription(
      [
        `**${data.senderLogin}** requested review from **${data.reviewer}**`,
        branchLine(data),
        statsLine(data),
      ].join("\n"),
    );
}

export function createPRLabeledEmbed(data: PREventData & { label: string }): EmbedBuilder {
  return baseEmbed(data, 0xd69e2e)
    .setAuthor({ name: data.senderLogin, iconURL: data.senderAvatarUrl })
    .setDescription(
      [`**${data.senderLogin}** added label **${data.label}**`, branchLine(data)].join("\n"),
    );
}

export function createPRSynchronizedEmbed(data: PREventData): EmbedBuilder {
  const embed = baseEmbed(data, 0x238636)
    .setAuthor({ name: data.senderLogin, iconURL: data.senderAvatarUrl })
    .setDescription(
      [`**Updated** by **${data.senderLogin}**`, branchLine(data), statsLine(data)].join("\n"),
    );

  // Add an explicit updated indicator to the footer
  const currentFooter = embed.data.footer?.text ?? data.repoFullName;
  embed.setFooter({ text: `${currentFooter} • 🔄 Updated just now` });

  return embed;
}
