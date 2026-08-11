import { describe, expect, it } from "vitest";
import { parseRepoFullName } from "@/features/github/repo-name.js";

describe("parseRepoFullName", () => {
  it("should parse a valid owner/repo and trim whitespace", () => {
    expect(parseRepoFullName("  NEXT-GEN-PROGRAMMING/NXTGEN  ")).toEqual({
      owner: "NEXT-GEN-PROGRAMMING",
      repo: "NXTGEN",
    });
  });

  it("should reject invalid formats", () => {
    expect(parseRepoFullName("no-slash")).toBeNull();
    expect(parseRepoFullName("a/b/c")).toBeNull();
    expect(parseRepoFullName("")).toBeNull();
  });

  it("should reject segments exceeding GitHub length limits", () => {
    expect(parseRepoFullName(`${"a".repeat(40)}/repo`)).toBeNull();
    expect(parseRepoFullName(`owner/${"b".repeat(101)}`)).toBeNull();
  });
});
