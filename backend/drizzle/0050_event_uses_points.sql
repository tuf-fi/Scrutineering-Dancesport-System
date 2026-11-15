ALTER TABLE `events` ADD `uses_points` integer DEFAULT true NOT NULL;--> statement-breakpoint
UPDATE `events` SET `uses_points` = (SELECT `uses_points` FROM `competitions` WHERE `competitions`.`id` = `events`.`competition_id`);--> statement-breakpoint
ALTER TABLE `competitions` DROP COLUMN `uses_points`;
