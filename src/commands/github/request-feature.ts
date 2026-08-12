import {
  ActionRowBuilder,
  ApplicationCommandType,
  ContextMenuCommandBuilder,
  type MessageContextMenuCommandInteraction,
  ModalBuilder,
  type ModalSubmitInteraction,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
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
  .setName("Request Feature")
  .setType(ApplicationCommandType.Message);

export function buildFeatureModal(messageId: string, repoFullName: string): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId(`feature_modal_${messageId}_${repoFullName}`)
    .setTitle("Request Feature");

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("title")
        .setLabel("Title (e.g. [FEATURE]: ...)")
        .setStyle(TextInputStyle.Short)
        .setRequired(true),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("problem")
        .setLabel("Problem Description")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("solution")
        .setLabel("Proposed Solution")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("alternatives")
        .setLabel("Alternatives Considered")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("context")
        .setLabel("Additional Context")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false),
    ),
  );
  return modal;
}

export async function sendFeatureRepoSelect(
  interaction: MessageContextMenuCommandInteraction | import("discord.js").ButtonInteraction,
  messageId: string,
  repos: string[],
): Promise<void> {
  const select = new StringSelectMenuBuilder()
    .setCustomId(`select_repo_feature_${messageId}`)
    .setPlaceholder("Select a repository")
    .addOptions(repos.map((r) => new StringSelectMenuOptionBuilder().setLabel(r).setValue(r)));

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

  if (interaction.isMessageContextMenuCommand()) {
    await interaction.reply({
      content: "Which repository would you like to request this feature in?",
      components: [row],
      ephemeral: true,
    });
  } else {
    await interaction.update({
      content: "Which repository would you like to request this feature in?",
      components: [row],
    });
  }
}

export async function execute(interaction: MessageContextMenuCommandInteraction): Promise<void> {
  const repos = (env.GITHUB_ISSUES_REPO ?? "")
    .split(",")
    .map((r) => r.trim())
    .filter((r) => r.length > 0);
  if (repos.length === 0) {
    await interaction.reply({
      content: "`GITHUB_ISSUES_REPO` must be set in your `.env` (e.g. `owner/repo1,owner/repo2`).",
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

  if (repos.length > 1) {
    await sendFeatureRepoSelect(interaction, interaction.targetMessage.id, repos);
  } else {
    const modal = buildFeatureModal(interaction.targetMessage.id, repos[0]);
    await interaction.showModal(modal);
  }
}

export async function handleFeatureModal(interaction: ModalSubmitInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const customIdParts = interaction.customId.split("_");
  const messageId = customIdParts[2];
  const repoFullName = customIdParts.slice(3).join("_"); // in case repo has underscores, though unlikely

  const [owner, repo] = repoFullName.split("/");

  const title = interaction.fields.getTextInputValue("title");
  const problem = interaction.fields.getTextInputValue("problem");
  const solution = interaction.fields.getTextInputValue("solution");

  let alternatives = "";
  try {
    alternatives = interaction.fields.getTextInputValue("alternatives");
  } catch {}

  let contextInfo = "";
  try {
    contextInfo = interaction.fields.getTextInputValue("context");
  } catch {}

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
    logger.warn({ err }, "Failed to fetch original message for feature request");
  }

  const body = `**Is your feature request related to a problem? Please describe.**
${problem}

**Describe the solution you'd like**
${solution}

**Describe alternatives you've considered**
${alternatives || "*None*"}

**Additional context**
${contextInfo || "*None*"}

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
      body,
    });

    await interaction.editReply({ content: `Feature request created: ${issue.url}` });
    await sendEmbedToConfiguredChannels(embed);
  } catch (error) {
    logger.error({ err: error }, "Failed to create GitHub issue");
    await interaction.editReply({
      content: "An error occurred while creating the issue.",
    });
  }
}
