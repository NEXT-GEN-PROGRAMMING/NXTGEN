import type { EmbedBuilder, TextChannel } from "discord.js";
import { client } from "@/core/bot.js";
import { db } from "@/core/database.js";
import { logger } from "@/core/logger.js";
import { githubWebhookConfigs } from "@/features/github/schema.js";

/**
 * Sends an embed to every channel configured via `/github-setup`.
 * Per-channel failures are logged and skipped.
 */
export async function sendEmbedToConfiguredChannels(embed: EmbedBuilder): Promise<void> {
  const configs = await db.select().from(githubWebhookConfigs);
  logger.info({ configCount: configs.length }, "Sending embed to configured channels");

  for (const config of configs) {
    try {
      const channel = (await client.channels.fetch(config.channelId)) as TextChannel | null;
      if (channel?.isTextBased()) {
        await channel.send({ embeds: [embed] });
      }
    } catch (err) {
      logger.error({ err, channelId: config.channelId }, "Failed to send embed to channel");
    }
  }
}
