CREATE TABLE `final_tie_decisions` (
	`round_id` text PRIMARY KEY NOT NULL,
	`mode` text NOT NULL,
	`order` text NOT NULL,
	`proposed_by` text NOT NULL,
	`proposed_at` text NOT NULL,
	`confirmed_by` text,
	`confirmed_at` text,
	FOREIGN KEY (`round_id`) REFERENCES `rounds`(`id`) ON UPDATE no action ON DELETE cascade
);
