CREATE TABLE `kind_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`limits` text NOT NULL,
	`sort_order` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `event_kinds` ADD `disciplines` text DEFAULT '["latin","standard"]' NOT NULL;--> statement-breakpoint
ALTER TABLE `event_kinds` ADD `rules` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
INSERT INTO `kind_rules` (`id`, `name`, `limits`, `sort_order`) VALUES
	('beginners_only', 'Beginners only', 'beginners', 0),
	('closed_to_province', 'Closed to one province', 'province', 1);
--> statement-breakpoint
UPDATE `event_kinds` SET `rules` = '["beginners_only"]' WHERE `beginners_only` = 1 AND `closed_to_province` = 0;
--> statement-breakpoint
UPDATE `event_kinds` SET `rules` = '["closed_to_province"]' WHERE `closed_to_province` = 1 AND `beginners_only` = 0;
--> statement-breakpoint
UPDATE `event_kinds` SET `rules` = '["beginners_only","closed_to_province"]' WHERE `closed_to_province` = 1 AND `beginners_only` = 1;
