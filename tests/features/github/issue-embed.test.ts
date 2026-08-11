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

const { envMock, dbSelectFromMock, createIssueMock } = vi.hoisted(() => ({
  envMock: { GITHUB_ISSUES_REPO: "test/repo" } as { GITHUB_ISSUES_REPO: string | undefined },
  dbSelectFromMock: vi.fn(),
  createIssueMock: vi.fn(),
}));

vi.mock("@/config/env.js", () => ({
  env: envMock,
}));

vi.mock("@/core/database.js", () => ({
  db: {
    select: vi.fn().mockReturnValue({ from: dbSelectFromMock }),
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
  githubWebhookConfigs: {},
}));

vi.mock("@/features/github/services/github.service.js", () => ({
  GitHubService: vi.fn(),
}));

import type { MessageContextMenuCommandInteraction } from "discord.js";
import { execute } from "@/commands/github/create-issue.js";
import { client } from "@/core/bot.js";
import {
  createIssueCreatedEmbed,
  type IssueCreatedData,
} from "@/features/github/embeds/issue-embed.js";
import { GitHubService } from "@/features/github/services/github.service.js";

interface MockInteraction {
  deferReply: ReturnType<typeof vi.fn>;
  editReply: ReturnType<typeof vi.fn>;
  guildId: string;
  user: { id: string; tag: string; displayAvatarURL: () => string };
  targetMessage: { partial: boolean; content: string; channelId: string; id: string };
}

function mockInteraction(content: string): MockInteraction {
  return {
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
    guildId: "guild1",
    user: { id: "user1", tag: "tester", displayAvatarURL: () => "https://example.com/a.png" },
    targetMessage: { partial: false, content, channelId: "ch2", id: "m1" },
  };
}

function issueData(overrides: Partial<IssueCreatedData> = {}): IssueCreatedData {
  return {
    issueNumber: 7,
    title: "Bug in webhook",
    url: "https://github.com/test/repo/issues/7",
    repoFullName: "test/repo",
    authorTag: "tester",
    authorAvatarUrl: "https://example.com/a.png",
    messageLink: "https://discord.com/channels/guild1/ch2/m1",
    ...overrides,
  };
}

describe("createIssueCreatedEmbed", () => {
  it("should include issue number, title, url, source and repo", () => {
    const json = createIssueCreatedEmbed(issueData()).toJSON();

    expect(json.title).toBe("[#7] Bug in webhook");
    expect(json.url).toBe("https://github.com/test/repo/issues/7");
    expect(json.footer?.text).toBe("test/repo");
    expect(json.fields).toContainEqual(
      expect.objectContaining({
        name: "Source",
        value: "[Discord message](https://discord.com/channels/guild1/ch2/m1)",
      }),
    );
  });
});

describe("create-issue command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envMock.GITHUB_ISSUES_REPO = "test/repo";
    dbSelectFromMock.mockResolvedValue([{ id: "1", guildId: "guild1", channelId: "ch1" }]);
    createIssueMock.mockResolvedValue({ number: 7, url: "https://github.com/test/repo/issues/7" });
    // biome-ignore lint/complexity/useArrowFunction: must be constructible for `new` on the mock
    vi.mocked(GitHubService).mockImplementation(function () {
      return { createIssue: createIssueMock } as unknown as GitHubService;
    });
  });

  it("creates an issue with a truncated title and announces it to configured channels", async () => {
    const interaction = mockInteraction("x".repeat(200));
    await execute(interaction as unknown as MessageContextMenuCommandInteraction);

    expect(createIssueMock).toHaveBeenCalledWith(
      "test",
      "repo",
      `${"x".repeat(100)}…`,
      expect.stringContaining("https://discord.com/channels/guild1/ch2/m1"),
    );
    expect(interaction.editReply).toHaveBeenCalledWith({
      content: "Issue created: https://github.com/test/repo/issues/7",
    });

    const channel = (await client.channels.fetch("ch1")) as unknown as {
      send: ReturnType<typeof vi.fn>;
    };
    const sent = (channel.send.mock.calls[0][0] as { embeds: EmbedBuilder[] }).embeds[0];
    expect(sent.toJSON().title).toBe(`[#7] ${"x".repeat(100)}…`);
  });

  it("falls back to a generic title for empty message content", async () => {
    const interaction = mockInteraction("   ");
    await execute(interaction as unknown as MessageContextMenuCommandInteraction);

    expect(createIssueMock).toHaveBeenCalledWith(
      "test",
      "repo",
      "Issue from Discord",
      expect.any(String),
    );
    expect(interaction.editReply).toHaveBeenCalledWith({
      content: "Issue created: https://github.com/test/repo/issues/7",
    });
  });

  it("replies with an error when the issue repo is not configured", async () => {
    envMock.GITHUB_ISSUES_REPO = undefined;
    const interaction = mockInteraction("Hello");
    await execute(interaction as unknown as MessageContextMenuCommandInteraction);

    expect(createIssueMock).not.toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining("GITHUB_ISSUES_REPO") }),
    );
  });
});
