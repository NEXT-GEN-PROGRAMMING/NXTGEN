import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/env.js", () => ({
  env: {
    GITHUB_TOKEN: "test-token",
  },
}));

vi.mock("@octokit/rest", () => ({
  Octokit: vi.fn(),
}));

import { Octokit } from "@octokit/rest";
import { GitHubService } from "@/features/github/services/github.service.js";

interface MockOctokitInstance {
  rest: {
    pulls: {
      get: ReturnType<typeof vi.fn>;
      listReviews: ReturnType<typeof vi.fn>;
    };
    checks: {
      listForRef: ReturnType<typeof vi.fn>;
    };
  };
}

function createMockOctokit(): MockOctokitInstance {
  return {
    rest: {
      pulls: {
        get: vi.fn(),
        listReviews: vi.fn(),
      },
      checks: {
        listForRef: vi.fn(),
      },
    },
  };
}

describe("GitHubService", () => {
  let octokit: MockOctokitInstance;
  let service: GitHubService;

  beforeEach(() => {
    octokit = createMockOctokit();
    // biome-ignore lint/complexity/useArrowFunction: must be constructible for `new` on the mock
    vi.mocked(Octokit).mockImplementation(function () {
      return octokit as unknown as Octokit;
    });
    service = new GitHubService("test-token");
  });

  describe("getCheckRuns", () => {
    it("should summarize check run statuses", async () => {
      octokit.rest.checks.listForRef.mockResolvedValue({
        data: {
          check_runs: [
            { status: "completed", conclusion: "success" },
            { status: "completed", conclusion: "success" },
            { status: "completed", conclusion: "failure" },
            { status: "queued", conclusion: null },
            { status: "in_progress", conclusion: null },
          ],
        },
      });

      const summary = await service.getCheckRuns("NEXT-GEN-PROGRAMMING", "NXTGEN", "abc123");

      expect(octokit.rest.checks.listForRef).toHaveBeenCalledWith({
        owner: "NEXT-GEN-PROGRAMMING",
        repo: "NXTGEN",
        ref: "abc123",
      });
      expect(summary).toEqual({ total: 5, succeeded: 2, failed: 1, pending: 2 });
    });

    it("should ignore neutral results when counting failures", async () => {
      octokit.rest.checks.listForRef.mockResolvedValue({
        data: {
          check_runs: [
            { status: "completed", conclusion: "success" },
            { status: "completed", conclusion: "neutral" },
            { status: "completed", conclusion: "timed_out" },
          ],
        },
      });

      const summary = await service.getCheckRuns("owner", "repo", "sha");

      expect(summary).toEqual({ total: 3, succeeded: 1, failed: 1, pending: 0 });
    });
  });

  describe("getReviews", () => {
    it("should count reviews by state, ignoring dismissed and pending", async () => {
      octokit.rest.pulls.listReviews.mockResolvedValue({
        data: [
          { state: "APPROVED" },
          { state: "APPROVED" },
          { state: "CHANGES_REQUESTED" },
          { state: "COMMENTED" },
          { state: "DISMISSED" },
          { state: "PENDING" },
        ],
      });

      const summary = await service.getReviews("owner", "repo", 42);

      expect(octokit.rest.pulls.listReviews).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        pull_number: 42,
      });
      expect(summary).toEqual({ total: 6, approved: 2, changesRequested: 1, commented: 1 });
    });
  });

  describe("getPullRequest", () => {
    it("should map fresh PR details, defaulting missing numbers", async () => {
      octokit.rest.pulls.get.mockResolvedValue({
        data: {
          title: "Fresh title",
          body: null,
          state: "open",
          draft: false,
          merged: false,
          merge_commit_sha: null,
          merged_by: null,
          head: { sha: "sha-123", ref: "feat/x" },
          base: { ref: "main" },
          additions: null,
          deletions: 20,
          changed_files: 4,
          commits: 10,
        },
      });

      const details = await service.getPullRequest("owner", "repo", 42);

      expect(octokit.rest.pulls.get).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        pull_number: 42,
      });
      expect(details).toEqual({
        title: "Fresh title",
        body: null,
        state: "open",
        draft: false,
        merged: false,
        mergeCommitSha: null,
        mergedByLogin: null,
        headSha: "sha-123",
        headRef: "feat/x",
        baseRef: "main",
        additions: 0,
        deletions: 20,
        changedFiles: 4,
        commits: 10,
      });
    });

    it("should map merge info when present", async () => {
      octokit.rest.pulls.get.mockResolvedValue({
        data: {
          title: "T",
          body: "body",
          state: "closed",
          draft: false,
          merged: true,
          merge_commit_sha: "abc1234",
          merged_by: { login: "maintainer" },
          head: { sha: "s", ref: "r" },
          base: { ref: "main" },
          additions: 1,
          deletions: 1,
          changed_files: 1,
          commits: 1,
        },
      });

      const details = await service.getPullRequest("owner", "repo", 42);

      expect(details.merged).toBe(true);
      expect(details.mergeCommitSha).toBe("abc1234");
      expect(details.mergedByLogin).toBe("maintainer");
    });
  });
});
