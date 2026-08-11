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
    issues: {
      create: ReturnType<typeof vi.fn>;
    };
    pulls: {
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
      issues: {
        create: vi.fn(),
      },
      pulls: {
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

  describe("createIssue", () => {
    it("should create an issue and return its number and URL", async () => {
      octokit.rest.issues.create.mockResolvedValue({
        data: { number: 7, html_url: "https://github.com/NEXT-GEN-PROGRAMMING/NXTGEN/issues/7" },
      });

      const issue = await service.createIssue(
        "NEXT-GEN-PROGRAMMING",
        "NXTGEN",
        "Bug: broken thing",
        "details",
      );

      expect(octokit.rest.issues.create).toHaveBeenCalledWith({
        owner: "NEXT-GEN-PROGRAMMING",
        repo: "NXTGEN",
        title: "Bug: broken thing",
        body: "details",
      });
      expect(issue).toEqual({
        number: 7,
        url: "https://github.com/NEXT-GEN-PROGRAMMING/NXTGEN/issues/7",
      });
    });
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
});
