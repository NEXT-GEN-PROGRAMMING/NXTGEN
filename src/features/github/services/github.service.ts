import { Octokit } from "@octokit/rest";
import { env } from "@/config/env.js";

export interface PullRequestDetails {
  title: string;
  body: string | null;
  state: string;
  draft: boolean;
  merged: boolean;
  mergeCommitSha: string | null;
  mergedByLogin: string | null;
  headSha: string;
  headRef: string;
  baseRef: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  commits: number;
}

export interface CheckRunSummary {
  total: number;
  succeeded: number;
  failed: number;
  pending: number;
}

export interface ReviewSummary {
  total: number;
  approved: number;
  changesRequested: number;
  commented: number;
}

export class GitHubService {
  private readonly octokit: Octokit;

  constructor(token = env.GITHUB_TOKEN) {
    this.octokit = new Octokit({ auth: token });
  }

  async getPullRequest(owner: string, repo: string, prNumber: number): Promise<PullRequestDetails> {
    const { data } = await this.octokit.rest.pulls.get({ owner, repo, pull_number: prNumber });

    return {
      title: data.title,
      body: data.body,
      state: data.state,
      draft: data.draft ?? false,
      merged: data.merged ?? false,
      mergeCommitSha: data.merge_commit_sha,
      mergedByLogin: data.merged_by?.login ?? null,
      headSha: data.head.sha,
      headRef: data.head.ref,
      baseRef: data.base?.ref ?? "",
      additions: data.additions ?? 0,
      deletions: data.deletions ?? 0,
      changedFiles: data.changed_files ?? 0,
      commits: data.commits ?? 0,
    };
  }

  async getCheckRuns(owner: string, repo: string, headSha: string): Promise<CheckRunSummary> {
    const { data } = await this.octokit.rest.checks.listForRef({ owner, repo, ref: headSha });
    const runs = data.check_runs;

    return {
      total: runs.length,
      succeeded: runs.filter((run) => run.conclusion === "success").length,
      failed: runs.filter((run) => run.conclusion === "failure" || run.conclusion === "timed_out")
        .length,
      pending: runs.filter((run) => run.status !== "completed").length,
    };
  }

  async getReviews(owner: string, repo: string, prNumber: number): Promise<ReviewSummary> {
    const { data } = await this.octokit.rest.pulls.listReviews({
      owner,
      repo,
      pull_number: prNumber,
    });

    return {
      total: data.length,
      approved: data.filter((review) => review.state === "APPROVED").length,
      changesRequested: data.filter((review) => review.state === "CHANGES_REQUESTED").length,
      commented: data.filter((review) => review.state === "COMMENTED").length,
    };
  }
}
