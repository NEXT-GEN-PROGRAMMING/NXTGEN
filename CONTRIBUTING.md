# Contributing to NxtGen

First off — **thank you** for considering contributing to NxtGen! Every contribution matters, whether it's fixing a typo, reporting a bug, suggesting a feature, or writing code.

This document outlines the process and standards for contributing. Please read through it before submitting your first pull request.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
  - [Development Environment](#development-environment)
  - [Running Locally](#running-locally)
- [How to Contribute](#how-to-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Features](#suggesting-features)
  - [Your First Code Contribution](#your-first-code-contribution)
- [Development Workflow](#development-workflow)
  - [Branching Strategy](#branching-strategy)
  - [Making Changes](#making-changes)
  - [Writing Tests](#writing-tests)
  - [Database Migrations](#database-migrations)
- [Code Style & Standards](#code-style--standards)
  - [TypeScript Guidelines](#typescript-guidelines)
  - [Biome (Lint & Format)](#biome-lint--format)
  - [File & Folder Naming](#file--folder-naming)
  - [Import Order](#import-order)
- [Commit Conventions](#commit-conventions)
  - [Commit Message Format](#commit-message-format)
  - [Types](#types)
  - [Scopes](#scopes)
  - [Examples](#examples)
- [Pull Request Process](#pull-request-process)
  - [Before You Submit](#before-you-submit)
  - [PR Title & Description](#pr-title--description)
  - [Review Process](#review-process)
- [Adding a New Feature Module](#adding-a-new-feature-module)
- [Architecture Decisions](#architecture-decisions)
- [Community](#community)

---

## Code of Conduct

This project has a [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold it. Please report unacceptable behaviour as described in the Code of Conduct document.

---

## Getting Started

### Development Environment

Ensure you have the following installed:

| Tool            | Minimum Version | Notes                                                    |
| --------------- | --------------- | -------------------------------------------------------- |
| **Node.js**     | >=26.x             | Use [nvm](https://github.com/nvm-sh/nvm) for easy version management |
| **pnpm**        | >=11.x (required)              | `corepack enable && corepack prepare pnpm@latest --activate` |
| **PostgreSQL**  | 18             | Local install or via Docker                              |
| **Redis**       | 8              | Local install or via Docker                              |
| **Docker**      | 29.7.x            | Recommended — simplifies Postgres + Redis setup          |

### Running Locally

```bash
# 1. Fork and clone the repository
git clone https://github.com/NEXT-GEN-PROGRAMMING/NXTGEN
cd nxtgen

# 2. Add the upstream remote
git remote add upstream https://github.com/NEXT-GEN-PROGRAMMING/NXTGEN

# 3. Install dependencies
pnpm install

# 4. Copy the example environment file
cp .env.example .env
# Edit .env with your Discord token, database URL, etc.
# For local GitHub webhook and OAuth testing, use a tool like cloudflared or ngrok 
# to get a public HTTPS URL and set it as your PUBLIC_URL.

# 5. Start PostgreSQL and Redis (using the provided docker-compose.yml)
docker compose up -d postgres redis

# 6. Run database migrations
pnpm db:migrate

# 7. Start the bot in development mode
pnpm dev

# 8. (Optional) Test the compiled production build locally
pnpm build
node dist/index.js
```

> **Tip:** If you only need to work on a feature that doesn't require Discord, you can skip the `DISCORD_TOKEN` and work with the Hono API server and tests in isolation.

---

## How to Contribute

### Reporting Bugs

Found a bug? Please [open an issue](../../issues/new?template=bug_report.yml) with:

1. **What happened** — A clear description of the bug.
2. **What you expected** — What should have happened instead.
3. **Steps to reproduce** — Minimal steps to trigger the bug.
4. **Environment** — Node version, OS, Docker version (if applicable).
5. **Logs** — Relevant Pino log output (set `LOG_LEVEL=debug` if needed).

### Suggesting Features

Have an idea? [Open a feature request](../../issues/new?template=feature_request.yml) with:

1. **Problem** — What problem does this solve?
2. **Proposed solution** — How would you approach it?
3. **Alternatives considered** — Any other approaches you thought about.
4. **Scope** — Is this a small change or a large new feature module?

### Your First Code Contribution

Not sure where to start? Look for issues labelled:

- 🏷️ `good first issue` — Small, well-defined tasks perfect for newcomers.
- 🏷️ `help wanted` — Larger tasks where the maintainers would appreciate help.

---

## Development Workflow

### Branching Strategy

We use a **trunk-based** approach with `main` as the primary branch:

```
main          ← always deployable
  └── feat/github-pr-labels        ← feature branches
  └── fix/webhook-signature-check  ← bugfix branches
  └── docs/update-readme           ← documentation branches
  └── refactor/command-handler     ← refactor branches
```

**Rules:**

- All work happens on **feature branches** created from `main`.
- Feature branches are merged via **pull requests** — never push directly to `main`.
- Keep your branch up to date with `main` by rebasing: `git pull --rebase upstream main`.

### Making Changes

```bash
# 1. Create a feature branch from the latest main
git checkout main
git pull upstream main
git checkout -b feat/my-feature

# 2. Make your changes
# ...

# 3. Run the linter and formatter
pnpm check

# 4. Run the tests
pnpm test

# 5. Commit your changes (see Commit Conventions below)
git add .
git commit -m "feat(github): add label sync to PR embeds"

# 6. Push your branch
git push origin feat/my-feature

# 7. Open a Pull Request on GitHub
```

### Writing Tests

- **Unit tests** go in `tests/unit/` and mirror the `src/` directory structure.
- **Integration tests** go in `tests/integration/`.
- Use **Vitest** for all tests.
- Aim for meaningful coverage — don't just chase numbers, test behaviour.

```typescript
// tests/unit/features/github/services/github.service.test.ts
import { describe, it, expect, vi } from "vitest";
import { GitHubService } from "@/features/github/services/github.service";

describe("GitHubService", () => {
  describe("getPullRequest", () => {
    it("should return PR details for a valid PR number", async () => {
      // Arrange
      const mockOctokit = {
        rest: {
          pulls: {
            get: vi.fn().mockResolvedValue({
              data: { number: 42, title: "Add feature X", state: "open" },
            }),
          },
        },
      };

      const service = new GitHubService(mockOctokit as any);

      // Act
      const pr = await service.getPullRequest("owner", "repo", 42);

      // Assert
      expect(pr.number).toBe(42);
      expect(pr.state).toBe("open");
    });
  });
});
```

**Testing guidelines:**

| Do                                                 | Don't                                            |
| -------------------------------------------------- | ------------------------------------------------ |
| Test behaviour, not implementation                 | Test private methods directly                    |
| Mock external services (Octokit, Discord API)      | Make real API calls in unit tests                |
| Use descriptive test names                         | Use vague names like `"it works"`                |
| Write integration tests for webhook → queue flows  | Skip testing error paths                         |
| Use `vi.fn()` and `vi.spyOn()` for mocks           | Import test utilities from outside `vitest`      |

### Database Migrations

When you change a Drizzle schema:

```bash
# 1. Generate the migration SQL
pnpm db:generate

# 2. Review the generated SQL in src/db/migrations/
#    Make sure it looks correct — Drizzle generates it, you own it.

# 3. Apply the migration to your local database
pnpm db:migrate

# 4. Commit both the schema change AND the migration file
git add src/db/schema/ src/db/migrations/
git commit -m "feat(db): add labels column to pull_requests table"
```

> **Important:** Always commit the generated migration files. They are the source of truth for database changes and must be reviewed in PRs.

---

## Code Style & Standards

### TypeScript Guidelines

- **Strict mode** — `tsconfig.json` has `strict: true`. Do not use `@ts-ignore` or `any` without a comment explaining why.
- **Prefer `const`** — Use `const` by default. Use `let` only when reassignment is necessary. Never use `var`.
- **Explicit return types** — Add return types to exported functions and public methods.
- **Use Zod for validation** — All external input (env vars, webhook payloads, command options) must be validated with Zod schemas. Never trust raw input.
- **Error handling** — Use custom error classes from `src/utils/errors.ts`. Avoid throwing raw strings or generic `Error` objects.
- **No enums** — Use `as const` objects or union types instead of TypeScript enums (better tree-shaking, better type inference).

```typescript
// ✅ Good
const PR_STATES = {
  OPEN: "open",
  CLOSED: "closed",
  MERGED: "merged",
} as const;

type PrState = (typeof PR_STATES)[keyof typeof PR_STATES];

// ❌ Avoid
enum PrState {
  OPEN = "open",
  CLOSED = "closed",
  MERGED = "merged",
}
```

### Biome (Lint & Format)

We use [Biome](https://biomejs.dev) for both linting and formatting. It replaces ESLint + Prettier with a single, fast tool.

```bash
# Check for lint and format issues
pnpm check

# Auto-fix lint issues
pnpm lint --write

# Auto-format code
pnpm format --write
```

- **Do not** disable Biome rules without approval from a maintainer.
- **Do not** add ESLint, Prettier, or other competing tools to the project.
- The Biome configuration lives in [`biome.json`](biome.json) at the project root.

### File & Folder Naming

| Item                  | Convention                | Example                     |
| --------------------- | ------------------------- | --------------------------- |
| Files                 | `kebab-case.ts`           | `pr.worker.ts`              |
| Files (with context)  | `<name>.<type>.ts`        | `github.service.ts`         |
| Directories           | `kebab-case`              | `features/github/`          |
| Classes               | `PascalCase`              | `GitHubService`             |
| Interfaces / Types    | `PascalCase`              | `PullRequestEvent`          |
| Functions / Variables | `camelCase`               | `getPullRequest`            |
| Constants             | `SCREAMING_SNAKE_CASE`    | `MAX_RETRIES`               |
| Env variables         | `SCREAMING_SNAKE_CASE`    | `GITHUB_WEBHOOK_SECRET`     |
| Database tables       | `snake_case` (plural)     | `pull_requests`             |
| Database columns      | `snake_case`              | `created_at`                |

### Import Order

Imports should be organised in this order, separated by blank lines:

```typescript
// 1. Node built-ins
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// 2. External dependencies
import { Client, GatewayIntentBits } from "discord.js";
import { Hono } from "hono";
import { z } from "zod";

// 3. Internal — absolute imports (using path alias @/)
import { env } from "@/config/env";
import { logger } from "@/core/logger";
import { db } from "@/core/database";

// 4. Internal — relative imports
import { verifyGitHubSignature } from "./verify";
import type { PullRequestEvent } from "./types";
```

Biome enforces import sorting automatically via the `organizeImports` rule.

---

## Commit Conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/). This keeps the git history clean, enables automated changelogs, and makes it easy to understand what changed at a glance.

### Commit Message Format

```
<type>(<scope>): <short summary>

[optional body]

[optional footer(s)]
```

- **type** — What kind of change is this? (see [Types](#types))
- **scope** — What part of the codebase is affected? (see [Scopes](#scopes))
- **short summary** — Imperative, lowercase, no period at the end.

### Types

| Type         | When to use                                              |
| ------------ | -------------------------------------------------------- |
| `feat`       | A new feature                                            |
| `fix`        | A bug fix                                                |
| `docs`       | Documentation only changes                               |
| `style`      | Formatting, white-space, etc. (no logic change)          |
| `refactor`   | Code change that neither fixes a bug nor adds a feature  |
| `perf`       | Performance improvement                                  |
| `test`       | Adding or updating tests                                 |
| `build`      | Build system, dependencies, CI configuration             |
| `ci`         | CI pipeline changes                                      |
| `chore`      | Maintenance tasks (dependency bumps, tooling, etc.)      |
| `revert`     | Reverting a previous commit                              |

### Scopes

| Scope      | Area                                           |
| ---------- | ---------------------------------------------- |
| `github`   | GitHub PR tracking feature                     |
| `discord`  | discord.js client, commands, interactions      |
| `api`      | Hono server, routes, middleware                |
| `db`       | Database schema, migrations, queries           |
| `queue`    | BullMQ workers, jobs, queues                   |
| `config`   | Environment, constants, configuration          |
| `docker`   | Dockerfile, docker-compose                     |
| `deps`     | Dependency changes                             |

You can also use a filename or feature name as a scope when the predefined scopes don't fit.

### Examples

```bash
# Feature
feat(github): add interactive /create-issue modals

# Bug fix
fix(api): validate webhook signature before parsing body

# Documentation
docs(readme): add Docker setup instructions

# Refactor
refactor(discord): extract command registration into separate module

# Build / CI
ci: add Vitest coverage report to GitHub Actions

# Multi-line with body and footer
feat(github): track PR label changes

Labels are now synced when a PR webhook event includes label
additions or removals. The embed is updated in-place using
the stored Discord message ID.

Closes #23
```

---

## Pull Request Process

### Before You Submit

Run through this checklist before opening a PR:

- [ ] **Code compiles** — `pnpm build` succeeds with no errors.
- [ ] **Linter passes** — `pnpm check` reports no issues.
- [ ] **Tests pass** — `pnpm test` shows all green.
- [ ] **New tests added** — If you added/changed functionality, tests are included.
- [ ] **Migrations committed** — If you changed a Drizzle schema, migration files are included.
- [ ] **No `console.log`** — Use the Pino `logger` instead.
- [ ] **No secrets** — Double-check that no tokens, keys, or credentials are committed.
- [ ] **Branch is up to date** — Rebased on the latest `main`.

### PR Title & Description

**PR title** should follow the same [Conventional Commits](#commit-conventions) format:

```
feat(github): add CI check status to PR embeds
```

**PR description** should include:

1. **What** — What does this PR do?
2. **Why** — What problem does it solve? Link the related issue.
3. **How** — Brief explanation of the approach (if non-obvious).
4. **Screenshots** — If there are visual changes (Discord embeds, etc.), include screenshots.
5. **Breaking changes** — If this PR introduces breaking changes, call them out explicitly.

Use this template:

```markdown
## What

Brief description of the change.

## Why

Closes #<issue-number>

## How

Explanation of the approach taken.

## Screenshots

(if applicable)

## Checklist

- [ ] Code compiles (`pnpm build`)
- [ ] Lint passes (`pnpm check`)
- [ ] Tests pass (`pnpm test`)
- [ ] New tests included
- [ ] Migrations committed (if schema changed)
```

### Review Process

1. A maintainer will review your PR, usually within **48 hours**.
2. You may be asked to make changes — this is normal and collaborative.
3. Once approved, a maintainer will **squash and merge** your PR into `main`.
4. Your branch will be automatically deleted after merge.

> **Note:** We squash-merge all PRs. This means your PR title becomes the commit message in `main`, so make it count!

---

## Adding a New Feature Module

NxtGen is built around a modular feature architecture. Here's a step-by-step guide for adding a new feature:

### 1. Create the Feature Directory

```
src/features/<feature-name>/
├── webhooks/          # (optional) Hono routes for incoming webhooks
│   ├── route.ts
│   └── verify.ts
├── workers/           # (optional) BullMQ workers for background processing
│   └── <name>.worker.ts
├── services/          # Business logic, external API clients
│   └── <name>.service.ts
├── embeds/            # Discord embed builders
│   └── <name>.embed.ts
├── schema.ts          # Drizzle table schema for this feature
└── index.ts           # Feature registration (routes, workers, commands)
```

### 2. Define the Database Schema

```typescript
// src/features/<feature-name>/schema.ts
import { pgTable, text, timestamp, serial } from "drizzle-orm/pg-core";

export const myFeatureTable = pgTable("my_feature", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  channelId: text("channel_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

Re-export it from the schema barrel:

```typescript
// src/db/schema/index.ts
export * from "@/features/github/schema";
export * from "@/features/<feature-name>/schema"; // ← add this
```

### 3. Generate and Apply the Migration

```bash
pnpm db:generate
pnpm db:migrate
```

### 4. Add Slash Commands

```typescript
// src/commands/<feature-name>/my-command.ts
import { SlashCommandBuilder } from "discord.js";

export const myCommand = {
  data: new SlashCommandBuilder()
    .setName("myfeature")
    .setDescription("Does something cool"),

  async execute(interaction) {
    await interaction.reply("It works!");
  },
};
```

### 5. Register the Feature

```typescript
// src/features/<feature-name>/index.ts
import type { Hono } from "hono";
import type { Client } from "discord.js";

export function register(app: Hono, client: Client) {
  // Register webhook routes
  // Register BullMQ workers
  // Any feature-level initialisation
}
```

### 6. Wire It Up

Import and call the feature's `register` function from `src/index.ts`.

---

## Architecture Decisions

Key architectural decisions and their rationale:

| Decision                      | Rationale                                                                                                   |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Webhooks over polling**     | Real-time, lower API usage, no rate-limit concerns. BullMQ is available as a fallback for periodic syncs.  |
| **BullMQ for job processing** | Decouples webhook receipt from processing. Provides retries, delays, priorities, and scheduled jobs.         |
| **Feature-module pattern**    | Each feature is self-contained. New features don't touch existing code. Easy to enable/disable.             |
| **Zod everywhere**            | Every boundary (env, webhook payloads, command inputs) is validated at runtime. Catches issues early.       |
| **Drizzle over Prisma**       | SQL-first, thinner abstraction, better raw query support, smaller bundle size.                              |
| **Biome over ESLint**         | Single tool for lint + format. 10-100x faster. Less configuration overhead.                                |
| **Pino over Winston**         | Orders of magnitude faster. Structured JSON logs by default. Better for production observability.           |
| **Hono over Express**         | Lighter, faster, modern API, better TypeScript support, built-in middleware ecosystem.                      |

---

## Community

- **Issues** — [GitHub Issues](../../issues) for bug reports and feature requests.
- **Discussions** — [GitHub Discussions](../../discussions) for questions, ideas, and general conversation.
- **Pull Requests** — [GitHub PRs](../../pulls) for code contributions.

---

<div align="center">

**Thank you for helping make NxtGen better! 🚀**

</div>
