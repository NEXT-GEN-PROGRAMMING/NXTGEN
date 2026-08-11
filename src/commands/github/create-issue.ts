import {
  ApplicationCommandType,
  ContextMenuCommandBuilder,
  EmbedBuilder,
  type MessageContextMenuCommandInteraction,
  PermissionFlagsBits,
} from "discord.js";
import { eq } from "drizzle-orm";
import { requireGuild } from "@/commands/guards.js";
import { db } from "@/core/database.js";
import { logger } from "@/core/logger.js";
import { parseRepoFullName } from "@/features/github/repo-name.js";
import { githubIssueConfigs } from "@/features/github/schema.js";
import { GitHubService } from "@/features/github/services/github.service.js";

const TITLE_MAX_LENGTH = 256;

export const data = new ContextMenuCommandBuilder()
  .setName("Create GitHub Issue")
  .setType(ApplicationCommandType.Message)
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function execute(interaction: MessageContextMenuCommandInteraction): Promise<void> {
  const guildId = await requireGuild(interaction);
  if (!guildId) return;

  const messageContent = interaction.targetMessage.content?.trim();
  if (!messageContent) {
    await interaction.reply({
      content: "This message has no text content to create an issue from.",
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const config = await db
      .select({ repoFullName: githubIssueConfigs.repoFullName })
      .from(githubIssueConfigs)
      .where(eq(githubIssueConfigs.guildId, guildId))
      .limit(1);

    if (config.length === 0) {
      await interaction.editReply({
        content: "No repository is configured for this server. Run `/issues-setup` first.",
      });
      return;
    }

    // ponytail: only /issues-setup (validated) writes this table, so the stored value is always parseable.
    const { owner, repo } = parseRepoFullName(config[0].repoFullName)!;

    const firstLine = messageContent.split("\n")[0];
    const titleCodePoints = Array.from(firstLine);
    const title =
      titleCodePoints.length > TITLE_MAX_LENGTH
        ? `${titleCodePoints.slice(0, TITLE_MAX_LENGTH - 1).join("")}…`
        : firstLine;
    const author = interaction.targetMessage.author?.username ?? "unknown user";
    const body = `${messageContent}\n\n---\nFrom ${author} in ${
      interaction.guild?.name ?? "this server"
    } — ${interaction.targetMessage.url}`;

    const issue = await new GitHubService().createIssue(owner, repo, title, body);

    const embed = new EmbedBuilder()
      .setColor(0x238636)
      .setTitle("🐛 GitHub Issue Created")
      .setDescription(
        `**[#${issue.number} ${title}](${issue.url})** created in \`${config[0].repoFullName}\`.`,
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    logger.info(
      { guildId, issueNumber: issue.number, repo: config[0].repoFullName },
      "Created GitHub issue from Discord message",
    );
  } catch (error) {
    logger.error({ err: error, guildId }, "Failed to create GitHub issue from Discord message");
    await interaction.editReply({
      content: "An error occurred while creating the issue. Please try again later.",
    });
  }
}
