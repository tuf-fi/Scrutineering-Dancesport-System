CREATE TABLE `adjudicator_pins` (
	`competition_id` text NOT NULL,
	`adjudicator_id` text NOT NULL,
	`pin` text NOT NULL,
	PRIMARY KEY(`competition_id`, `adjudicator_id`),
	FOREIGN KEY (`competition_id`) REFERENCES `competitions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`adjudicator_id`) REFERENCES `adjudicators`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pins_unique_per_competition` ON `adjudicator_pins` (`competition_id`,`pin`);--> statement-breakpoint
CREATE TABLE `adjudicators` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`letter` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `adjudicators_letter` ON `adjudicators` (`letter`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`target` text NOT NULL,
	`before` text,
	`after` text,
	`at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_log_at` ON `audit_log` (`at`);--> statement-breakpoint
CREATE TABLE `clubs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`contact_name` text NOT NULL,
	`contact_email` text NOT NULL,
	`contact_phone` text NOT NULL,
	`password_hash` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clubs_email` ON `clubs` (`contact_email`);--> statement-breakpoint
CREATE TABLE `competitions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`date` text NOT NULL,
	`venue` text NOT NULL,
	`organizer` text NOT NULL,
	`floor_round_id` text
);
--> statement-breakpoint
CREATE TABLE `competitors` (
	`id` text PRIMARY KEY NOT NULL,
	`names` text NOT NULL,
	`age_group` text,
	`birth_date` text,
	`back_number` integer,
	`club_id` text NOT NULL,
	FOREIGN KEY (`club_id`) REFERENCES `clubs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `competitors_back_number` ON `competitors` (`back_number`);--> statement-breakpoint
CREATE INDEX `competitors_club` ON `competitors` (`club_id`);--> statement-breakpoint
CREATE TABLE `entries` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`competitor_id` text NOT NULL,
	`scratched` integer DEFAULT false NOT NULL,
	`payment_id` text,
	`late` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`competitor_id`) REFERENCES `competitors`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `entries_once_per_event` ON `entries` (`event_id`,`competitor_id`);--> statement-breakpoint
CREATE INDEX `entries_payment` ON `entries` (`payment_id`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`competition_id` text NOT NULL,
	`number` integer NOT NULL,
	`position` integer NOT NULL,
	`age_group` text NOT NULL,
	`class` text NOT NULL,
	`discipline` text NOT NULL,
	`dances` text NOT NULL,
	`is_solo` integer NOT NULL,
	FOREIGN KEY (`competition_id`) REFERENCES `competitions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_number_per_competition` ON `events` (`competition_id`,`number`);--> statement-breakpoint
CREATE TABLE `heat_competitors` (
	`heat_id` text NOT NULL,
	`competitor_id` text NOT NULL,
	PRIMARY KEY(`heat_id`, `competitor_id`),
	FOREIGN KEY (`heat_id`) REFERENCES `heats`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`competitor_id`) REFERENCES `competitors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `heats` (
	`id` text PRIMARY KEY NOT NULL,
	`round_id` text NOT NULL,
	`number` integer NOT NULL,
	FOREIGN KEY (`round_id`) REFERENCES `rounds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `heats_number_per_round` ON `heats` (`round_id`,`number`);--> statement-breakpoint
CREATE TABLE `marks` (
	`id` text PRIMARY KEY NOT NULL,
	`round_id` text NOT NULL,
	`adjudicator_id` text NOT NULL,
	`competitor_id` text NOT NULL,
	`dance` text NOT NULL,
	`kind` text NOT NULL,
	`placing` integer,
	`submitted_at` text NOT NULL,
	FOREIGN KEY (`round_id`) REFERENCES `rounds`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`adjudicator_id`) REFERENCES `adjudicators`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`competitor_id`) REFERENCES `competitors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `marks_once` ON `marks` (`round_id`,`adjudicator_id`,`competitor_id`,`dance`);--> statement-breakpoint
CREATE TABLE `outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`entity` text NOT NULL,
	`entity_id` text NOT NULL,
	`operation` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` text NOT NULL,
	`sent_at` text,
	`attempts` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `outbox_unsent` ON `outbox` (`sent_at`);--> statement-breakpoint
CREATE TABLE `panel_members` (
	`panel_id` text NOT NULL,
	`adjudicator_id` text NOT NULL,
	PRIMARY KEY(`panel_id`, `adjudicator_id`),
	FOREIGN KEY (`panel_id`) REFERENCES `panels`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`adjudicator_id`) REFERENCES `adjudicators`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `panels` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `panels_event_id_unique` ON `panels` (`event_id`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`club_id` text NOT NULL,
	`competition_id` text,
	`late` integer DEFAULT false NOT NULL,
	`amount_due` real NOT NULL,
	`amount_paid` real,
	`reference_number` text,
	`receipt` text,
	`status` text NOT NULL,
	`rejection_reason` text,
	`checked_by` text,
	`checked_at` text,
	FOREIGN KEY (`club_id`) REFERENCES `clubs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`competition_id`) REFERENCES `competitions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `points_table` (
	`id` text PRIMARY KEY NOT NULL,
	`place` integer,
	`label` text NOT NULL,
	`points` real NOT NULL,
	`sort_order` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ranking_points` (
	`id` text PRIMARY KEY NOT NULL,
	`competitor_id` text NOT NULL,
	`age_group` text NOT NULL,
	`class` text NOT NULL,
	`discipline` text NOT NULL,
	`competition_id` text NOT NULL,
	`event_id` text NOT NULL,
	`points` real NOT NULL,
	FOREIGN KEY (`competitor_id`) REFERENCES `competitors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`competition_id`) REFERENCES `competitions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ranking_points_once_per_event` ON `ranking_points` (`event_id`,`competitor_id`);--> statement-breakpoint
CREATE INDEX `ranking_points_category` ON `ranking_points` (`age_group`,`class`,`discipline`);--> statement-breakpoint
CREATE TABLE `results` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`competitor_id` text NOT NULL,
	`place` integer NOT NULL,
	`place_from` integer NOT NULL,
	`place_to` integer NOT NULL,
	`stage` text NOT NULL,
	`approved_by` text NOT NULL,
	`approved_at` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`competitor_id`) REFERENCES `competitors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `results_once_per_event` ON `results` (`event_id`,`competitor_id`);--> statement-breakpoint
CREATE TABLE `rounds` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`type` text NOT NULL,
	`position` integer NOT NULL,
	`recall_number` integer,
	`status` text NOT NULL,
	`published_at` text,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rounds_once_per_event` ON `rounds` (`event_id`,`type`);--> statement-breakpoint
CREATE TABLE `staff_users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`username` text NOT NULL,
	`role` text NOT NULL,
	`password_hash` text NOT NULL,
	`disabled` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `staff_users_username_unique` ON `staff_users` (`username`);--> statement-breakpoint
CREATE TABLE `submissions` (
	`round_id` text NOT NULL,
	`adjudicator_id` text NOT NULL,
	`submitted_at` text NOT NULL,
	`entered_by` text,
	PRIMARY KEY(`round_id`, `adjudicator_id`),
	FOREIGN KEY (`round_id`) REFERENCES `rounds`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`adjudicator_id`) REFERENCES `adjudicators`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tie_decisions` (
	`round_id` text PRIMARY KEY NOT NULL,
	`choice` text NOT NULL,
	`proposed_by` text NOT NULL,
	`proposed_at` text NOT NULL,
	`confirmed_by` text,
	`confirmed_at` text,
	FOREIGN KEY (`round_id`) REFERENCES `rounds`(`id`) ON UPDATE no action ON DELETE cascade
);
