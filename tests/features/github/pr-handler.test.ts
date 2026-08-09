import type { EmbedBuilder } from "discord.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/core/logger.js", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

const { dbInsertValues } = vi.hoisted(() => ({
  dbInsertValues: vi.fn().mockReturnValue({
    onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("@/core/database.js", () => ({
  db: {
    insert: vi.fn().mockReturnValue({ values: dbInsertValues }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockResolvedValue([{ id: "1", guildId: "g1", channelId: "ch1" }]),
    }),
  },
}));

vi.mock("@/core/bot.js", () => ({
  client: {
    channels: {
      fetch: vi.fn().mockResolvedValue({
        isTextBased: () => true,
        send: vi.fn().mockResolvedValue(undefined),
      }),
    },
  },
}));

vi.mock("@/features/github/schema.js", () => ({
  githubPullRequests: { prNumber: "pr_number", repoFullName: "repo_full_name" },
  githubWebhookConfigs: {},
}));

vi.mock("@/features/github/services/github.service.js", () => ({
  GitHubService: vi.fn(),
}));

import { client } from "@/core/bot.js";
import { GitHubService } from "@/features/github/services/github.service.js";
import {
  type GitHubPRWebhookPayload,
  handlePullRequestEvent,
} from "@/features/github/services/pr-handler.js";

interface MockGitHubService {
  getCheckRuns: ReturnType<typeof vi.fn>;
  getReviews: ReturnType<typeof vi.fn>;
}

function createMockGithubService(): MockGitHubService {
  return {
    getCheckRuns: vi.fn(),
    getReviews: vi.fn(),
  };
}

function mockPRPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    action: "opened",
    number: 42,
    sender: { login: "zeroxna", avatar_url: "https://example.com/avatar.png" },
    pull_request: {
      title: "Webhook title",
      body: "Webhook body",
      html_url: "https://github.com/test/repo/pull/42",
      state: "open",
      draft: false,
      merged: false,
      additions: 50,
      deletions: 10,
      changed_files: 3,
      commits: 2,
      head: { ref: "feat/webhooks", sha: "webhook-sha-123" },
      base: { ref: "main" },
      merge_commit_sha: null,
      merged_by: null,
      user: { login: "zeroxna", avatar_url: "https://example.com/avatar.png" },
      labels: [],
      requested_reviewers: [],
    },
    repository: { full_name: "test/repo" },
    ...overrides,
  };
}

describe("handlePullRequestEvent", () => {
  let githubMock: MockGitHubService;

  beforeEach(() => {
    vi.clearAllMocks();
    githubMock = createMockGithubService();
    // biome-ignore lint/complexity/useArrowFunction: must be constructible for `new` on the mock
    vi.mocked(GitHubService).mockImplementation(function () {
      return githubMock as unknown as GitHubService;
    });
  });

  function payload(): GitHubPRWebhookPayload {
    return mockPRPayload() as unknown as GitHubPRWebhookPayload;
  }

  async function sentEmbed(): Promise<EmbedBuilder> {
    const channel = (await client.channels.fetch("ch1")) as unknown as {
      isTextBased: () => boolean;
      send: ReturnType<typeof vi.fn>;
    };
    return (channel.send.mock.calls[0][0] as { embeds: EmbedBuilder[] }).embeds[0];
  }

  it("should include checks and reviews in the embed when enrichment succeeds", async () => {
    githubMock.getCheckRuns.mockResolvedValue({ total: 3, succeeded: 2, failed: 1, pending: 0 });
    githubMock.getReviews.mockResolvedValue({
      total: 1,
      approved: 1,
      changesRequested: 0,
      commented: 0,
    });

    await handlePullRequestEvent(payload());

    expect(dbInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Webhook title" }),
    );

    const fields = (await sentEmbed()).toJSON().fields ?? [];

    expect(fields).toContainEqual(
      expect.objectContaining({ name: "Checks", value: "✅ `2/3` checks passed · ❌ `1` failed" }),
    );
    expect(fields).toContainEqual(
      expect.objectContaining({ name: "Reviews", value: "✅ `1` approved" }),
    );
  });

  it("should fall back to webhook data when enrichment fails", async () => {
    githubMock.getCheckRuns.mockRejectedValue(new Error("rate limited"));

    await handlePullRequestEvent(payload());

    expect(dbInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Webhook title" }),
    );

    const fields = (await sentEmbed()).toJSON().fields ?? [];

    expect(fields.some((field) => field.name === "Checks")).toBe(false);
    expect(fields.some((field) => field.name === "Reviews")).toBe(false);
  });
});
