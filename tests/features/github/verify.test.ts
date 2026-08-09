import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the env module before importing verify
vi.mock("@/config/env.js", () => ({
  env: {
    GITHUB_WEBHOOK_SECRET: "test-secret-123",
  },
}));

import { verifyGitHubSignature } from "@/features/github/webhooks/verify.js";

/** Helper to generate a valid HMAC signature for a payload */
function generateSignature(payload: string, secret: string): string {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload);
  return `sha256=${hmac.digest("hex")}`;
}

describe("verifyGitHubSignature", () => {
  it("should return true for a valid signature", () => {
    const payload = '{"action":"opened"}';
    const signature = generateSignature(payload, "test-secret-123");

    expect(verifyGitHubSignature(payload, signature)).toBe(true);
  });

  it("should return false for an invalid signature", () => {
    const payload = '{"action":"opened"}';
    const signature = "sha256=invalid_signature_that_is_definitely_wrong_abcd";

    expect(verifyGitHubSignature(payload, signature)).toBe(false);
  });

  it("should return false when signature has different length", () => {
    const payload = '{"action":"opened"}';
    const signature = "sha256=tooshort";

    expect(verifyGitHubSignature(payload, signature)).toBe(false);
  });

  it("should return false for a tampered payload", () => {
    const originalPayload = '{"action":"opened"}';
    const tamperedPayload = '{"action":"closed"}';
    const signature = generateSignature(originalPayload, "test-secret-123");

    expect(verifyGitHubSignature(tamperedPayload, signature)).toBe(false);
  });

  it("should return false for a signature with the wrong secret", () => {
    const payload = '{"action":"opened"}';
    const signature = generateSignature(payload, "wrong-secret");

    expect(verifyGitHubSignature(payload, signature)).toBe(false);
  });
});

describe("verifyGitHubSignature with no secret configured", () => {
  beforeEach(() => {
    vi.doMock("@/config/env.js", () => ({
      env: {
        GITHUB_WEBHOOK_SECRET: undefined,
      },
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return false when GITHUB_WEBHOOK_SECRET is not set", async () => {
    const { verifyGitHubSignature: verify } = await import("@/features/github/webhooks/verify.js");
    const payload = '{"action":"opened"}';
    const signature = generateSignature(payload, "any-secret");

    expect(verify(payload, signature)).toBe(false);
  });
});
