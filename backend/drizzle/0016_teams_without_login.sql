PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_clubs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`contact_name` text DEFAULT '' NOT NULL,
	`contact_email` text DEFAULT '' NOT NULL,
	`contact_phone` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_clubs`("id", "name", "contact_name", "contact_email", "contact_phone") SELECT "id", "name", "contact_name", "contact_email", "contact_phone" FROM `clubs`;--> statement-breakpoint
DROP TABLE `clubs`;--> statement-breakpoint
ALTER TABLE `__new_clubs` RENAME TO `clubs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;