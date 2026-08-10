CREATE TABLE "github_user_links" (
	"discord_id" text PRIMARY KEY NOT NULL,
	"github_username" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "github_pull_requests" ADD COLUMN "is_draft" boolean DEFAULT false NOT NULL;