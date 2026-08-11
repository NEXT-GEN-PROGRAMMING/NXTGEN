import crypto from "node:crypto";
import {
  type ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import { eq } from "drizzle-orm";
import { env } from "@/config/env.js";
import { db } from "@/core/database.js";
import { logger } from "@/core/logger.js";
import { githubOauthStates, githubUserLinks } from "@/features/github/schema.js";

export const data = new SlashCommandBuilder()
  .setName("github-link")
  .setDescription("Link your Discord account to GitHub via OAuth");

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const discordId = interaction.user.id;

  if (!env.GITHUB_CLIENT_ID || !env.PUBLIC_URL) {
    await interaction.reply({
      content:
        "OAuth is not configured on this bot. Please set GITHUB_CLIENT_ID and PUBLIC_URL in the .env file.",
      flags: MessageFlags.Ephemeral,
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

    // Check if the user is already linked
    const [existingLink] = await db
      .select()
      .from(githubUserLinks)
      .where(eq(githubUserLinks.discordId, discordId))
      .limit(1);

    const redirectUri = `${env.PUBLIC_URL}/auth/github/callback`;
    const oauthUrl = `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=repo`;

    const embed = new EmbedBuilder().setColor(0x58a6ff).setTitle("🔗 Link GitHub Account");

    if (existingLink) {
      embed.setDescription(
        `✅ Your account is already linked to GitHub as **${existingLink.githubUsername}**.\n\nIf you want to switch accounts, you can [**Re-authorize GitHub**](${oauthUrl}).`,
      );
    } else {
      embed.setDescription(
        `Click the link below to securely link your GitHub account.\n\n[**Authorize GitHub**](${oauthUrl})`,
      );
    }

    embed.setFooter({ text: "This link will expire soon and is unique to you." });

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  } catch (error) {
    logger.error({ err: error }, "Failed to generate OAuth link in /github-link");
    await interaction.reply({
      content: "An error occurred while generating your OAuth link.",
      flags: MessageFlags.Ephemeral,
    });
  }
}
