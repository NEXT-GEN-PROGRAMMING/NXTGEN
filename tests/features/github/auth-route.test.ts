import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    select: vi.fn(),
    delete: vi.fn(),
    insert: vi.fn(),
  },
}));

vi.mock("@/core/database.js", () => ({ db: mockDb }));

vi.mock("@/core/logger.js", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("@/config/env.js", () => ({
  env: {
    GITHUB_CLIENT_ID: "client_id",
    GITHUB_CLIENT_SECRET: "client_secret",
  },
}));

vi.mock("@/features/github/queue.js", () => ({
  enqueueGitHubEvent: vi.fn().mockResolvedValue(undefined),
}));

import { app } from "@/core/server.js";

// Helper for building db chain responses
function createMockDbChain() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
  };
  return chain;
}

describe("GitHub Auth Route", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchSpy = vi.spyOn(global, "fetch");
  });

  const sendCallback = async (code?: string, state?: string) => {
    let url = "/auth/github/callback";
    const params = new URLSearchParams();
    if (code) params.append("code", code);
    if (state) params.append("state", state);
    if (params.toString()) url += `?${params.toString()}`;

    return app.request(url, { method: "GET" });
  };

  it("should return 400 if code or state is missing", async () => {
    const res = await sendCallback("code-only", undefined);
    expect(res.status).toBe(400);
    expect(await res.text()).toBe("Missing code or state.");
  });

  it("should return 400 if state parameter is invalid", async () => {
    const chain = createMockDbChain();
    chain.limit.mockResolvedValue([]); // No state found
    mockDb.select.mockReturnValue(chain);

    const res = await sendCallback("valid_code", "invalid_state");
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("Invalid or expired state");
  });

  it("should successfully link account when all API calls succeed", async () => {
    const selectChain = createMockDbChain();
    selectChain.limit.mockResolvedValue([{ discordId: "12345" }]);
    mockDb.select.mockReturnValue(selectChain);

    const deleteChain = createMockDbChain();
    mockDb.delete.mockReturnValue(deleteChain);

    const insertChain = createMockDbChain();
    insertChain.onConflictDoUpdate.mockResolvedValue([{}]);
    mockDb.insert.mockReturnValue(insertChain);

    // Mock successful token response
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: "mock_token" }),
    } as unknown as Response);

    // Mock successful user profile response
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ login: "mock_github_user" }),
    } as unknown as Response);

    const res = await sendCallback("valid_code", "valid_state");

    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Successfully Linked!");
    expect(html).toContain("mock_github_user");

    // Verify token request
    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      "https://github.com/login/oauth/access_token",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("valid_code"),
      }),
    );

    // Verify user fetch
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      "https://api.github.com/user",
      expect.objectContaining({
        headers: {
          Authorization: "Bearer mock_token",
          "User-Agent": "NxtGen-Discord-Bot",
        },
      }),
    );

    // Verify DB insert
    expect(mockDb.insert).toHaveBeenCalled();
  });
});
