import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock all external dependencies
vi.mock("@/config/env.js", () => ({
  env: {
    GITHUB_WEBHOOK_SECRET: "test-webhook-secret",
  },
}));

vi.mock("@/core/logger.js", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("@/core/database.js", () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockResolvedValue([]),
    }),
  },
}));

vi.mock("@/core/bot.js", () => ({
  client: {
    channels: {
      fetch: vi.fn(),
    },
  },
}));

vi.mock("@/features/github/schema.js", () => ({
  githubPullRequests: { prNumber: "pr_number", repoFullName: "repo_full_name" },
  githubWebhookConfigs: {},
}));

import { app } from "@/core/server.js";

/** Helper to generate a valid HMAC signature */
function sign(payload: string): string {
  const hmac = crypto.createHmac("sha256", "test-webhook-secret");
  hmac.update(payload);
  return `sha256=${hmac.digest("hex")}`;
}

/** Helper to make a webhook request against the Hono app */
async function sendWebhook(
  payload: string,
  options: { event?: string; signature?: string | null } = {},
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (options.event !== undefined) {
    headers["x-github-event"] = options.event;
  } else {
    headers["x-github-event"] = "pull_request";
  }

  if (options.signature !== null) {
    headers["x-hub-signature-256"] = options.signature ?? sign(payload);
  }

  return app.request("/webhooks/github", {
    method: "POST",
    headers,
    body: payload,
  });
}

/** A minimal valid PR webhook payload */
function mockPRPayload(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    action: "opened",
    number: 42,
    sender: { login: "zeroxna", avatar_url: "https://example.com/avatar.png" },
    pull_request: {
      title: "Add webhook handler",
      body: "This PR adds webhook support",
      html_url: "https://github.com/test/repo/pull/42",
      state: "open",
      draft: false,
      merged: false,
      additions: 50,
      deletions: 10,
      changed_files: 3,
      commits: 2,
      head: { ref: "feat/webhooks", sha: "abc1234567890" },
      base: { ref: "main" },
      merge_commit_sha: null,
      merged_by: null,
      user: { login: "zeroxna", avatar_url: "https://example.com/avatar.png" },
      labels: [],
      requested_reviewers: [],
    },
    repository: { full_name: "test/repo" },
    ...overrides,
  });
}

describe("GitHub Webhook Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Signature Verification", () => {
    it("should return 401 when signature header is missing", async () => {
      const res = await sendWebhook("{}", { signature: null });

      expect(res.status).toBe(401);
      const body = (await res.json()) as { error?: string; message?: string };
      expect(body.error).toBe("Missing signature");
    });

    it("should return 401 when signature is invalid", async () => {
      const res = await sendWebhook("{}", {
        signature: "sha256=definitely_not_a_valid_signature_at_all",
      });

      expect(res.status).toBe(401);
      const body = (await res.json()) as { error?: string; message?: string };
      expect(body.error).toBe("Invalid signature");
    });
  });

  describe("Ping Event", () => {
    it("should return 200 pong for ping events", async () => {
      const payload = "{}";
      const res = await sendWebhook(payload, { event: "ping" });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { error?: string; message?: string };
      expect(body.message).toBe("pong");
    });
  });

  describe("Unsupported Events", () => {
    it("should return 200 and ignore unsupported events", async () => {
      const payload = "{}";
      const res = await sendWebhook(payload, { event: "issues" });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { error?: string; message?: string };
      expect(body.message).toBe("Event ignored");
    });
  });

  describe("Pull Request Events", () => {
    it("should return 200 for a valid opened PR event", async () => {
      const payload = mockPRPayload();
      const res = await sendWebhook(payload);

      expect(res.status).toBe(200);
      const body = (await res.json()) as { error?: string; message?: string };
      expect(body.message).toBe("Processed successfully");
    });

    it("should return 200 for a valid closed PR event", async () => {
      const payload = mockPRPayload({ action: "closed" });
      const res = await sendWebhook(payload);

      expect(res.status).toBe(200);
    });

    it("should return 200 for a labeled PR event", async () => {
      const payload = mockPRPayload({
        action: "labeled",
        label: { name: "bug" },
      });
      const res = await sendWebhook(payload);

      expect(res.status).toBe(200);
    });

    it("should return 200 for a review_requested PR event", async () => {
      const payload = mockPRPayload({
        action: "review_requested",
        requested_reviewer: { login: "reviewer" },
      });
      const res = await sendWebhook(payload);

      expect(res.status).toBe(200);
    });

    it("should return 400 for unsupported PR actions", async () => {
      const payload = mockPRPayload({ action: "edited" });
      const res = await sendWebhook(payload);

      expect(res.status).toBe(400);
      const body = (await res.json()) as { error?: string; message?: string };
      expect(body.error).toBe("Unsupported action");
    });
  });
});
