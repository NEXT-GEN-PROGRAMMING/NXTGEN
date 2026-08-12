import { type ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { commands } from "@/commands/handler.js";

export const data = new SlashCommandBuilder()
  .setName("help")
  .setDescription("List all available commands");

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("📖 NXTGEN Commands")
    .setDescription("Here are all the commands you can use:")
    .setFooter({ text: `${commands.size} commands available` })
    .setTimestamp();

  for (const [, command] of commands) {
    if ("description" in command.data) {
      embed.addFields({
        name: `/${command.data.name}`,
        value: command.data.description,
      });
    }
  }

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
