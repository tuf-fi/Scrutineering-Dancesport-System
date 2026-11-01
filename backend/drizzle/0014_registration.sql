CREATE TABLE `coaches` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`member_year` integer,
	`summit_year` integer
);
--> statement-breakpoint
ALTER TABLE `competitors` ADD `details` text;--> statement-breakpoint
ALTER TABLE `events` ADD `kind` text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE `payments` ADD `method` text;