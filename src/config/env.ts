import { config } from "dotenv";
import { z } from "zod";

// Load .env file into process.env
config();

const envSchema = z.object({
  // Discord
  DISCORD_TOKEN: z.string().min(1, "Discord token is required"),
  DISCORD_CLIENT_ID: z.string().min(1, "Discord client ID is required"),
  DISCORD_GUILD_ID: z.string().optional(),

  // Database
  DATABASE_URL: z.string().url("Must be a valid Postgres URL"),

  // Redis
  REDIS_URL: z.string().url("Must be a valid Redis URL"),

  // Hono API Server
  API_PORT: z.coerce.number().default(3000),
  API_HOST: z.string().default("0.0.0.0"),

  // GitHub Webhooks
  GITHUB_WEBHOOK_SECRET: z.string().optional(),

  // GitHub API (used by src/features/github/services/github.service.ts)
  GITHUB_TOKEN: z.string().min(1, "GitHub token is required"),

  // Repo (owner/repo) where issues are created from Discord; unset → command errors at runtime
  GITHUB_ISSUES_REPO: z.string().optional(),

  // Logging & Env
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "❌ Invalid environment variables:",
    JSON.stringify(parsed.error.format(), null, 2),
  );
  process.exit(1);
}

export const env = parsed.data;
