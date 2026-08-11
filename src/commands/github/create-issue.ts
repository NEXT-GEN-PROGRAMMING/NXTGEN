import {
  ApplicationCommandType,
  ContextMenuCommandBuilder,
  EmbedBuilder,
  type MessageContextMenuCommandInteraction,
} from "discord.js";
import { eq } from "drizzle-orm";
import { db } from "@/core/database.js";
import { logger } from "@/core/logger.js";
import { parseRepoFullName } from "@/features/github/repo-name.js";
import { githubIssueConfigs } from "@/features/github/schema.js";
import { GitHubService } from "@/features/github/services/github.service.js";

const TITLE_MAX_LENGTH = 80;

export const data = new ContextMenuCommandBuilder()
  .setName("Create GitHub Issue")
  .setType(ApplicationCommandType.Message);

export async function execute(interaction: MessageContextMenuCommandInteraction): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({
      content: "This command can only be used in a server.",
      ephemeral: true,
    });
    return;
  }

  const messageContent = interaction.targetMessage.content?.trim();
  if (!messageContent) {
    await interaction.reply({
      content: "This message has no text content to create an issue from.",
      ephemeral: true,
    });
    return;
  }

  const config = await db
    .select({ repoFullName: githubIssueConfigs.repoFullName })
    .from(githubIssueConfigs)
    .where(eq(githubIssueConfigs.guildId, interaction.guildId))
    .limit(1);

  if (config.length === 0) {
    await interaction.reply({
      content: "No repository is configured for this server. Run `/issues-setup` first.",
      ephemeral: true,
    });
    return;
  }

  const parsedRepo = parseRepoFullName(config[0].repoFullName);
  if (!parsedRepo) {
    await interaction.reply({
      content: "The configured repository is invalid. Run `/issues-setup` again.",
      ephemeral: true,
    });
    return;
  }

  try {
    const firstLine = messageContent.split("\n")[0];
    const title =
      firstLine.length > TITLE_MAX_LENGTH
        ? `${firstLine.slice(0, TITLE_MAX_LENGTH - 1)}…`
        : firstLine;
    const author = interaction.targetMessage.author?.username ?? "unknown user";
    const body = `${messageContent}\n\n---\nFrom ${author} in ${
      interaction.guild?.name ?? "this server"
    } — ${interaction.targetMessage.url}`;

    const issue = await new GitHubService().createIssue(
      parsedRepo.owner,
      parsedRepo.repo,
      title,
      body,
    );

    const embed = new EmbedBuilder()
      .setColor(0x238636)
      .setTitle("🐛 GitHub Issue Created")
      .setDescription(
        `**[#${issue.number} ${title}](${issue.url})** created in \`${config[0].repoFullName}\`.`,
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
    logger.info(
      { guildId: interaction.guildId, issueNumber: issue.number, repo: config[0].repoFullName },
      "Created GitHub issue from Discord message",
    );
  } catch (_error) {
    await interaction.reply({
      content: "An error occurred while creating the issue. Please try again later.",
      ephemeral: true,
    });
  }
}
