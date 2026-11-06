CREATE TABLE `age_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`short` text NOT NULL,
	`oldest_age` integer,
	`juvenile_fee` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `event_kinds` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`fee_mode` text DEFAULT 'standard' NOT NULL,
	`beginners_only` integer DEFAULT false NOT NULL,
	`closed_to_province` integer DEFAULT false NOT NULL,
	`requires` text DEFAULT '[]' NOT NULL,
	`sort_order` integer NOT NULL
);

--> statement-breakpoint
INSERT INTO `age_groups` (`id`, `name`, `short`, `oldest_age`, `juvenile_fee`) VALUES
	('juvenile_1', 'Juvenile 1', 'JUV 1', 9, 1),
	('juvenile_2', 'Juvenile 2', 'JUV 2', 11, 1),
	('junior_1', 'Junior I', 'JUN 1', 13, 0),
	('junior_2', 'Junior II', 'JUN 2', 15, 0),
	('youth', 'Youth', 'YTH', 18, 0),
	('adult', 'Adult', 'ADT', 34, 0),
	('senior', 'Senior', 'SEN', NULL, 0);
--> statement-breakpoint
INSERT INTO `event_kinds` (`id`, `name`, `fee_mode`, `beginners_only`, `closed_to_province`, `requires`, `sort_order`) VALUES
	('standard', 'Standard', 'standard', 0, 0, '[]', 0),
	('bgb', 'Beginners (BGB)', 'standard', 1, 0, '[]', 1),
	('ranking', 'Ranking', 'fixed', 0, 0, '[]', 2),
	('inter_elementary', 'Inter-elementary', 'couple_juvenile', 0, 0, '[]', 3),
	('inter_high_school', 'Inter-high school', 'couple_older', 0, 0, '[]', 4),
	('inter_collegiate', 'Inter-collegiate', 'fixed', 0, 0, '[]', 5),
	('closed', 'Closed to a province', 'standard', 0, 1, '[]', 6);
