CREATE TABLE `entry_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`requester_id` text NOT NULL,
	`requester_role` text NOT NULL,
	`requester_name` text NOT NULL,
	`competitor_id` text NOT NULL,
	`competition_id` text NOT NULL,
	`event_ids` text NOT NULL,
	`total` real NOT NULL,
	`warnings` text DEFAULT '[]' NOT NULL,
	`method` text NOT NULL,
	`reference` text DEFAULT '' NOT NULL,
	`receipt` text NOT NULL,
	`status` text DEFAULT 'waiting' NOT NULL,
	`rejected_reason` text,
	`created_at` text NOT NULL,
	`decided_at` text,
	`decided_by` text,
	FOREIGN KEY (`competitor_id`) REFERENCES `competitors`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`competition_id`) REFERENCES `competitions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `entry_requests_by_requester` ON `entry_requests` (`requester_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `entry_requests_by_status` ON `entry_requests` (`status`);