ALTER TABLE `staff_users` ADD `totp_secret` text;--> statement-breakpoint
ALTER TABLE `staff_users` ADD `totp_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `staff_users` ADD `totp_last_step` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `staff_users` ADD `totp_recovery` text DEFAULT '[]' NOT NULL;