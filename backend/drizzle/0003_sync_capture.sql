CREATE TRIGGER IF NOT EXISTS "sync_insert_events" AFTER INSERT ON "events"
WHEN (SELECT value FROM settings WHERE key = 'sync_capture') = 'on'
BEGIN
  INSERT INTO outbox (id, entity, entity_id, operation, payload, created_at)
  VALUES (lower(hex(randomblob(16))), 'events', NEW."id", 'upsert', json_object('id', NEW."id", 'competition_id', NEW."competition_id", 'number', NEW."number", 'position', NEW."position", 'age_group', NEW."age_group", 'class', NEW."class", 'discipline', NEW."discipline", 'dances', NEW."dances", 'is_solo', NEW."is_solo"), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS "sync_update_events" AFTER UPDATE ON "events"
WHEN (SELECT value FROM settings WHERE key = 'sync_capture') = 'on'
BEGIN
  INSERT INTO outbox (id, entity, entity_id, operation, payload, created_at)
  VALUES (lower(hex(randomblob(16))), 'events', NEW."id", 'upsert', json_object('id', NEW."id", 'competition_id', NEW."competition_id", 'number', NEW."number", 'position', NEW."position", 'age_group', NEW."age_group", 'class', NEW."class", 'discipline', NEW."discipline", 'dances', NEW."dances", 'is_solo', NEW."is_solo"), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS "sync_delete_events" AFTER DELETE ON "events"
WHEN (SELECT value FROM settings WHERE key = 'sync_capture') = 'on'
BEGIN
  INSERT INTO outbox (id, entity, entity_id, operation, payload, created_at)
  VALUES (lower(hex(randomblob(16))), 'events', OLD."id", 'delete', json_object('id', OLD."id", 'competition_id', OLD."competition_id", 'number', OLD."number", 'position', OLD."position", 'age_group', OLD."age_group", 'class', OLD."class", 'discipline', OLD."discipline", 'dances', OLD."dances", 'is_solo', OLD."is_solo"), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS "sync_insert_competitors" AFTER INSERT ON "competitors"
WHEN (SELECT value FROM settings WHERE key = 'sync_capture') = 'on'
BEGIN
  INSERT INTO outbox (id, entity, entity_id, operation, payload, created_at)
  VALUES (lower(hex(randomblob(16))), 'competitors', NEW."id", 'upsert', json_object('id', NEW."id", 'names', NEW."names", 'age_group', NEW."age_group", 'birth_date', NEW."birth_date", 'back_number', NEW."back_number", 'club_id', NEW."club_id"), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS "sync_update_competitors" AFTER UPDATE ON "competitors"
WHEN (SELECT value FROM settings WHERE key = 'sync_capture') = 'on'
BEGIN
  INSERT INTO outbox (id, entity, entity_id, operation, payload, created_at)
  VALUES (lower(hex(randomblob(16))), 'competitors', NEW."id", 'upsert', json_object('id', NEW."id", 'names', NEW."names", 'age_group', NEW."age_group", 'birth_date', NEW."birth_date", 'back_number', NEW."back_number", 'club_id', NEW."club_id"), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS "sync_delete_competitors" AFTER DELETE ON "competitors"
WHEN (SELECT value FROM settings WHERE key = 'sync_capture') = 'on'
BEGIN
  INSERT INTO outbox (id, entity, entity_id, operation, payload, created_at)
  VALUES (lower(hex(randomblob(16))), 'competitors', OLD."id", 'delete', json_object('id', OLD."id", 'names', OLD."names", 'age_group', OLD."age_group", 'birth_date', OLD."birth_date", 'back_number', OLD."back_number", 'club_id', OLD."club_id"), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS "sync_insert_payments" AFTER INSERT ON "payments"
WHEN (SELECT value FROM settings WHERE key = 'sync_capture') = 'on'
BEGIN
  INSERT INTO outbox (id, entity, entity_id, operation, payload, created_at)
  VALUES (lower(hex(randomblob(16))), 'payments', NEW."id", 'upsert', json_object('id', NEW."id", 'club_id', NEW."club_id", 'competition_id', NEW."competition_id", 'late', NEW."late", 'amount_due', NEW."amount_due", 'amount_paid', NEW."amount_paid", 'reference_number', NEW."reference_number", 'status', NEW."status", 'rejection_reason', NEW."rejection_reason", 'checked_by', NEW."checked_by", 'checked_at', NEW."checked_at"), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS "sync_update_payments" AFTER UPDATE ON "payments"
WHEN (SELECT value FROM settings WHERE key = 'sync_capture') = 'on'
BEGIN
  INSERT INTO outbox (id, entity, entity_id, operation, payload, created_at)
  VALUES (lower(hex(randomblob(16))), 'payments', NEW."id", 'upsert', json_object('id', NEW."id", 'club_id', NEW."club_id", 'competition_id', NEW."competition_id", 'late', NEW."late", 'amount_due', NEW."amount_due", 'amount_paid', NEW."amount_paid", 'reference_number', NEW."reference_number", 'status', NEW."status", 'rejection_reason', NEW."rejection_reason", 'checked_by', NEW."checked_by", 'checked_at', NEW."checked_at"), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS "sync_delete_payments" AFTER DELETE ON "payments"
WHEN (SELECT value FROM settings WHERE key = 'sync_capture') = 'on'
BEGIN
  INSERT INTO outbox (id, entity, entity_id, operation, payload, created_at)
  VALUES (lower(hex(randomblob(16))), 'payments', OLD."id", 'delete', json_object('id', OLD."id", 'club_id', OLD."club_id", 'competition_id', OLD."competition_id", 'late', OLD."late", 'amount_due', OLD."amount_due", 'amount_paid', OLD."amount_paid", 'reference_number', OLD."reference_number", 'status', OLD."status", 'rejection_reason', OLD."rejection_reason", 'checked_by', OLD."checked_by", 'checked_at', OLD."checked_at"), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS "sync_insert_entries" AFTER INSERT ON "entries"
WHEN (SELECT value FROM settings WHERE key = 'sync_capture') = 'on'
BEGIN
  INSERT INTO outbox (id, entity, entity_id, operation, payload, created_at)
  VALUES (lower(hex(randomblob(16))), 'entries', NEW."id", 'upsert', json_object('id', NEW."id", 'event_id', NEW."event_id", 'competitor_id', NEW."competitor_id", 'scratched', NEW."scratched", 'payment_id', NEW."payment_id", 'late', NEW."late"), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS "sync_update_entries" AFTER UPDATE ON "entries"
WHEN (SELECT value FROM settings WHERE key = 'sync_capture') = 'on'
BEGIN
  INSERT INTO outbox (id, entity, entity_id, operation, payload, created_at)
  VALUES (lower(hex(randomblob(16))), 'entries', NEW."id", 'upsert', json_object('id', NEW."id", 'event_id', NEW."event_id", 'competitor_id', NEW."competitor_id", 'scratched', NEW."scratched", 'payment_id', NEW."payment_id", 'late', NEW."late"), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS "sync_delete_entries" AFTER DELETE ON "entries"
WHEN (SELECT value FROM settings WHERE key = 'sync_capture') = 'on'
BEGIN
  INSERT INTO outbox (id, entity, entity_id, operation, payload, created_at)
  VALUES (lower(hex(randomblob(16))), 'entries', OLD."id", 'delete', json_object('id', OLD."id", 'event_id', OLD."event_id", 'competitor_id', OLD."competitor_id", 'scratched', OLD."scratched", 'payment_id', OLD."payment_id", 'late', OLD."late"), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS "sync_insert_rounds" AFTER INSERT ON "rounds"
WHEN (SELECT value FROM settings WHERE key = 'sync_capture') = 'on'
BEGIN
  INSERT INTO outbox (id, entity, entity_id, operation, payload, created_at)
  VALUES (lower(hex(randomblob(16))), 'rounds', NEW."id", 'upsert', json_object('id', NEW."id", 'event_id', NEW."event_id", 'type', NEW."type", 'position', NEW."position", 'recall_number', NEW."recall_number", 'status', NEW."status", 'published_at', NEW."published_at"), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS "sync_update_rounds" AFTER UPDATE ON "rounds"
WHEN (SELECT value FROM settings WHERE key = 'sync_capture') = 'on'
BEGIN
  INSERT INTO outbox (id, entity, entity_id, operation, payload, created_at)
  VALUES (lower(hex(randomblob(16))), 'rounds', NEW."id", 'upsert', json_object('id', NEW."id", 'event_id', NEW."event_id", 'type', NEW."type", 'position', NEW."position", 'recall_number', NEW."recall_number", 'status', NEW."status", 'published_at', NEW."published_at"), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS "sync_delete_rounds" AFTER DELETE ON "rounds"
WHEN (SELECT value FROM settings WHERE key = 'sync_capture') = 'on'
BEGIN
  INSERT INTO outbox (id, entity, entity_id, operation, payload, created_at)
  VALUES (lower(hex(randomblob(16))), 'rounds', OLD."id", 'delete', json_object('id', OLD."id", 'event_id', OLD."event_id", 'type', OLD."type", 'position', OLD."position", 'recall_number', OLD."recall_number", 'status', OLD."status", 'published_at', OLD."published_at"), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS "sync_insert_heats" AFTER INSERT ON "heats"
WHEN (SELECT value FROM settings WHERE key = 'sync_capture') = 'on'
BEGIN
  INSERT INTO outbox (id, entity, entity_id, operation, payload, created_at)
  VALUES (lower(hex(randomblob(16))), 'heats', NEW."id", 'upsert', json_object('id', NEW."id", 'round_id', NEW."round_id", 'number', NEW."number"), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS "sync_update_heats" AFTER UPDATE ON "heats"
WHEN (SELECT value FROM settings WHERE key = 'sync_capture') = 'on'
BEGIN
  INSERT INTO outbox (id, entity, entity_id, operation, payload, created_at)
  VALUES (lower(hex(randomblob(16))), 'heats', NEW."id", 'upsert', json_object('id', NEW."id", 'round_id', NEW."round_id", 'number', NEW."number"), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS "sync_delete_heats" AFTER DELETE ON "heats"
WHEN (SELECT value FROM settings WHERE key = 'sync_capture') = 'on'
BEGIN
  INSERT INTO outbox (id, entity, entity_id, operation, payload, created_at)
  VALUES (lower(hex(randomblob(16))), 'heats', OLD."id", 'delete', json_object('id', OLD."id", 'round_id', OLD."round_id", 'number', OLD."number"), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS "sync_insert_heat_competitors" AFTER INSERT ON "heat_competitors"
WHEN (SELECT value FROM settings WHERE key = 'sync_capture') = 'on'
BEGIN
  INSERT INTO outbox (id, entity, entity_id, operation, payload, created_at)
  VALUES (lower(hex(randomblob(16))), 'heat_competitors', NEW."heat_id" || ':' || NEW."competitor_id", 'upsert', json_object('heat_id', NEW."heat_id", 'competitor_id', NEW."competitor_id"), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS "sync_update_heat_competitors" AFTER UPDATE ON "heat_competitors"
WHEN (SELECT value FROM settings WHERE key = 'sync_capture') = 'on'
BEGIN
  INSERT INTO outbox (id, entity, entity_id, operation, payload, created_at)
  VALUES (lower(hex(randomblob(16))), 'heat_competitors', NEW."heat_id" || ':' || NEW."competitor_id", 'upsert', json_object('heat_id', NEW."heat_id", 'competitor_id', NEW."competitor_id"), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS "sync_delete_heat_competitors" AFTER DELETE ON "heat_competitors"
WHEN (SELECT value FROM settings WHERE key = 'sync_capture') = 'on'
BEGIN
  INSERT INTO outbox (id, entity, entity_id, operation, payload, created_at)
  VALUES (lower(hex(randomblob(16))), 'heat_competitors', OLD."heat_id" || ':' || OLD."competitor_id", 'delete', json_object('heat_id', OLD."heat_id", 'competitor_id', OLD."competitor_id"), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS "sync_insert_submissions" AFTER INSERT ON "submissions"
WHEN (SELECT value FROM settings WHERE key = 'sync_capture') = 'on'
BEGIN
  INSERT INTO outbox (id, entity, entity_id, operation, payload, created_at)
  VALUES (lower(hex(randomblob(16))), 'submissions', NEW."round_id" || ':' || NEW."adjudicator_id", 'upsert', json_object('round_id', NEW."round_id", 'adjudicator_id', NEW."adjudicator_id", 'submitted_at', NEW."submitted_at", 'entered_by', NEW."entered_by"), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS "sync_update_submissions" AFTER UPDATE ON "submissions"
WHEN (SELECT value FROM settings WHERE key = 'sync_capture') = 'on'
BEGIN
  INSERT INTO outbox (id, entity, entity_id, operation, payload, created_at)
  VALUES (lower(hex(randomblob(16))), 'submissions', NEW."round_id" || ':' || NEW."adjudicator_id", 'upsert', json_object('round_id', NEW."round_id", 'adjudicator_id', NEW."adjudicator_id", 'submitted_at', NEW."submitted_at", 'entered_by', NEW."entered_by"), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS "sync_delete_submissions" AFTER DELETE ON "submissions"
WHEN (SELECT value FROM settings WHERE key = 'sync_capture') = 'on'
BEGIN
  INSERT INTO outbox (id, entity, entity_id, operation, payload, created_at)
  VALUES (lower(hex(randomblob(16))), 'submissions', OLD."round_id" || ':' || OLD."adjudicator_id", 'delete', json_object('round_id', OLD."round_id", 'adjudicator_id', OLD."adjudicator_id", 'submitted_at', OLD."submitted_at", 'entered_by', OLD."entered_by"), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS "sync_insert_marks" AFTER INSERT ON "marks"
WHEN (SELECT value FROM settings WHERE key = 'sync_capture') = 'on'
BEGIN
  INSERT INTO outbox (id, entity, entity_id, operation, payload, created_at)
  VALUES (lower(hex(randomblob(16))), 'marks', NEW."id", 'upsert', json_object('id', NEW."id", 'round_id', NEW."round_id", 'adjudicator_id', NEW."adjudicator_id", 'competitor_id', NEW."competitor_id", 'dance', NEW."dance", 'kind', NEW."kind", 'placing', NEW."placing", 'submitted_at', NEW."submitted_at"), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS "sync_update_marks" AFTER UPDATE ON "marks"
WHEN (SELECT value FROM settings WHERE key = 'sync_capture') = 'on'
BEGIN
  INSERT INTO outbox (id, entity, entity_id, operation, payload, created_at)
  VALUES (lower(hex(randomblob(16))), 'marks', NEW."id", 'upsert', json_object('id', NEW."id", 'round_id', NEW."round_id", 'adjudicator_id', NEW."adjudicator_id", 'competitor_id', NEW."competitor_id", 'dance', NEW."dance", 'kind', NEW."kind", 'placing', NEW."placing", 'submitted_at', NEW."submitted_at"), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS "sync_delete_marks" AFTER DELETE ON "marks"
WHEN (SELECT value FROM settings WHERE key = 'sync_capture') = 'on'
BEGIN
  INSERT INTO outbox (id, entity, entity_id, operation, payload, created_at)
  VALUES (lower(hex(randomblob(16))), 'marks', OLD."id", 'delete', json_object('id', OLD."id", 'round_id', OLD."round_id", 'adjudicator_id', OLD."adjudicator_id", 'competitor_id', OLD."competitor_id", 'dance', OLD."dance", 'kind', OLD."kind", 'placing', OLD."placing", 'submitted_at', OLD."submitted_at"), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS "sync_insert_tie_decisions" AFTER INSERT ON "tie_decisions"
WHEN (SELECT value FROM settings WHERE key = 'sync_capture') = 'on'
BEGIN
  INSERT INTO outbox (id, entity, entity_id, operation, payload, created_at)
  VALUES (lower(hex(randomblob(16))), 'tie_decisions', NEW."round_id", 'upsert', json_object('round_id', NEW."round_id", 'choice', NEW."choice", 'proposed_by', NEW."proposed_by", 'proposed_at', NEW."proposed_at", 'confirmed_by', NEW."confirmed_by", 'confirmed_at', NEW."confirmed_at"), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS "sync_update_tie_decisions" AFTER UPDATE ON "tie_decisions"
WHEN (SELECT value FROM settings WHERE key = 'sync_capture') = 'on'
BEGIN
  INSERT INTO outbox (id, entity, entity_id, operation, payload, created_at)
  VALUES (lower(hex(randomblob(16))), 'tie_decisions', NEW."round_id", 'upsert', json_object('round_id', NEW."round_id", 'choice', NEW."choice", 'proposed_by', NEW."proposed_by", 'proposed_at', NEW."proposed_at", 'confirmed_by', NEW."confirmed_by", 'confirmed_at', NEW."confirmed_at"), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS "sync_delete_tie_decisions" AFTER DELETE ON "tie_decisions"
WHEN (SELECT value FROM settings WHERE key = 'sync_capture') = 'on'
BEGIN
  INSERT INTO outbox (id, entity, entity_id, operation, payload, created_at)
  VALUES (lower(hex(randomblob(16))), 'tie_decisions', OLD."round_id", 'delete', json_object('round_id', OLD."round_id", 'choice', OLD."choice", 'proposed_by', OLD."proposed_by", 'proposed_at', OLD."proposed_at", 'confirmed_by', OLD."confirmed_by", 'confirmed_at', OLD."confirmed_at"), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS "sync_insert_results" AFTER INSERT ON "results"
WHEN (SELECT value FROM settings WHERE key = 'sync_capture') = 'on'
BEGIN
  INSERT INTO outbox (id, entity, entity_id, operation, payload, created_at)
  VALUES (lower(hex(randomblob(16))), 'results', NEW."id", 'upsert', json_object('id', NEW."id", 'event_id', NEW."event_id", 'competitor_id', NEW."competitor_id", 'place', NEW."place", 'place_from', NEW."place_from", 'place_to', NEW."place_to", 'stage', NEW."stage", 'approved_by', NEW."approved_by", 'approved_at', NEW."approved_at"), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS "sync_update_results" AFTER UPDATE ON "results"
WHEN (SELECT value FROM settings WHERE key = 'sync_capture') = 'on'
BEGIN
  INSERT INTO outbox (id, entity, entity_id, operation, payload, created_at)
  VALUES (lower(hex(randomblob(16))), 'results', NEW."id", 'upsert', json_object('id', NEW."id", 'event_id', NEW."event_id", 'competitor_id', NEW."competitor_id", 'place', NEW."place", 'place_from', NEW."place_from", 'place_to', NEW."place_to", 'stage', NEW."stage", 'approved_by', NEW."approved_by", 'approved_at', NEW."approved_at"), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS "sync_delete_results" AFTER DELETE ON "results"
WHEN (SELECT value FROM settings WHERE key = 'sync_capture') = 'on'
BEGIN
  INSERT INTO outbox (id, entity, entity_id, operation, payload, created_at)
  VALUES (lower(hex(randomblob(16))), 'results', OLD."id", 'delete', json_object('id', OLD."id", 'event_id', OLD."event_id", 'competitor_id', OLD."competitor_id", 'place', OLD."place", 'place_from', OLD."place_from", 'place_to', OLD."place_to", 'stage', OLD."stage", 'approved_by', OLD."approved_by", 'approved_at', OLD."approved_at"), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS "sync_insert_ranking_points" AFTER INSERT ON "ranking_points"
WHEN (SELECT value FROM settings WHERE key = 'sync_capture') = 'on'
BEGIN
  INSERT INTO outbox (id, entity, entity_id, operation, payload, created_at)
  VALUES (lower(hex(randomblob(16))), 'ranking_points', NEW."id", 'upsert', json_object('id', NEW."id", 'competitor_id', NEW."competitor_id", 'age_group', NEW."age_group", 'class', NEW."class", 'discipline', NEW."discipline", 'competition_id', NEW."competition_id", 'event_id', NEW."event_id", 'points', NEW."points"), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS "sync_update_ranking_points" AFTER UPDATE ON "ranking_points"
WHEN (SELECT value FROM settings WHERE key = 'sync_capture') = 'on'
BEGIN
  INSERT INTO outbox (id, entity, entity_id, operation, payload, created_at)
  VALUES (lower(hex(randomblob(16))), 'ranking_points', NEW."id", 'upsert', json_object('id', NEW."id", 'competitor_id', NEW."competitor_id", 'age_group', NEW."age_group", 'class', NEW."class", 'discipline', NEW."discipline", 'competition_id', NEW."competition_id", 'event_id', NEW."event_id", 'points', NEW."points"), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS "sync_delete_ranking_points" AFTER DELETE ON "ranking_points"
WHEN (SELECT value FROM settings WHERE key = 'sync_capture') = 'on'
BEGIN
  INSERT INTO outbox (id, entity, entity_id, operation, payload, created_at)
  VALUES (lower(hex(randomblob(16))), 'ranking_points', OLD."id", 'delete', json_object('id', OLD."id", 'competitor_id', OLD."competitor_id", 'age_group', OLD."age_group", 'class', OLD."class", 'discipline', OLD."discipline", 'competition_id', OLD."competition_id", 'event_id', OLD."event_id", 'points', OLD."points"), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS "sync_insert_audit_log" AFTER INSERT ON "audit_log"
WHEN (SELECT value FROM settings WHERE key = 'sync_capture') = 'on'
BEGIN
  INSERT INTO outbox (id, entity, entity_id, operation, payload, created_at)
  VALUES (lower(hex(randomblob(16))), 'audit_log', NEW."id", 'upsert', json_object('id', NEW."id", 'actor_id', NEW."actor_id", 'action', NEW."action", 'target', NEW."target", 'before', NEW."before", 'after', NEW."after", 'at', NEW."at"), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS "sync_update_audit_log" AFTER UPDATE ON "audit_log"
WHEN (SELECT value FROM settings WHERE key = 'sync_capture') = 'on'
BEGIN
  INSERT INTO outbox (id, entity, entity_id, operation, payload, created_at)
  VALUES (lower(hex(randomblob(16))), 'audit_log', NEW."id", 'upsert', json_object('id', NEW."id", 'actor_id', NEW."actor_id", 'action', NEW."action", 'target', NEW."target", 'before', NEW."before", 'after', NEW."after", 'at', NEW."at"), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS "sync_delete_audit_log" AFTER DELETE ON "audit_log"
WHEN (SELECT value FROM settings WHERE key = 'sync_capture') = 'on'
BEGIN
  INSERT INTO outbox (id, entity, entity_id, operation, payload, created_at)
  VALUES (lower(hex(randomblob(16))), 'audit_log', OLD."id", 'delete', json_object('id', OLD."id", 'actor_id', OLD."actor_id", 'action', OLD."action", 'target', OLD."target", 'before', OLD."before", 'after', OLD."after", 'at', OLD."at"), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END
