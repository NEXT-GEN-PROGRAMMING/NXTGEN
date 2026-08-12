import { EmbedBuilder } from "discord.js";

export interface IssueCreatedData {
  issueNumber: number;
  title: string;
  url: string;
  repoFullName: string;
  authorTag: string;
  authorAvatarUrl: string;
  messageLink: string;
  body?: string;
}

export function createIssueCreatedEmbed(data: IssueCreatedData): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0x238636)
    .setAuthor({ name: data.authorTag, iconURL: data.authorAvatarUrl })
    .setTitle(`[#${data.issueNumber}] ${data.title}`)
    .setURL(data.url)
    .setFooter({ text: data.repoFullName })
    .setTimestamp();

  if (data.body) {
    const truncatedBody = data.body.length > 500 ? data.body.slice(0, 497) + "..." : data.body;
    embed.setDescription(truncatedBody);
  }

  if (data.messageLink) {
    const cleanLink = data.messageLink.trim();
    embed.addFields({ name: "Source", value: `[Discord message](${cleanLink})` });
  }

  return embed;
}
