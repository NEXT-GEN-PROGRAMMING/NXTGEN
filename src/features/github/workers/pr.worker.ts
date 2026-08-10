import { Worker } from "bullmq";
import { logger } from "@/core/logger.js";
import { redis } from "@/core/redis.js";
import { GITHUB_PR_QUEUE_NAME } from "@/features/github/queue.js";
import {
  type GitHubPRWebhookPayload,
  handlePullRequestEvent,
} from "@/features/github/services/pr-handler.js";

export function startPRWorker(): void {
  const worker = new Worker<GitHubPRWebhookPayload>(
    GITHUB_PR_QUEUE_NAME,
    async (job) => {
      logger.info(
        { jobId: job.id, pr: job.data.number, repo: job.data.repository.full_name },
        "Processing PR webhook job",
      );
      await handlePullRequestEvent(job.data);
    },
    { connection: redis },
  );

  worker.on("failed", (job, err) => {
    logger.error({ err, jobId: job?.id }, "PR webhook job failed");
  });

  const shutdown = (signal: string): void => {
    logger.info({ signal }, "Shutting down PR worker");
    void worker.close().finally(() => process.exit(0));
  };

  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
}
