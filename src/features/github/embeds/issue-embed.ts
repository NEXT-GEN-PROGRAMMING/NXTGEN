import { EmbedBuilder } from "discord.js";

export interface IssueCreatedData {
  issueNumber: number;
  title: string;
  url: string;
  repoFullName: string;
  authorTag: string;
  authorAvatarUrl: string;
  messageLink: string;
}

export function createIssueCreatedEmbed(data: IssueCreatedData): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x238636)
    .setAuthor({ name: data.authorTag, iconURL: data.authorAvatarUrl })
    .setTitle(`[#${data.issueNumber}] ${data.title}`)
    .setURL(data.url)
    .addFields({ name: "Source", value: `[Discord message](${data.messageLink})` })
    .setFooter({ text: data.repoFullName })
    .setTimestamp();
}
