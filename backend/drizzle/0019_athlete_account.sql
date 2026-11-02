ALTER TABLE `athletes` ADD `photo` text;--> statement-breakpoint
ALTER TABLE `athletes` ADD `membership_history` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `athletes` ADD `change_request` text;