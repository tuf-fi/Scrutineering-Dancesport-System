ALTER TABLE `competitions` ADD `hold_results` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `competitions` ADD `results_revealed_at` text;