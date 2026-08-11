import type { ChatInputCommandInteraction, MessageContextMenuCommandInteraction } from "discord.js";

export async function requireGuild(
  interaction: ChatInputCommandInteraction | MessageContextMenuCommandInteraction,
): Promise<string | null> {
  if (interaction.guildId) return interaction.guildId;

  await interaction.reply({
    content: "This command can only be used in a server.",
    ephemeral: true,
  });
  return null;
}
