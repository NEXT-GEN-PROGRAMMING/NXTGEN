import { Hono } from "hono";
import { logger } from "@/core/logger.js";
import { handlePullRequestEvent } from "@/features/github/services/pr-handler.js";
import { verifyGitHubSignature } from "@/features/github/webhooks/verify.js";

export const githubWebhookRoute = new Hono();

githubWebhookRoute.post("/", async (c) => {
  const signature = c.req.header("x-hub-signature-256");
  const event = c.req.header("x-github-event");

  if (!signature) {
    return c.json({ error: "Missing signature" }, 401);
  }

  const payloadStr = await c.req.text();

  if (!verifyGitHubSignature(payloadStr, signature)) {
    return c.json({ error: "Invalid signature" }, 401);
  }

  if (event === "ping") {
    logger.info("🏓 Received GitHub webhook ping");
    return c.json({ message: "pong" }, 200);
  }

  if (event !== "pull_request") {
    logger.debug({ event }, "Ignoring unsupported GitHub event");
    return c.json({ message: "Event ignored" }, 200);
  }

  try {
    const payload = JSON.parse(payloadStr);
    const action = payload.action;

    if (["opened", "closed", "labeled", "review_requested"].includes(action)) {
      await handlePullRequestEvent(payload);
      return c.json({ message: "Processed successfully" }, 200);
    } else {
      return c.json({ error: "Unsupported action" }, 400);
    }
  } catch (error) {
    logger.error({ err: error }, "Failed to process webhook");
    return c.json({ error: "Processing error" }, 500);
  }
});
