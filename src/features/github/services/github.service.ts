import { Octokit } from "@octokit/rest";
import { env } from "@/config/env.js";

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
