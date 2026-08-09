import { describe, expect, it } from "vitest";
import type { PREventData } from "@/features/github/embeds/pr-embed.js";
import {
  createPRClosedEmbed,
  createPRLabeledEmbed,
  createPRMergedEmbed,
  createPROpenedEmbed,
  createPRReviewRequestedEmbed,
} from "@/features/github/embeds/pr-embed.js";

/** Reusable mock PR data */
function mockPRData(overrides?: Partial<PREventData>): PREventData {
  return {
    prNumber: 42,
    title: "Add webhook handler",
    repoFullName: "NEXT-GEN-PROGRAMMING/NXTGEN",
    url: "https://github.com/NEXT-GEN-PROGRAMMING/NXTGEN/pull/42",
    authorLogin: "zeroxna",
    authorAvatarUrl: "https://avatars.githubusercontent.com/u/123",
    senderLogin: "zeroxna",
    senderAvatarUrl: "https://avatars.githubusercontent.com/u/123",
    headBranch: "feat/webhook-handler",
    baseBranch: "main",
    headSha: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
    commitCount: 5,
    additions: 127,
    deletions: 14,
    changedFiles: 5,
    draft: false,
    body: "This PR adds the GitHub webhook handler for PR tracking.",
    mergeCommitSha: null,
    mergedByLogin: null,
    ...overrides,
  };
}

describe("PR Embed Builders", () => {
  describe("createPROpenedEmbed", () => {
    it("should create an embed with green color", () => {
      const embed = createPROpenedEmbed(mockPRData());
      const json = embed.toJSON();

      expect(json.color).toBe(0x238636);
    });

    it("should include PR number and title", () => {
      const embed = createPROpenedEmbed(mockPRData());
      const json = embed.toJSON();

      expect(json.title).toBe("[#42] Add webhook handler");
    });

    it("should include sender info in description", () => {
      const embed = createPROpenedEmbed(mockPRData());
      const json = embed.toJSON();

      expect(json.description).toContain("**Opened** by **zeroxna**");
    });

    it("should include branch info in description", () => {
      const embed = createPROpenedEmbed(mockPRData());
      const json = embed.toJSON();

      expect(json.description).toContain("`feat/webhook-handler` → `main`");
    });

    it("should include file stats in description", () => {
      const embed = createPROpenedEmbed(mockPRData());
      const json = embed.toJSON();

      expect(json.description).toContain("`+127 -14` across 5 files");
    });

    it("should include short commit hash in description", () => {
      const embed = createPROpenedEmbed(mockPRData());
      const json = embed.toJSON();

      expect(json.description).toContain("`a1b2c3d`");
    });

    it("should show [DRAFT] prefix for draft PRs", () => {
      const embed = createPROpenedEmbed(mockPRData({ draft: true }));
      const json = embed.toJSON();

      expect(json.title).toBe("[DRAFT] [#42] Add webhook handler");
    });

    it("should include body preview as a field", () => {
      const embed = createPROpenedEmbed(mockPRData());
      const json = embed.toJSON();

      expect(json.fields?.[0]?.name).toBe("Description");
      expect(json.fields?.[0]?.value).toBe(
        "This PR adds the GitHub webhook handler for PR tracking.",
      );
    });

    it("should not include body field when body is null", () => {
      const embed = createPROpenedEmbed(mockPRData({ body: null }));
      const json = embed.toJSON();

      expect(json.fields).toBeUndefined();
    });

    it("should truncate long body text", () => {
      const longBody = "A".repeat(200);
      const embed = createPROpenedEmbed(mockPRData({ body: longBody }));
      const json = embed.toJSON();

      expect(json.fields?.[0]?.value?.length).toBeLessThanOrEqual(121); // 120 + "…"
    });

    it("should use singular 'file' for 1 changed file", () => {
      const embed = createPROpenedEmbed(mockPRData({ changedFiles: 1 }));
      const json = embed.toJSON();

      expect(json.description).toContain("1 file");
      expect(json.description).not.toContain("1 files");
    });

    it("should set the PR URL", () => {
      const embed = createPROpenedEmbed(mockPRData());
      const json = embed.toJSON();

      expect(json.url).toBe("https://github.com/NEXT-GEN-PROGRAMMING/NXTGEN/pull/42");
    });

    it("should set the repo name in footer", () => {
      const embed = createPROpenedEmbed(mockPRData());
      const json = embed.toJSON();

      expect(json.footer?.text).toBe("NEXT-GEN-PROGRAMMING/NXTGEN");
    });

    it("should set sender as author", () => {
      const embed = createPROpenedEmbed(mockPRData());
      const json = embed.toJSON();

      expect(json.author?.name).toBe("zeroxna");
    });
  });

  describe("createPRClosedEmbed", () => {
    it("should create an embed with red color", () => {
      const embed = createPRClosedEmbed(mockPRData());
      const json = embed.toJSON();

      expect(json.color).toBe(0xda3633);
    });

    it("should indicate closed without merging", () => {
      const embed = createPRClosedEmbed(mockPRData({ senderLogin: "maintainer" }));
      const json = embed.toJSON();

      expect(json.description).toContain("**Closed** by **maintainer** without merging");
    });
  });

  describe("createPRMergedEmbed", () => {
    it("should create an embed with purple color", () => {
      const data = mockPRData({
        mergeCommitSha: "f4e5d6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3",
        mergedByLogin: "maintainer",
      });
      const embed = createPRMergedEmbed(data);
      const json = embed.toJSON();

      expect(json.color).toBe(0x8957e5);
    });

    it("should show who merged and the merge commit hash", () => {
      const data = mockPRData({
        mergeCommitSha: "f4e5d6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3",
        mergedByLogin: "maintainer",
        commitCount: 12,
      });
      const embed = createPRMergedEmbed(data);
      const json = embed.toJSON();

      expect(json.description).toContain("**Merged** by **maintainer**");
      expect(json.description).toContain("`f4e5d6a`");
      expect(json.description).toContain("12 commits");
    });

    it("should fall back to sender if mergedByLogin is null", () => {
      const data = mockPRData({ mergedByLogin: null, senderLogin: "fallback-user" });
      const embed = createPRMergedEmbed(data);
      const json = embed.toJSON();

      expect(json.description).toContain("**Merged** by **fallback-user**");
    });

    it("should show 'unknown' if merge commit sha is null", () => {
      const data = mockPRData({ mergeCommitSha: null });
      const embed = createPRMergedEmbed(data);
      const json = embed.toJSON();

      expect(json.description).toContain("`unknown`");
    });

    it("should use singular 'commit' for 1 commit", () => {
      const data = mockPRData({ commitCount: 1, mergeCommitSha: "abc1234" });
      const embed = createPRMergedEmbed(data);
      const json = embed.toJSON();

      expect(json.description).toContain("1 commit");
      expect(json.description).not.toContain("1 commits");
    });
  });

  describe("createPRReviewRequestedEmbed", () => {
    it("should create an embed with blue color", () => {
      const embed = createPRReviewRequestedEmbed({ ...mockPRData(), reviewer: "reviewer123" });
      const json = embed.toJSON();

      expect(json.color).toBe(0x3182ce);
    });

    it("should show who requested and from whom", () => {
      const embed = createPRReviewRequestedEmbed({
        ...mockPRData({ senderLogin: "zeroxna" }),
        reviewer: "reviewer123",
      });
      const json = embed.toJSON();

      expect(json.description).toContain("**zeroxna** requested review from **reviewer123**");
    });
  });

  describe("createPRLabeledEmbed", () => {
    it("should create an embed with yellow color", () => {
      const embed = createPRLabeledEmbed({ ...mockPRData(), label: "bug" });
      const json = embed.toJSON();

      expect(json.color).toBe(0xd69e2e);
    });

    it("should show who added which label", () => {
      const embed = createPRLabeledEmbed({
        ...mockPRData({ senderLogin: "zeroxna" }),
        label: "enhancement",
      });
      const json = embed.toJSON();

      expect(json.description).toContain("**zeroxna** added label **enhancement**");
    });

    it("should not include file stats (only branch info)", () => {
      const embed = createPRLabeledEmbed({ ...mockPRData(), label: "bug" });
      const json = embed.toJSON();

      expect(json.description).not.toContain("+127");
    });
  });
});
