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

/** Discord limits: 1024 chars per field value, 6000 chars per embed */
const MAX_FIELD_CHARS = 1024;
const MAX_BODY_CHARS = 5000; // leaves room under the 6000 embed budget

/** Render the full PR body as embed fields, chunked at Discord's per-field limit */
function bodyFields(body: string | null): { name: string; value: string }[] {
  if (!body || body.trim().length === 0) return [];

  const chunks: string[] = [];
  let current = "";

  for (let line of body.replace(/\r\n/g, "\n").split("\n")) {
    // Hard-slice any single line that alone exceeds the field limit
    while (line.length > MAX_FIELD_CHARS) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      chunks.push(line.slice(0, MAX_FIELD_CHARS));
      line = line.slice(MAX_FIELD_CHARS);
    }

    const next = current ? `${current}\n${line}` : line;
    if (next.length > MAX_FIELD_CHARS) {
      chunks.push(current);
      current = line;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);

  const fields: { name: string; value: string }[] = [];
  let total = 0;
  for (const chunk of chunks) {
    const remaining = MAX_BODY_CHARS - total;
    if (remaining <= 0) break;
    const value = chunk.length > remaining ? `${chunk.slice(0, remaining - 1)}…` : chunk;
    fields.push({
      name: fields.length === 0 ? "Description" : `Description (part ${fields.length + 1})`,
      value,
    });
    total += value.length;
  }
  return fields;
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

  for (const field of bodyFields(data.body)) {
    embed.addFields(field);
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
