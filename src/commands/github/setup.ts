import {
  ChannelType,
  type ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type TextChannel,
} from "discord.js";
import { requireGuild } from "@/commands/guards.js";
import { db } from "@/core/database.js";
import { logger } from "@/core/logger.js";
import { githubWebhookConfigs } from "@/features/github/schema.js";

export const data = new SlashCommandBuilder()
  .setName("github-setup")
  .setDescription("Configure the channel for GitHub PR notifications")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addChannelOption((option) =>
    option
      .setName("channel")
      .setDescription("The channel to receive GitHub PR notifications")
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = await requireGuild(interaction);
  if (!guildId) return;

  const channel = interaction.options.getChannel("channel", true) as TextChannel;

  try {
    await db
      .insert(githubWebhookConfigs)
      .values({
        guildId,
        channelId: channel.id,
      })
      .onConflictDoUpdate({
        target: githubWebhookConfigs.guildId,
        set: {
          channelId: channel.id,
          updatedAt: new Date(),
        },
      });

    const embed = new EmbedBuilder()
      .setColor(0x238636)
      .setTitle("GitHub Webhook Configured")
      .setDescription(`Successfully configured ${channel} to receive GitHub PR notifications.`)
      .addFields({
        name: "Next Steps",
        value:
          "1. Go to your GitHub repository settings\n2. Navigate to Webhooks -> Add webhook\n3. Set Payload URL to your bot's endpoint\n4. Set Content type to `application/json`\n5. Select 'Let me select individual events' and choose 'Pull requests'\n6. Save the webhook",
      })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
    logger.info({ guildId, channelId: channel.id }, "Configured GitHub webhook channel");
  } catch (error) {
    logger.error(error, "Failed to configure GitHub webhook channel");
    await interaction.reply({
      content: "An error occurred while configuring the webhook channel. Please try again later.",
      ephemeral: true,
    });
  }
}
