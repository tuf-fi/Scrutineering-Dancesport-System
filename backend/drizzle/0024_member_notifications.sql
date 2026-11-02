CREATE TABLE `member_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`link` text,
	`created_at` text NOT NULL,
	`read_at` text,
	FOREIGN KEY (`member_id`) REFERENCES `member_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `member_notifications_by_member` ON `member_notifications` (`member_id`,`created_at`);