import { EmbedBuilder } from "discord.js";

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
}

/** Truncate PR body to a short preview */
function bodyPreview(body: string | null): string {
  if (!body || body.trim().length === 0) return "";
  const clean = body.replace(/\r\n/g, "\n").split("\n")[0] ?? "";
  return clean.length > 120 ? `${clean.slice(0, 120)}…` : clean;
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

/** Build the base embed with shared fields */
function baseEmbed(data: PREventData, color: number): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${data.draft ? "[DRAFT] " : ""}[#${data.prNumber}] ${data.title}`)
    .setURL(data.url)
    .setFooter({ text: data.repoFullName })
    .setTimestamp();

  const preview = bodyPreview(data.body);
  if (preview) {
    embed.addFields({ name: "Description", value: preview });
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
