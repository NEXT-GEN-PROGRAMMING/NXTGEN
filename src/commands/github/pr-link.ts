import { type ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { db } from "@/core/database.js";
import { githubUserLinks } from "@/features/github/schema.js";

export const data = new SlashCommandBuilder()
  .setName("pr-link")
  .setDescription("Link your Discord account to your GitHub username")
  .addStringOption((option) =>
    option
      .setName("github_username")
      .setDescription("Your exact GitHub username")
      .setRequired(true),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const githubUsername = interaction.options.getString("github_username", true);
  const discordId = interaction.user.id;

  try {
    await db
      .insert(githubUserLinks)
      .values({
        discordId,
        githubUsername,
      })
      .onConflictDoUpdate({
        target: githubUserLinks.discordId,
        set: {
          githubUsername,
          updatedAt: new Date(),
        },
      });

    const embed = new EmbedBuilder()
      .setColor(0x58a6ff)
      .setTitle("🔗 Accounts Linked!")
      .setDescription(
        `Your Discord account is now linked to GitHub user **${githubUsername}**.\nYou can now be @mentioned in \`/pr-stats\` and \`/pr-search\`!`,
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (_error) {
    await interaction.reply({
      content: "An error occurred while linking your account.",
      ephemeral: true,
    });
  }
}
