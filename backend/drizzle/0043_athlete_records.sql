CREATE TABLE `athlete_records` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`birth_date` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`province` text DEFAULT '' NOT NULL,
	`team_id` text,
	`coach_id` text,
	`member_year` integer,
	`membership_id` text,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`coach_id`) REFERENCES `coaches`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `athlete_records_membership_id_unique` ON `athlete_records` (`membership_id`);--> statement-breakpoint
ALTER TABLE `athletes` ADD `claim_id` text;--> statement-breakpoint
ALTER TABLE `athletes` ADD `claimed_at` text;