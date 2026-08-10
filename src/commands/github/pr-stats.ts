import { type ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { count, desc, eq, ilike } from "drizzle-orm";
import { db } from "@/core/database.js";
import { githubPullRequests, githubUserLinks } from "@/features/github/schema.js";

export const data = new SlashCommandBuilder()
  .setName("pr-stats")
  .setDescription("View PR statistics and leaderboards")
  .addStringOption((option) =>
    option.setName("username").setDescription("Specific GitHub username to look up"),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const username = interaction.options.getString("username");

  try {
    if (username) {
      let searchUsername = username;
      const mentionMatch = username.match(/^<@!?(\d+)>$/);
      if (mentionMatch) {
        const discordId = mentionMatch[1];
        const link = await db
          .select({ githubUsername: githubUserLinks.githubUsername })
          .from(githubUserLinks)
          .where(eq(githubUserLinks.discordId, discordId))
          .limit(1);

        if (link.length === 0) {
          await interaction.reply({
            content: `That user hasn't linked their GitHub account yet! Tell them to run \`/pr-link <github_username>\`.`,
            ephemeral: true,
          });
          return;
        }
        searchUsername = link[0].githubUsername;
      }

      // Single user stats
      const results = await db
        .select({
          state: githubPullRequests.state,
          isDraft: githubPullRequests.isDraft,
          mergeCommitSha: githubPullRequests.mergeCommitSha,
          total: count(),
        })
        .from(githubPullRequests)
        .where(ilike(githubPullRequests.authorLogin, searchUsername))
        .groupBy(
          githubPullRequests.state,
          githubPullRequests.isDraft,
          githubPullRequests.mergeCommitSha,
        );

      if (results.length === 0) {
        await interaction.reply({
          content: `No pull requests found for user \`${searchUsername}\`.`,
          ephemeral: true,
        });
        return;
      }

      let draft = 0;
      let open = 0;
      let merged = 0;
      let closed = 0;
      let total = 0;

      for (const row of results) {
        total += row.total;
        if (row.state === "open") {
          if (row.isDraft) draft += row.total;
          else open += row.total;
        } else {
          if (row.mergeCommitSha) merged += row.total;
          else closed += row.total;
        }
      }

      const embed = new EmbedBuilder()
        .setColor(0x238636)
        .setTitle(`📊 PR Stats: ${searchUsername}`)
        .addFields(
          { name: "Total PRs", value: `\`${total}\``, inline: true },
          { name: "Draft", value: `\`${draft}\``, inline: true },
          { name: "Open", value: `\`${open}\``, inline: true },
          { name: "Merged", value: `\`${merged}\``, inline: true },
          { name: "Closed", value: `\`${closed}\``, inline: true },
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      return;
    }

    // Leaderboard
    const results = await db
      .select({
        author: githubPullRequests.authorLogin,
        total: count(),
      })
      .from(githubPullRequests)
      .groupBy(githubPullRequests.authorLogin)
      .orderBy(desc(count()))
      .limit(5);

    if (results.length === 0) {
      await interaction.reply({
        content: "No PRs found in the database yet.",
        ephemeral: true,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xebdf00)
      .setTitle("🏆 PR Leaderboard")
      .setDescription(
        results
          .map((row, i) => {
            const rank = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `**#${i + 1}**`;
            return `${rank} **${row.author}** — \`${row.total}\` PRs`;
          })
          .join("\n\n"),
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  } catch (_error) {
    await interaction.reply({
      content: "An error occurred while fetching PR stats.",
      ephemeral: true,
    });
  }
}
