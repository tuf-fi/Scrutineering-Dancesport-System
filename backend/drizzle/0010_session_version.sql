ALTER TABLE `adjudicators` ADD `session_version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `clubs` ADD `session_version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `staff_users` ADD `session_version` integer DEFAULT 0 NOT NULL;