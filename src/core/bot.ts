import { Client, Events, GatewayIntentBits } from "discord.js";
import { commands } from "@/commands/handler.js";
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

// Route incoming slash command interactions to their handlers
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);

  if (!command) {
    logger.warn({ commandName: interaction.commandName }, "Unknown command received");
    return;
  }

  try {
    await command.execute(interaction);
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
