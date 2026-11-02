CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`athlete_id` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`link` text,
	`created_at` text NOT NULL,
	`read_at` text,
	FOREIGN KEY (`athlete_id`) REFERENCES `athletes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notifications_by_athlete` ON `notifications` (`athlete_id`,`created_at`);