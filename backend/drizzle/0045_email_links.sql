CREATE TABLE `email_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`purpose` text NOT NULL,
	`account` text NOT NULL,
	`account_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `email_tokens_token_hash_unique` ON `email_tokens` (`token_hash`);--> statement-breakpoint
ALTER TABLE `athletes` ADD `email_verified` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `member_accounts` ADD `email_verified` integer DEFAULT true NOT NULL;