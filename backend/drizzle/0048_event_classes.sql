CREATE TABLE `event_classes` (
	`name` text PRIMARY KEY NOT NULL,
	`sort_order` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `event_classes` (`name`, `sort_order`) VALUES ('E1', 0), ('D', 1), ('C', 2), ('B', 3), ('A', 4);
