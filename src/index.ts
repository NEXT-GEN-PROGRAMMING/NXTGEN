import { registerCommands } from "@/commands/handler.js";
import { startBot } from "@/core/bot.js";
import { connectDatabase } from "@/core/database.js";
import { logger } from "@/core/logger.js";
import { connectRedis } from "@/core/redis.js";
import { startServer } from "@/core/server.js";

async function bootstrap() {
  logger.info("🚀 Starting NxtGen bot...");

  // Connect to infrastructure
  await connectDatabase();
  await connectRedis();

  // Start Hono Webhook Server
  startServer();

  // Register slash commands with Discord API
  await registerCommands();

  // Start Discord Bot
  await startBot();
}

bootstrap().catch((err) => {
  logger.fatal({ err }, "❌ Unhandled error during bootstrap");
  process.exit(1);
});
