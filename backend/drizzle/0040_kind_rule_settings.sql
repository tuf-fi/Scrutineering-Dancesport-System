ALTER TABLE `kind_rules` ADD `beginners_only` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `kind_rules` ADD `closed_to_province` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `kind_rules` ADD `born_from` integer;--> statement-breakpoint
ALTER TABLE `kind_rules` ADD `born_to` integer;--> statement-breakpoint
ALTER TABLE `kind_rules` ADD `gender` text;
--> statement-breakpoint
UPDATE `kind_rules` SET `beginners_only` = 1 WHERE `limits` = 'beginners';
--> statement-breakpoint
UPDATE `kind_rules` SET `closed_to_province` = 1 WHERE `limits` = 'province';
--> statement-breakpoint
ALTER TABLE `kind_rules` DROP COLUMN `limits`;
