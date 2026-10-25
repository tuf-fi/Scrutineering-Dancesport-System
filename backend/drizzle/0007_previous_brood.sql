CREATE TABLE `program_slots` (
	`id` text PRIMARY KEY NOT NULL,
	`competition_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`kind` text NOT NULL,
	`event_id` text,
	`round_type` text,
	`label` text,
	`minutes` integer NOT NULL,
	FOREIGN KEY (`competition_id`) REFERENCES `competitions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `program_slots_order` ON `program_slots` (`competition_id`,`sequence`);--> statement-breakpoint
ALTER TABLE `competitions` ADD `program_start` text;