import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Example User table to get started
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  discordId: text("discord_id").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export * from "@/features/github/schema.js";
