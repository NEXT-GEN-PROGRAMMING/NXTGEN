CREATE TABLE "github_oauth_states" (
	"state" uuid PRIMARY KEY NOT NULL,
	"discord_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "github_user_links" ADD COLUMN "github_access_token" text;