CREATE TRIGGER IF NOT EXISTS "sync_insert_program_slots" AFTER INSERT ON "program_slots"
WHEN (SELECT value FROM settings WHERE key = 'sync_capture') = 'on'
BEGIN
  INSERT INTO outbox (id, entity, entity_id, operation, payload, created_at)
  VALUES (lower(hex(randomblob(16))), 'program_slots', NEW."id", 'upsert', json_object('id', NEW."id", 'competition_id', NEW."competition_id", 'sequence', NEW."sequence", 'kind', NEW."kind", 'event_id', NEW."event_id", 'round_type', NEW."round_type", 'label', NEW."label", 'minutes', NEW."minutes"), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS "sync_update_program_slots" AFTER UPDATE ON "program_slots"
WHEN (SELECT value FROM settings WHERE key = 'sync_capture') = 'on'
BEGIN
  INSERT INTO outbox (id, entity, entity_id, operation, payload, created_at)
  VALUES (lower(hex(randomblob(16))), 'program_slots', NEW."id", 'upsert', json_object('id', NEW."id", 'competition_id', NEW."competition_id", 'sequence', NEW."sequence", 'kind', NEW."kind", 'event_id', NEW."event_id", 'round_type', NEW."round_type", 'label', NEW."label", 'minutes', NEW."minutes"), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS "sync_delete_program_slots" AFTER DELETE ON "program_slots"
WHEN (SELECT value FROM settings WHERE key = 'sync_capture') = 'on'
BEGIN
  INSERT INTO outbox (id, entity, entity_id, operation, payload, created_at)
  VALUES (lower(hex(randomblob(16))), 'program_slots', OLD."id", 'delete', json_object('id', OLD."id", 'competition_id', OLD."competition_id", 'sequence', OLD."sequence", 'kind', OLD."kind", 'event_id', OLD."event_id", 'round_type', OLD."round_type", 'label', OLD."label", 'minutes', OLD."minutes"), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS "sync_insert_program_starts" AFTER INSERT ON "program_starts"
WHEN (SELECT value FROM settings WHERE key = 'sync_capture') = 'on'
BEGIN
  INSERT INTO outbox (id, entity, entity_id, operation, payload, created_at)
  VALUES (lower(hex(randomblob(16))), 'program_starts', NEW."competition_id", 'upsert', json_object('competition_id', NEW."competition_id", 'start', NEW."start"), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS "sync_update_program_starts" AFTER UPDATE ON "program_starts"
WHEN (SELECT value FROM settings WHERE key = 'sync_capture') = 'on'
BEGIN
  INSERT INTO outbox (id, entity, entity_id, operation, payload, created_at)
  VALUES (lower(hex(randomblob(16))), 'program_starts', NEW."competition_id", 'upsert', json_object('competition_id', NEW."competition_id", 'start', NEW."start"), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS "sync_delete_program_starts" AFTER DELETE ON "program_starts"
WHEN (SELECT value FROM settings WHERE key = 'sync_capture') = 'on'
BEGIN
  INSERT INTO outbox (id, entity, entity_id, operation, payload, created_at)
  VALUES (lower(hex(randomblob(16))), 'program_starts', OLD."competition_id", 'delete', json_object('competition_id', OLD."competition_id", 'start', OLD."start"), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END
