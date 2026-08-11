import {
  ApplicationCommandType,
  ContextMenuCommandBuilder,
  type MessageContextMenuCommandInteraction,
} from "discord.js";
import { env } from "@/config/env.js";
import { logger } from "@/core/logger.js";
import { createIssueCreatedEmbed } from "@/features/github/embeds/issue-embed.js";
import { sendEmbedToConfiguredChannels } from "@/features/github/services/announcer.js";
import { GitHubService } from "@/features/github/services/github.service.js";

const MAX_TITLE_CHARS = 100;

export const data = new ContextMenuCommandBuilder()
  .setName("Create Issue")
  .setType(ApplicationCommandType.Message);

export async function execute(interaction: MessageContextMenuCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const repoFullName = env.GITHUB_ISSUES_REPO;
  if (!repoFullName) {
    await interaction.editReply({
      content:
        "GitHub issue repo is not configured — set `GITHUB_ISSUES_REPO` in the bot environment.",
    });
    return;
  }

  const [owner, repo] = repoFullName.split("/");
  if (!owner || !repo) {
    await interaction.editReply({
      content:
        "`GITHUB_ISSUES_REPO` must be set as `owner/repo` (e.g. `NEXT-GEN-PROGRAMMING/NXTGEN`).",
    });
    return;
  }

  if (!interaction.guildId) {
    await interaction.editReply({ content: "This action can only be used in a server." });
    return;
  }

  try {
    let target = interaction.targetMessage;
    if (target.partial) {
      target = await target.fetch();
    }

    const content = target.content.trim();
    const quotedContent = content.length > 0 ? `> ${content}\n\n` : "";
    const title =
      content.length === 0
        ? "Issue from Discord"
        : `${content.slice(0, MAX_TITLE_CHARS)}${content.length > MAX_TITLE_CHARS ? "…" : ""}`;
    const messageLink = `https://discord.com/channels/${interaction.guildId}/${target.channelId}/${target.id}`;
    const body =
      `${quotedContent}Created from Discord by ${interaction.user.username}\n${messageLink}`.trim();

    const service = new GitHubService();
    const issue = await service.createIssue(owner, repo, title, body);

    const embed = createIssueCreatedEmbed({
      issueNumber: issue.number,
      title,
      url: issue.url,
      repoFullName,
      authorTag: interaction.user.tag,
      authorAvatarUrl: interaction.user.displayAvatarURL(),
      messageLink,
    });

    await interaction.editReply({ content: `Issue created: ${issue.url}` });

    await sendEmbedToConfiguredChannels(embed);
  } catch (error) {
    logger.error({ err: error }, "Failed to create GitHub issue");
    await interaction.editReply({
      content: "An error occurred while creating the issue. Please try again later.",
    });
  }
}
