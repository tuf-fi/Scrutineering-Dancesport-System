ALTER TABLE `entries` ADD `fee` integer;--> statement-breakpoint
ALTER TABLE `entry_requests` ADD `charge` text;--> statement-breakpoint
-- Entries already paid for keep the amount they show today, so a later price change no longer rewrites them
UPDATE `entries` SET `fee` = (SELECT p.`amount_due` FROM `payments` p WHERE p.`id` = `entries`.`payment_id`)
WHERE `late` = 1 AND `payment_id` IS NOT NULL;--> statement-breakpoint
UPDATE `entries` SET `fee` = (
	SELECT CASE WHEN f.`extra` IS NOT NULL AND EXISTS (
		SELECT 1 FROM `entries` o
		JOIN `events` oe ON oe.`id` = o.`event_id`
		JOIN `competition_fees` paid ON paid.`id` = oe.`fee_id`
		JOIN `payments` op ON op.`id` = o.`payment_id`
		WHERE o.`competitor_id` = `entries`.`competitor_id` AND oe.`competition_id` = ev.`competition_id`
			AND paid.`extra` IS NOT NULL AND o.`scratched` = 0
			AND (op.rowid < p.rowid OR (op.rowid = p.rowid AND oe.`number` < ev.`number`))
	) THEN f.`extra` ELSE f.`amount` END
	FROM `events` ev
	JOIN `competition_fees` f ON f.`id` = ev.`fee_id`
	JOIN `payments` p ON p.`id` = `entries`.`payment_id`
	WHERE ev.`id` = `entries`.`event_id`
)
WHERE `late` = 0 AND `payment_id` IS NOT NULL;
