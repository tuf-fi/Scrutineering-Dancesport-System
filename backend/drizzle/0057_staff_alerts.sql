CREATE TABLE `staff_alert_reads` (
	`alert_id` text NOT NULL,
	`user_id` text NOT NULL,
	`read_at` text NOT NULL,
	PRIMARY KEY(`alert_id`, `user_id`),
	FOREIGN KEY (`alert_id`) REFERENCES `staff_alerts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `staff_alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`roles` text NOT NULL,
	`title` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`link` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `staff_alerts_by_time` ON `staff_alerts` (`created_at`);