import { Events } from "discord.js";
import { commands } from "@/commands/handler.js";
import type { Command, MessageCommand } from "@/commands/types.js";
import { env } from "@/config/env.js";
import { client } from "@/core/client.js";
import { logger } from "@/core/logger.js";

client.once(Events.ClientReady, (c) => {
  logger.info(`🤖 Bot is online! Logged in as ${c.user.tag}`);
});

// Route incoming slash command and message context menu interactions to their handlers
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand() && !interaction.isMessageContextMenuCommand()) {
    return;
  }

  const command = commands.get(interaction.commandName);

  if (!command) {
    logger.warn({ commandName: interaction.commandName }, "Unknown command received");
    return;
  }

  try {
    if (interaction.isChatInputCommand()) {
      await (command as Command).execute(interaction);
    } else {
      await (command as MessageCommand).execute(interaction);
    }
  } catch (error) {
    logger.error({ err: error, commandName: interaction.commandName }, "Command execution failed");

    const reply = {
      content: "There was an error while executing this command.",
      ephemeral: true,
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply);
    } else {
      await interaction.reply(reply);
    }
  }
});

export async function startBot() {
  try {
    await client.login(env.DISCORD_TOKEN);
  } catch (error) {
    logger.fatal({ err: error }, "❌ Failed to start Discord bot");
    process.exit(1);
  }
}
