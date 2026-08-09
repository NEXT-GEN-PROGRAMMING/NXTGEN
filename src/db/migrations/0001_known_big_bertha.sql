CREATE TABLE "github_pull_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pr_number" integer NOT NULL,
	"repo_full_name" text NOT NULL,
	"title" text NOT NULL,
	"author_login" text NOT NULL,
	"author_avatar_url" text,
	"state" text NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "github_pull_requests_pr_number_repo_full_name_unique" UNIQUE("pr_number","repo_full_name")
);
--> statement-breakpoint
CREATE TABLE "github_webhook_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "github_webhook_configs_guild_id_unique" UNIQUE("guild_id")
);
