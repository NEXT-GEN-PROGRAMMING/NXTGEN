import {
  ActionRowBuilder,
  ApplicationCommandType,
  ContextMenuCommandBuilder,
  type MessageContextMenuCommandInteraction,
  ModalBuilder,
  type ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { eq } from "drizzle-orm";
import { env } from "@/config/env.js";
import { db } from "@/core/database.js";
import { logger } from "@/core/logger.js";
import { createIssueCreatedEmbed } from "@/features/github/embeds/issue-embed.js";
import { githubUserLinks } from "@/features/github/schema.js";
import { sendEmbedToConfiguredChannels } from "@/features/github/services/announcer.js";
import { GitHubService } from "@/features/github/services/github.service.js";

export const data = new ContextMenuCommandBuilder()
  .setName("Report Bug")
  .setType(ApplicationCommandType.Message);

export function buildBugModal(messageId: string): ModalBuilder {
  const modal = new ModalBuilder().setCustomId(`bug_modal_${messageId}`).setTitle("Report Bug");

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("title")
        .setLabel("Title (e.g. [BUG]: ...)")
        .setStyle(TextInputStyle.Short)
        .setRequired(true),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("description")
        .setLabel("Describe the bug")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("reproduce")
        .setLabel("Steps to reproduce")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("expected")
        .setLabel("Expected behavior")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("environment")
        .setLabel("Environment (OS, Node version, etc.)")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true),
    ),
  );
  return modal;
}

export async function execute(interaction: MessageContextMenuCommandInteraction): Promise<void> {
  const [owner, repo] = (env.GITHUB_ISSUES_REPO ?? "").split("/");
  if (!owner || !repo) {
    await interaction.reply({
      content:
        "`GITHUB_ISSUES_REPO` must be set as `owner/repo` (e.g. `NEXT-GEN-PROGRAMMING/NXTGEN`).",
      ephemeral: true,
    });
    return;
  }

  const [link] = await db
    .select()
    .from(githubUserLinks)
    .where(eq(githubUserLinks.discordId, interaction.user.id));

  if (!link?.githubAccessToken) {
    await interaction.reply({
      content: "You must link your GitHub account first! Run /github-link to do so.",
      ephemeral: true,
    });
    return;
  }

  const modal = buildBugModal(interaction.targetMessage.id);
  await interaction.showModal(modal);
}

export async function handleBugModal(interaction: ModalSubmitInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const messageId = interaction.customId.replace("bug_modal_", "");
  const title = interaction.fields.getTextInputValue("title");
  const description = interaction.fields.getTextInputValue("description");
  const reproduce = interaction.fields.getTextInputValue("reproduce");
  const expected = interaction.fields.getTextInputValue("expected");
  const environment = interaction.fields.getTextInputValue("environment");

  const [owner, repo] = (env.GITHUB_ISSUES_REPO ?? "").split("/");

  const [link] = await db
    .select()
    .from(githubUserLinks)
    .where(eq(githubUserLinks.discordId, interaction.user.id));

  if (!link?.githubAccessToken) {
    await interaction.editReply({ content: "GitHub account not linked." });
    return;
  }

  let messageLink = "";
  let quotedContent = "";
  try {
    if (messageId !== "none" && interaction.channelId) {
      const channel = await interaction.client.channels.fetch(interaction.channelId);
      if (channel?.isTextBased()) {
        const msg = await channel.messages.fetch(messageId);
        const content = msg.content.trim();
        quotedContent = content.length > 0 ? `> ${content}\n\n` : "";
        messageLink = `\nhttps://discord.com/channels/${interaction.guildId}/${interaction.channelId}/${messageId}`;
      }
    }
  } catch (err) {
    logger.warn({ err }, "Failed to fetch original message for bug report");
  }

  const body = `**Describe the bug**
${description}

**To Reproduce**
${reproduce}

**Expected behavior**
${expected}

**Environment:**
${environment}

---
${quotedContent}Created from Discord by ${interaction.user.username}${messageLink}`;

  try {
    const service = new GitHubService(link.githubAccessToken);
    const issue = await service.createIssue(owner, repo, title, body);

    const embed = createIssueCreatedEmbed({
      issueNumber: issue.number,
      title,
      url: issue.url,
      repoFullName: `${owner}/${repo}`,
      authorTag: interaction.user.tag,
      authorAvatarUrl: interaction.user.displayAvatarURL(),
      messageLink,
    });

    await interaction.editReply({ content: `Bug report created: ${issue.url}` });
    await sendEmbedToConfiguredChannels(embed);
  } catch (error) {
    logger.error({ err: error }, "Failed to create GitHub issue");
    await interaction.editReply({
      content: "An error occurred while creating the issue.",
    });
  }
}
