CREATE TABLE `redances` (
	`id` text PRIMARY KEY NOT NULL,
	`round_id` text NOT NULL,
	`seq` integer NOT NULL,
	`heat` integer NOT NULL,
	`reason` text NOT NULL,
	`started_by` text NOT NULL,
	`started_at` text NOT NULL,
	`done_at` text,
	`required` text NOT NULL,
	`redone` text DEFAULT '[]' NOT NULL,
	FOREIGN KEY (`round_id`) REFERENCES `rounds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `redances_seq_per_round` ON `redances` (`round_id`,`seq`);