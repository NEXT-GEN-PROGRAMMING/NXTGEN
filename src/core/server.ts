import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { env } from "@/config/env.js";
import { logger } from "@/core/logger.js";
import { githubWebhookRoute } from "@/features/github/webhooks/route.js";

export const app = new Hono();

app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.route("/webhooks/github", githubWebhookRoute);

export function startServer() {
  serve(
    {
      fetch: app.fetch,
      port: env.API_PORT,
      hostname: env.API_HOST,
    },
    (info) => {
      logger.info(`🌐 Hono server is listening on http://${info.address}:${info.port}`);
    },
  );
}
