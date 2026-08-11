import { Client, Events, GatewayIntentBits } from "discord.js";
import { commands, messageCommands } from "@/commands/handler.js";
import type { Command, MessageCommand } from "@/commands/types.js";
import { env } from "@/config/env.js";
import { logger } from "@/core/logger.js";

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once(Events.ClientReady, (c) => {
  logger.info(`🤖 Bot is online! Logged in as ${c.user.tag}`);
});

// Route incoming slash command and message context menu interactions to their handlers
client.on(Events.InteractionCreate, async (interaction) => {
  let command: Command | MessageCommand | undefined;
  if (interaction.isChatInputCommand()) {
    command = commands.get(interaction.commandName);
  } else if (interaction.isMessageContextMenuCommand()) {
    command = messageCommands.get(interaction.commandName);
  } else {
    return;
  }

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
