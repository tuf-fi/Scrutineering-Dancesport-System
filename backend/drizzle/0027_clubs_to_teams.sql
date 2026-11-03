ALTER TABLE `clubs` RENAME TO `teams`;--> statement-breakpoint
ALTER TABLE `competitors` RENAME COLUMN `club_id` TO `team_id`;--> statement-breakpoint
ALTER TABLE `payments` RENAME COLUMN `club_id` TO `team_id`;--> statement-breakpoint
ALTER TABLE `athletes` RENAME COLUMN `club_id` TO `team_id`;--> statement-breakpoint
DROP INDEX IF EXISTS `competitors_club`;--> statement-breakpoint
CREATE INDEX `competitors_team` ON `competitors` (`team_id`);
