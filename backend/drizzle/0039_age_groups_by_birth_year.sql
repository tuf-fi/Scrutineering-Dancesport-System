ALTER TABLE `age_groups` ADD `born_from` integer;--> statement-breakpoint
ALTER TABLE `age_groups` ADD `born_to` integer;
--> statement-breakpoint
UPDATE `age_groups` SET
	`born_from` = CASE WHEN `oldest_age` IS NULL THEN NULL ELSE 2026 - `oldest_age` END,
	`born_to` = CASE
		WHEN (SELECT MAX(b.`oldest_age`) FROM `age_groups` b WHERE `age_groups`.`oldest_age` IS NULL OR b.`oldest_age` < `age_groups`.`oldest_age`) IS NULL THEN NULL
		ELSE 2025 - (SELECT MAX(b.`oldest_age`) FROM `age_groups` b WHERE `age_groups`.`oldest_age` IS NULL OR b.`oldest_age` < `age_groups`.`oldest_age`)
	END;
--> statement-breakpoint
ALTER TABLE `age_groups` DROP COLUMN `oldest_age`;
