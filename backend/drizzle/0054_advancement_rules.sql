CREATE TABLE `advancement_rules` (
	`competition_id` text PRIMARY KEY NOT NULL,
	`rules` text NOT NULL,
	FOREIGN KEY (`competition_id`) REFERENCES `competitions`(`id`) ON UPDATE no action ON DELETE cascade
);
