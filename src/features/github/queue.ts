import { Queue } from "bullmq";
import { redis } from "@/core/redis.js";
import type { GitHubPRWebhookPayload } from "@/features/github/services/pr-handler.js";

export const GITHUB_PR_QUEUE_NAME = "github-pr-events";

export const githubPRQueue = new Queue<GitHubPRWebhookPayload>(GITHUB_PR_QUEUE_NAME, {
  connection: redis,
});

export async function enqueueGitHubEvent(payload: GitHubPRWebhookPayload): Promise<void> {
  await githubPRQueue.add("pr-event", payload, {
    attempts: 3,
    backoff: { type: "exponential", delay: 1_000 },
  });
}
