import { type ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { env } from "@/config/env.js";
import { db } from "@/core/database.js";
import { githubOauthStates } from "@/features/github/schema.js";

export const data = new SlashCommandBuilder()
  .setName("pr-link")
  .setDescription("Link your Discord account to GitHub via OAuth");

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const discordId = interaction.user.id;

  if (!env.GITHUB_CLIENT_ID || !env.PUBLIC_URL) {
    await interaction.reply({
      content:
        "OAuth is not configured on this bot. Please set GITHUB_CLIENT_ID and PUBLIC_URL in the .env file.",
      ephemeral: true,
    });
    return;
  }

  try {
    // Generate a random UUID for the OAuth state to prevent CSRF
    const state = crypto.randomUUID();

    await db.insert(githubOauthStates).values({
      state,
      discordId,
    });

    const redirectUri = `${env.PUBLIC_URL}/auth/github/callback`;
    const oauthUrl = `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=repo`;

    const embed = new EmbedBuilder()
      .setColor(0x58a6ff)
      .setTitle("🔗 Link GitHub Account")
      .setDescription(
        `Click the link below to securely link your GitHub account.\n\n[**Authorize GitHub**](${oauthUrl})`,
      )
      .setFooter({ text: "This link will expire soon and is unique to you." });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (_error) {
    await interaction.reply({
      content: "An error occurred while generating your OAuth link.",
      ephemeral: true,
    });
  }
}
