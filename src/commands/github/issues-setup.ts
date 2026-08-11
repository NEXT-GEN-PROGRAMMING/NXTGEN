import {
  type ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { requireGuild } from "@/commands/guards.js";
import { db } from "@/core/database.js";
import { logger } from "@/core/logger.js";
import { parseRepoFullName } from "@/features/github/repo-name.js";
import { githubIssueConfigs } from "@/features/github/schema.js";

export const data = new SlashCommandBuilder()
  .setName("issues-setup")
  .setDescription("Configure the GitHub repository for creating issues")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((option) =>
    option
      .setName("repo")
      .setDescription("Repository to create issues in, in the format owner/repo")
      .setRequired(true),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = await requireGuild(interaction);
  if (!guildId) return;

  const repo = interaction.options.getString("repo", true);
  const parsedRepo = parseRepoFullName(repo);
  if (!parsedRepo) {
    await interaction.reply({
      content: "Repository must be in the format `owner/repo` following GitHub naming rules.",
      ephemeral: true,
    });
    return;
  }

  const repoFullName = `${parsedRepo.owner}/${parsedRepo.repo}`;

  try {
    await db
      .insert(githubIssueConfigs)
      .values({
        guildId,
        repoFullName,
      })
      .onConflictDoUpdate({
        target: githubIssueConfigs.guildId,
        set: {
          repoFullName,
          updatedAt: new Date(),
        },
      });

    const embed = new EmbedBuilder()
      .setColor(0x238636)
      .setTitle("GitHub Issues Configured")
      .setDescription(
        `Issues created from messages will target **\`${repoFullName}\`**. Use the **Create GitHub Issue** context menu on any message.`,
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
    logger.info({ guildId, repo: repoFullName }, "Configured GitHub issues repository");
  } catch (error) {
    logger.error(
      { err: error, guildId, repo: repoFullName },
      "Failed to configure GitHub issues repository",
    );
    await interaction.reply({
      content: "An error occurred while configuring the repository. Please try again later.",
      ephemeral: true,
    });
  }
}
