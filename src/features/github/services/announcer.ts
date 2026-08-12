import type { EmbedBuilder, TextChannel } from "discord.js";
import { client } from "@/core/client.js";
import { db } from "@/core/database.js";
import { logger } from "@/core/logger.js";
import { githubPrMessages, githubWebhookConfigs } from "@/features/github/schema.js";

/**
 * Sends an embed to every channel configured via `/github-setup` and tracks
 * sent PR messages so synchronize events can edit them in place.
 * Never throws: config failures and per-channel failures are logged and skipped.
 */
export async function sendEmbedToConfiguredChannels(
  embed: EmbedBuilder,
  pr?: { prNumber: number; repoFullName: string },
): Promise<void> {
  try {
    const configs = await db.select().from(githubWebhookConfigs);
    logger.info({ configCount: configs.length }, "Sending embed to configured channels");

    for (const config of configs) {
      try {
        const channel = (await client.channels.fetch(config.channelId)) as TextChannel | null;
        if (channel?.isTextBased()) {
          const sentMsg = await channel.send({ embeds: [embed] });

          if (pr) {
            await db
              .insert(githubPrMessages)
              .values({
                prNumber: pr.prNumber,
                repoFullName: pr.repoFullName,
                channelId: config.channelId,
                messageId: sentMsg.id,
              })
              .onConflictDoUpdate({
                target: [
                  githubPrMessages.prNumber,
                  githubPrMessages.repoFullName,
                  githubPrMessages.channelId,
                ],
                set: {
                  messageId: sentMsg.id,
                  updatedAt: new Date(),
                },
              });
          }
        }
      } catch (err) {
        logger.error({ err, channelId: config.channelId }, "Failed to send embed to channel");
      }
    }
  } catch (err) {
    logger.error({ err }, "Failed to load webhook configs; skipping announcement");
  }
}
