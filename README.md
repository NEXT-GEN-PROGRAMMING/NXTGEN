<div align="center">

# NEXTGEN

**A next-generation, multipurpose Discord bot built with TypeScript.**

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node.js-26.x-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Discord.js](https://img.shields.io/badge/discord.js-v14-5865F2?logo=discord&logoColor=white)](https://discord.js.org)
[![pnpm](https://img.shields.io/badge/pnpm-11.x-F69220?logo=pnpm&logoColor=white)](https://pnpm.io)

*Modular by design. Self-hosted. Feature-rich from day one.*

</div>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
  - [1 — Clone the Repository](#1--clone-the-repository)
  - [2 — Install Dependencies](#2--install-dependencies)
  - [3 — Environment Variables](#3--environment-variables)
  - [4 — Infrastructure (PostgreSQL + Redis)](#4--infrastructure-postgresql--redis)
  - [5 — Database Migrations](#5--database-migrations)
  - [6 — Type Check](#6--type-check)
  - [7 — Run the Bot](#7--run-the-bot)
- [Docker](#docker)
- [Project Structure](#project-structure)
- [GitHub PR Tracking](#github-pr-tracking)
  - [How It Works](#how-it-works)
  - [Setting Up the GitHub Webhook](#setting-up-the-github-webhook)
  - [Discord Commands](#discord-commands)
- [Adding New Features](#adding-new-features)
- [Scripts Reference](#scripts-reference)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

**NEXTGEN** is a self-hosted, multipurpose Discord bot designed to grow with your server. It starts with powerful **GitHub PR tracking** — delivering real-time pull request updates straight into your Discord channels — and provides a robust, modular foundation for any feature you want to build next.

Everything is written in **TypeScript**, backed by **PostgreSQL** for persistence, **Redis + BullMQ** for reliable background jobs, and served behind a lightweight **Hono** API for receiving webhooks.

---

## Features

### GitHub PR Tracking

- **Real-time PR notifications** — Receive instant Discord embeds when pull requests are opened, closed, merged, reviewed, or updated.
- **In-place Embed Sync** — When new commits are pushed to a PR, the bot silently updates the original embed in-place instead of spamming the channel.
- **Per-channel configuration** — Link specific GitHub repositories to specific Discord channels via slash commands.
- **Rich status embeds** — See PR title, author, labels, review status, CI checks, and merge state at a glance.
- **Webhook-first architecture** — GitHub pushes events to the bot; no polling, no delays.
- **Secure webhook verification** — All incoming payloads are validated using GitHub's HMAC-SHA256 signatures.

### GitHub Issues Integration

- **Discord Modals** — Instantly create structured Bug Reports and Feature Requests from Discord.
- **Context Menus** — Right-click any message to automatically turn it into an issue, embedding the message content natively.
- **Multi-Repo Support** — Route issues to different GitHub repositories using interactive dropdown selection.
- **Rich Announcements** — Sends an elegant Discord embed with the issue body and metadata once the issue is created.

### Core Platform

- **Slash command framework** — Register and handle Discord application commands with full type safety.
- **Modular feature system** — Each feature is an isolated module with its own routes, commands, workers, and database schema.
- **Background job processing** — BullMQ workers handle async tasks, retries, scheduled jobs, and delayed messages.
- **Structured logging** — Pino-powered JSON logs for easy debugging and observability.
- **Fully containerised** — Docker Compose setup for the bot, PostgreSQL, and Redis.

---

## Architecture

Read the full architecture details and diagram in [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Tech Stack

| Layer              | Stack                          | Why                                                        |
| ------------------ | ------------------------------ | ---------------------------------------------------------- |
| Language           | **TypeScript**                 | Full type safety across the entire stack                   |
| Runtime            | **Node.js**                    | Best ecosystem for Discord bots                            |
| Discord            | **discord.js**                 | Mature, well-supported, excellent TS types                 |
| Package Manager    | **pnpm**                       | Fast, disk-efficient, workspace-friendly                   |
| API / Webhooks     | **Hono**                       | Lightweight server for receiving GitHub webhooks            |
| Database           | **PostgreSQL**                 | Flexible enough for any future feature                     |
| ORM                | **Drizzle ORM**                | Type-safe, lightweight, SQL-first                          |
| Cache / Queues     | **Redis**                      | Pub/sub, rate limits, caching, job queue backend           |
| Background Jobs    | **BullMQ**                     | Async jobs, retries, scheduled tasks, delayed messages     |
| GitHub Integration | **Octokit + GitHub Webhooks**  | Official GitHub API client + push-based event delivery     |
| Validation         | **Zod**                        | Runtime schema validation with TS type inference           |
| Logging            | **Pino**                       | Fast structured JSON logging                               |
| Testing            | **Vitest**                     | Fast, native TS test runner                                |
| Lint / Format      | **Biome**                      | All-in-one linter + formatter (replaces ESLint + Prettier) |
| Containerisation   | **Docker**                     | Reproducible deployments                                   |
| CI                 | **GitHub Actions**             | Natural fit for a GitHub-integrated project                |

---

## Prerequisites

| Tool            | Minimum Version | Install                                         |
| --------------- | --------------- | ----------------------------------------------- |
| **Node.js**     | >=26.x             | [nodejs.org](https://nodejs.org)                |
| **pnpm**        | >=11.x (required)              | `corepack enable && corepack prepare pnpm@latest --activate` |
| **PostgreSQL**  | 18             | [postgresql.org](https://www.postgresql.org) or via Docker |
| **Redis**       | 8              | [redis.io](https://redis.io) or via Docker     |
| **Docker** *(optional)* | 29.7.x+      | [docker.com](https://www.docker.com)            |

You will also need:

- A **Discord Application** with a Bot token — [Discord Developer Portal](https://discord.com/developers/applications)
- A **GitHub account** with permission to create webhooks on the repositories you want to track.

---

## Getting Started

### 1 — Clone the Repository

```bash
git clone https://github.com/NEXT-GEN-PROGRAMMING/community-website
cd NEXTGEN
```

### 2 — Install Dependencies

```bash
pnpm install
```

### 3 — Environment Variables

The application loads and validates all environment variables at startup through `src/config/env.ts` (using Zod). Copy the example file and fill in each value:

```bash
cp .env.example .env
```

```dotenv
# ──────────────────────────────────────
# Discord
# ──────────────────────────────────────
DISCORD_TOKEN=your-bot-token
DISCORD_CLIENT_ID=your-application-client-id
DISCORD_GUILD_ID=your-dev-server-id          # optional — for dev-only command registration

# ──────────────────────────────────────
# Database (used by src/core/database.ts)
# ──────────────────────────────────────
DATABASE_URL=postgresql://NEXTGEN:NEXTGEN@localhost:5432/NEXTGEN

# ──────────────────────────────────────
# Redis (used by src/core/redis.ts)
# ──────────────────────────────────────
REDIS_URL=redis://localhost:6379

# ──────────────────────────────────────
# Hono API Server (used by src/core/server.ts)
# ──────────────────────────────────────
API_PORT=3000
API_HOST=0.0.0.0

# ──────────────────────────────────────
# GitHub Webhooks (verified in src/features/github/webhooks/verify.ts)
# ──────────────────────────────────────
GITHUB_WEBHOOK_SECRET=your-webhook-secret    # used to verify incoming webhook payloads

# ──────────────────────────────────────
# Logging (configures src/core/logger.ts)
# ──────────────────────────────────────
LOG_LEVEL=info                               # trace | debug | info | warn | error | fatal

# ──────────────────────────────────────
# Environment
# ──────────────────────────────────────
NODE_ENV=development
```

> [!IMPORTANT]
> **Never commit your `.env` file.** It is already listed in `.gitignore`. If the Zod schema in `src/config/env.ts` fails validation on startup, the bot will exit with a clear error message telling you which variables are missing or invalid.

### 4 — Infrastructure (PostgreSQL + Redis)

The bot requires PostgreSQL (`src/core/database.ts`) and Redis (`src/core/redis.ts`). The quickest way to get these running is by using the provided `docker-compose.yml` file:

```bash
# Start only the infrastructure services (PostgreSQL and Redis)
docker compose up -d postgres redis
```

Or, if you already have PostgreSQL and Redis running locally without Docker, just make sure `DATABASE_URL` and `REDIS_URL` in your `.env` point to them.

### 5 — Database Migrations

Drizzle ORM manages the database schema. Schemas are defined per-feature (e.g. `src/features/github/schema.ts`) and re-exported through `src/db/schema/index.ts`. The Drizzle config lives in `drizzle.config.ts`.

```bash
# Generate migration SQL from schema definitions
pnpm db:generate

# Apply pending migrations to the database
pnpm db:migrate

# (Optional) Open Drizzle Studio to browse the database
pnpm db:studio
```

### 6 — Type Check

Before running, verify the entire codebase compiles correctly:

```bash
pnpm typecheck
```

This runs `tsc --noEmit` against the `tsconfig.json` — catching type errors without producing output files.

### 7 — Run the Bot

The entry point is `src/index.ts`, which boots up the discord.js client (`src/core/bot.ts`), the Hono API server (`src/core/server.ts`), and all BullMQ workers.

```bash
# Development mode (with hot-reloading)
pnpm dev

# Production mode (Test the compiled build)
pnpm build
node dist/index.js
```

On successful startup you should see output from the Pino logger (`src/core/logger.ts`):

```
[INFO] NEXTGEN bot is online — logged in as NEXTGEN#1234
[INFO] Hono server listening on http://0.0.0.0:3000
[INFO] BullMQ workers started
[INFO] Connected to PostgreSQL
[INFO] Connected to Redis
```

> [!TIP]
> Slash commands are registered via the interaction handler at `src/commands/_handler.ts`. During development, set `DISCORD_GUILD_ID` to register commands instantly to your test server (guild commands update immediately; global commands can take up to an hour).

---

## Docker

The `docker-compose.yml` provides the required infrastructure (PostgreSQL + Redis) to run the bot locally:

```bash
# Start the infrastructure services
docker compose up -d

# Stop everything and remove containers
docker compose down
```

The `docker-compose.yml` defines two services:

| Service      | Port  | Description                    |
| ------------ | ----- | ------------------------------ |
| `postgres`   | 5432  | PostgreSQL database            |
| `redis`      | 6379  | Redis (BullMQ backend + cache) |

> [!TIP]
> For production, put the Hono API server behind a **reverse proxy** (nginx, Caddy, Cloudflare Tunnel) that terminates TLS. GitHub webhooks require HTTPS.

---

## Project Structure

```
NEXTGEN/
├── src/
│   ├── index.ts                  # Entry point — boots bot, API server, and workers
│   ├── config/
│   │   ├── env.ts                # Zod-validated environment variables
│   │   └── constants.ts          # Shared constants (colours, limits, etc.)
│   ├── core/
│   │   ├── bot.ts                # discord.js client setup
│   │   ├── server.ts             # Hono API server setup
│   │   ├── database.ts           # Drizzle + PostgreSQL connection
│   │   ├── redis.ts              # Redis connection
│   │   └── logger.ts             # Pino logger instance
│   ├── commands/                  # Discord slash command definitions
│   │   ├── _handler.ts           # Command router / interaction handler
│   │   └── github/
│   │       ├── track.ts          # /github track <owner/repo> — link repo to channel
│   │       ├── untrack.ts        # /github untrack <owner/repo>
│   │       └── status.ts         # /github status — list tracked repos
│   ├── features/
│   │   └── github/               # GitHub PR Tracking feature module
│   │       ├── webhooks/
│   │       │   ├── route.ts      # POST /webhooks/github — Hono route
│   │       │   └── verify.ts     # HMAC-SHA256 signature verification
│   │       ├── workers/
│   │       │   └── pr.worker.ts  # BullMQ worker — processes PR events
│   │       ├── services/
│   │       │   └── github.service.ts  # Octokit wrapper — fetch PR details
│   │       ├── embeds/
│   │       │   └── pr.embed.ts   # Discord embed builders for PR events
│   │       └── schema.ts         # Drizzle schema for this feature
│   ├── db/
│   │   ├── schema/               # All Drizzle table schemas (re-exported)
│   │   │   └── index.ts
│   │   └── migrations/           # Generated SQL migration files
│   └── utils/
│       ├── embed.ts              # Shared embed helpers
│       └── errors.ts             # Custom error classes
├── tests/
│   ├── unit/
│   └── integration/
├── .env.example
├── .gitignore
├── biome.json                    # Biome linter/formatter config
├── docker-compose.yml
├── Dockerfile
├── drizzle.config.ts             # Drizzle ORM config
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── vitest.config.ts
├── CONTRIBUTING.md
├── LICENSE                       # Apache 2.0
└── README.md
```

> [!NOTE]
> Each **feature** lives under `src/features/<name>/` with its own webhooks, workers, services, embeds, and schema. This keeps the codebase modular — adding a new feature never means touching existing ones.

---

## GitHub PR Tracking

### How It Works

1. **Link a repo** — Use the `/github track` slash command in a Discord channel to associate a GitHub repository with that channel.
2. **Create a webhook** — Register a webhook on the GitHub repository (or organisation) pointing to your bot's public URL.
3. **Receive events** — When a PR is opened, closed, merged, reviewed, or labelled, GitHub sends a webhook payload to `POST /webhooks/github`.
4. **Bot processes the event** — The payload is verified, queued via BullMQ, enriched via Octokit, persisted in PostgreSQL, and an embed is sent to the linked Discord channel.

### Setting Up GitHub OAuth (Optional but Recommended)

If you want users to link their Discord accounts to GitHub (enabling true authorship and @mentions in PR commands), you need to create a GitHub OAuth App.

1. Go to GitHub → **Settings** → **Developer Settings** → **OAuth Apps** → **New OAuth App**.
2. Set the **Homepage URL** to your bot's public domain (e.g. `https://bot.yourdomain.com`).
3. Set the **Authorization callback URL** to: `https://bot.yourdomain.com/auth/github/callback`.
4. Copy the **Client ID** and generate a **Client Secret**.
5. Add these to your `.env` file along with the `PUBLIC_URL` pointing to your domain.

### Setting Up the GitHub Webhook

1. Navigate to your repository on GitHub → **Settings** → **Webhooks** → **Add webhook**.
2. Set the **Payload URL** to:
   ```
   https://<your-domain>/webhooks/github
   ```
3. Set **Content type** to `application/json`.
4. Set the **Secret** to the same value as `GITHUB_WEBHOOK_SECRET` in your `.env`.
5. Under **"Which events would you like to trigger this webhook?"**, select **"Let me select individual events"** and enable:
   - ✅ Pull requests
   - ✅ Pull request reviews
   - ✅ Check runs *(optional — for CI status)*
   - ✅ Check suites *(optional — for CI status)*
6. Click **Add webhook**.

> [!TIP]
> You can also create a single **organisation-level webhook** to cover all repositories in the org.

### Discord Commands

| Command                               | Description                                          |
| ------------------------------------- | ---------------------------------------------------- |
| `/github-setup`                       | Configure the channel for GitHub PR notifications (Admin only) |
| `/github-link`                        | Link your Discord account to your GitHub account via OAuth |
| `/create-issue`                       | Create a new GitHub issue directly from Discord via an interactive modal |
| `/pr-search <query> [state]`          | Search for past PRs by title, author, or commit hash |
| `/pr-stats [username]`                | View a user's PR stats or the global PR leaderboard  |

---

## Adding New Features

NEXTGEN is designed to be extended. To add a new feature:

1. **Create a feature directory** under `src/features/<feature-name>/`.
2. Add your **Drizzle schema** in `src/features/<feature-name>/schema.ts` and re-export it from `src/db/schema/index.ts`.
3. Add **webhook routes** (if needed) in `src/features/<feature-name>/webhooks/`.
4. Add **BullMQ workers** (if needed) in `src/features/<feature-name>/workers/`.
5. Add **slash commands** in `src/commands/<feature-name>/`.
6. Register the feature in `src/index.ts`.

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

---

## Scripts Reference

| Script              | Description                                          |
| ------------------- | ---------------------------------------------------- |
| `pnpm dev`          | Start in development mode with hot-reloading         |
| `pnpm build`        | Compile TypeScript to `dist/`                        |
| `pnpm start`        | Run the compiled production build                    |
| `pnpm typecheck`    | Run `tsc --noEmit` — type-check without emitting JS  |
| `pnpm lint`         | Run Biome linter                                     |
| `pnpm format`       | Run Biome formatter                                  |
| `pnpm check`        | Run Biome lint + format checks                       |
| `pnpm test`         | Run all tests with Vitest                            |
| `pnpm test:watch`   | Run tests in watch mode                              |
| `pnpm test:coverage`| Run tests with coverage report                       |
| `pnpm db:generate`  | Generate Drizzle migration files from schema changes |
| `pnpm db:migrate`   | Apply pending database migrations                    |
| `pnpm db:studio`    | Open Drizzle Studio (database GUI)                   |
| `pnpm db:seed`      | Seed the database with sample data                   |

---

## Roadmap

- [x] Project scaffolding and architecture
- [x] GitHub PR tracking via webhooks (Basic Sync)
- [x] GitHub PR tracking — BullMQ background worker & Octokit enrichment
- [x] GitHub Issues Integration — Discord Modals and Context Menus
- [x] Slash command framework
- [x] Docker Compose setup
- [x] CI/CD pipeline (GitHub Actions)
- [ ] Moderation tools (kick, ban, mute, warn)
- [ ] Welcome messages & auto-role assignment
- [ ] Levelling / XP system
- [ ] Custom embed builder command
- [ ] Scheduled announcements
- [ ] Audit logging

> [!NOTE]
> This roadmap is a living document. Features are added based on community feedback and contributor interest. Have an idea? Open an issue!
> Read [TODO](TODO) for some pre-thought ideas & features.

---

## Contributing

We welcome contributions! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to get started, our code style, commit conventions, and the PR process.

---

## License

This project is licensed under the **Apache License 2.0** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with ❤️ by the NEXTGEN community.**

</div>
