CREATE TABLE `competition_fees` (
	`id` text PRIMARY KEY NOT NULL,
	`competition_id` text NOT NULL,
	`name` text NOT NULL,
	`amount` integer NOT NULL,
	`extra` integer,
	`late` integer,
	`sort_order` integer NOT NULL,
	FOREIGN KEY (`competition_id`) REFERENCES `competitions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `competition_fees_competition` ON `competition_fees` (`competition_id`);--> statement-breakpoint
ALTER TABLE `events` ADD `fee_id` text REFERENCES competition_fees(id) ON DELETE set null;--> statement-breakpoint
-- Each competition gets the prices its events were charged until now, as fees of its own that can be edited or removed
CREATE TABLE `_event_tiers` AS
SELECT e.`id` AS event_id, e.`competition_id`, e.`is_solo`,
	CASE coalesce(k.`fee_mode`, 'standard')
		WHEN 'fixed' THEN 'fixed'
		WHEN 'couple_juvenile' THEN 'coupleJuvenile'
		WHEN 'couple_older' THEN 'coupleOlder'
		ELSE CASE
			WHEN coalesce(g.`juvenile_fee`, 0) = 1 THEN CASE WHEN e.`is_solo` = 1 THEN 'soloJuvenile' ELSE 'coupleJuvenile' END
			ELSE CASE WHEN e.`is_solo` = 1 THEN 'soloOlder' ELSE 'coupleOlder' END
		END
	END AS tier
FROM `events` e
LEFT JOIN `event_kinds` k ON k.`id` = e.`kind`
LEFT JOIN `age_groups` g ON g.`id` = e.`age_group`;--> statement-breakpoint
CREATE TABLE `_old_prices` (tier text, label text, amount integer, extra integer, sort integer);--> statement-breakpoint
INSERT INTO `_old_prices` VALUES
	('soloJuvenile', 'Solo, juvenile', 400, 200, 1),
	('soloOlder', 'Solo, junior and youth', 600, 200, 2),
	('coupleJuvenile', 'Couple, juvenile and inter-elementary', 700, 200, 3),
	('coupleOlder', 'Couple, junior, youth and inter-high school', 850, 250, 4),
	('fixed', 'Ranking and inter-collegiate', 1000, NULL, 5);--> statement-breakpoint
-- The organizer's own prices, where they were saved
UPDATE `_old_prices` SET
	amount = coalesce((SELECT json_extract(`value`, '$.schedule.' || tier || CASE WHEN tier = 'fixed' THEN '' ELSE '.first' END) FROM `settings` WHERE `key` = 'payment_settings' AND json_valid(`value`)), amount),
	extra = CASE WHEN tier = 'fixed' THEN NULL ELSE coalesce((SELECT json_extract(`value`, '$.schedule.' || tier || '.additional') FROM `settings` WHERE `key` = 'payment_settings' AND json_valid(`value`)), extra) END;--> statement-breakpoint
INSERT INTO `competition_fees` (`id`, `competition_id`, `name`, `amount`, `extra`, `late`, `sort_order`)
SELECT DISTINCT
	x.`competition_id` || ':' || x.tier || ':' || x.`is_solo`,
	x.`competition_id`,
	p.label || CASE
		WHEN x.tier = 'fixed' THEN CASE WHEN x.`is_solo` = 1 THEN ' (solo)' ELSE ' (couple)' END
		WHEN x.tier LIKE 'couple%' AND x.`is_solo` = 1 THEN ' (solo events)'
		ELSE ''
	END,
	p.amount,
	p.extra,
	(SELECT json_extract(`value`, CASE WHEN x.`is_solo` = 1 THEN '$.fees.solo' ELSE '$.fees.couple' END) FROM `settings` WHERE `key` = 'payment_settings' AND json_valid(`value`)),
	p.sort * 2 - x.`is_solo`
FROM `_event_tiers` x
JOIN `_old_prices` p ON p.tier = x.tier;--> statement-breakpoint
UPDATE `events` SET `fee_id` = (SELECT x.`competition_id` || ':' || x.tier || ':' || x.`is_solo` FROM `_event_tiers` x WHERE x.event_id = `events`.`id`);--> statement-breakpoint
DROP TABLE `_event_tiers`;--> statement-breakpoint
DROP TABLE `_old_prices`;
