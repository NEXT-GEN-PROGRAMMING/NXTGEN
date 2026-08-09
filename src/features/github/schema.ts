import { integer, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

export const githubWebhookConfigs = pgTable("github_webhook_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  guildId: text("guild_id").notNull().unique(),
  channelId: text("channel_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const githubPullRequests = pgTable(
  "github_pull_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    prNumber: integer("pr_number").notNull(),
    repoFullName: text("repo_full_name").notNull(),
    title: text("title").notNull(),
    authorLogin: text("author_login").notNull(),
    authorAvatarUrl: text("author_avatar_url"),
    state: text("state").notNull(),
    url: text("url").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    unq: unique().on(t.prNumber, t.repoFullName),
  }),
);
