ALTER TABLE `athletes` ADD `membership_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `athletes_membership_id_unique` ON `athletes` (`membership_id`);--> statement-breakpoint
ALTER TABLE `coaches` ADD `membership_id` text;--> statement-breakpoint
ALTER TABLE `coaches` ADD `summits` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `coaches_membership_id_unique` ON `coaches` (`membership_id`);--> statement-breakpoint
-- Everyone who has already paid a membership gets an ID, numbered in the order they were added
UPDATE `athletes` SET `membership_id` = 'A-' || printf('%05d', (SELECT count(*) FROM `athletes` a WHERE a.`member_year` IS NOT NULL AND a.`rowid` <= `athletes`.`rowid`)) WHERE `member_year` IS NOT NULL;--> statement-breakpoint
UPDATE `coaches` SET `membership_id` = 'C-' || printf('%05d', (SELECT count(*) FROM `coaches` c WHERE c.`member_year` IS NOT NULL AND c.`rowid` <= `coaches`.`rowid`)) WHERE `member_year` IS NOT NULL;
