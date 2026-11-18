ALTER TABLE `rounds` ADD `on_floor_at` text;--> statement-breakpoint
UPDATE `rounds` SET `on_floor_at` = COALESCE((SELECT `competitions`.`floor_started_at` FROM `competitions` WHERE `competitions`.`floor_round_id` = `rounds`.`id`), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) WHERE `id` IN (SELECT `floor_round_id` FROM `competitions` WHERE `floor_round_id` IS NOT NULL);--> statement-breakpoint
ALTER TABLE `competitions` DROP COLUMN `floor_round_id`;--> statement-breakpoint
ALTER TABLE `competitions` DROP COLUMN `floor_started_at`;
