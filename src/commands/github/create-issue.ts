import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";
import { env } from "@/config/env.js";

export const data = new SlashCommandBuilder()
  .setName("create-issue")
  .setDescription("Create a new GitHub issue directly from Discord");

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const [owner, repo] = (env.GITHUB_ISSUES_REPO ?? "").split("/");
  if (!owner || !repo) {
    await interaction.reply({
      content:
        "`GITHUB_ISSUES_REPO` must be set as `owner/repo` (e.g. `NEXT-GEN-PROGRAMMING/NXTGEN`).",
      ephemeral: true,
    });
    return;
  }

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("btn_bug_modal_none")
      .setLabel("🐛 Report Bug")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("btn_feature_modal_none")
      .setLabel("✨ Request Feature")
      .setStyle(ButtonStyle.Success),
  );

  await interaction.reply({
    content: "What kind of issue would you like to create?",
    components: [row],
    ephemeral: true,
  });
}
