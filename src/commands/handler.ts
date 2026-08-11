import { Collection, REST, Routes } from "discord.js";
// Import all commands here
import * as createIssue from "@/commands/github/create-issue.js";
import * as prLink from "@/commands/github/pr-link.js";
import * as prSearch from "@/commands/github/pr-search.js";
import * as prStats from "@/commands/github/pr-stats.js";
import * as githubSetup from "@/commands/github/setup.js";
import * as help from "@/commands/help.js";
import type { Command, MessageCommand } from "@/commands/types.js";
import { env } from "@/config/env.js";
import { logger } from "@/core/logger.js";

// Command registry
export const commands = new Collection<string, Command>();
export const messageCommands = new Collection<string, MessageCommand>();

// Register each command in the collection
const allCommands: Command[] = [githubSetup, prLink, prSearch, prStats, help];
const allMessageCommands: MessageCommand[] = [createIssue];

for (const command of allCommands) {
  commands.set(command.data.name, command);
}

for (const command of allMessageCommands) {
  messageCommands.set(command.data.name, command);
}

/**
 * Registers all commands (slash and message context menu) with the Discord API.
 *
 * - If DISCORD_GUILD_ID is set, registers as guild commands (instant update).
 * - Otherwise, registers as global commands (can take up to 1 hour to propagate).
 */
export async function registerCommands(): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(env.DISCORD_TOKEN);
  const commandData = [...allCommands, ...allMessageCommands].map((cmd) => cmd.data.toJSON());

  try {
    if (env.DISCORD_GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DISCORD_GUILD_ID), {
        body: commandData,
      });
      logger.info(
        { count: commandData.length, guildId: env.DISCORD_GUILD_ID },
        "✅ Registered guild commands",
      );
    } else {
      await rest.put(Routes.applicationCommands(env.DISCORD_CLIENT_ID), {
        body: commandData,
      });
      logger.info({ count: commandData.length }, "✅ Registered global commands");
    }
  } catch (error) {
    logger.error({ err: error }, "❌ Failed to register commands");
  }
}
