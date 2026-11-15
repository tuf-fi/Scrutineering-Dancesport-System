CREATE TABLE `round_sets` (
	`event_id` text NOT NULL,
	`round_type` text NOT NULL,
	`adjudicator_id` text NOT NULL,
	PRIMARY KEY(`event_id`, `round_type`, `adjudicator_id`),
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`adjudicator_id`) REFERENCES `adjudicators`(`id`) ON UPDATE no action ON DELETE cascade
);
