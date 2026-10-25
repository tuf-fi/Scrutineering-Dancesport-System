-- Offline sync is removed. The capture triggers go first: once the outbox table is gone, any change to these
-- tables would fail inside its trigger. Applied migrations 0003 and 0008 stay as they are.
DROP TRIGGER IF EXISTS "sync_insert_events";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "sync_update_events";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "sync_delete_events";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "sync_insert_competitors";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "sync_update_competitors";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "sync_delete_competitors";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "sync_insert_payments";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "sync_update_payments";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "sync_delete_payments";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "sync_insert_entries";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "sync_update_entries";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "sync_delete_entries";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "sync_insert_rounds";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "sync_update_rounds";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "sync_delete_rounds";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "sync_insert_heats";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "sync_update_heats";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "sync_delete_heats";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "sync_insert_heat_competitors";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "sync_update_heat_competitors";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "sync_delete_heat_competitors";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "sync_insert_submissions";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "sync_update_submissions";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "sync_delete_submissions";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "sync_insert_marks";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "sync_update_marks";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "sync_delete_marks";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "sync_insert_tie_decisions";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "sync_update_tie_decisions";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "sync_delete_tie_decisions";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "sync_insert_results";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "sync_update_results";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "sync_delete_results";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "sync_insert_ranking_points";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "sync_update_ranking_points";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "sync_delete_ranking_points";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "sync_insert_audit_log";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "sync_update_audit_log";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "sync_delete_audit_log";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "sync_insert_program_slots";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "sync_update_program_slots";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "sync_delete_program_slots";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "sync_insert_program_starts";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "sync_update_program_starts";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "sync_delete_program_starts";
--> statement-breakpoint
DROP TABLE `outbox`;--> statement-breakpoint
ALTER TABLE `competitions` DROP COLUMN `held_by`;--> statement-breakpoint
ALTER TABLE `competitions` DROP COLUMN `held_at`;
--> statement-breakpoint
DELETE FROM `settings` WHERE `key` LIKE 'sync_%';
