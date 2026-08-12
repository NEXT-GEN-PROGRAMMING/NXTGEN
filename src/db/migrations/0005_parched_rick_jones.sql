CREATE TABLE "github_pr_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pr_number" integer NOT NULL,
	"repo_full_name" text NOT NULL,
	"channel_id" text NOT NULL,
	"message_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "github_pr_messages_pr_number_repo_full_name_channel_id_unique" UNIQUE("pr_number","repo_full_name","channel_id")
);
