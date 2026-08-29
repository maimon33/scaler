BEGIN;

ALTER TABLE operations
  ADD COLUMN IF NOT EXISTS retention_days INTEGER NOT NULL DEFAULT 30;

ALTER TABLE operations
  DROP CONSTRAINT IF EXISTS operations_retention_days_check;

ALTER TABLE operations
  ADD CONSTRAINT operations_retention_days_check
  CHECK (retention_days BETWEEN 1 AND 3650);

ALTER TABLE schedules
  ADD COLUMN IF NOT EXISTS event_retention_days INTEGER NOT NULL DEFAULT 30;

ALTER TABLE schedules
  DROP CONSTRAINT IF EXISTS schedules_event_retention_days_check;

ALTER TABLE schedules
  ADD CONSTRAINT schedules_event_retention_days_check
  CHECK (event_retention_days BETWEEN 1 AND 3650);

CREATE TABLE IF NOT EXISTS operation_events (
  id BIGSERIAL PRIMARY KEY,
  operation_id BIGINT NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  message TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS operation_events_retention_idx
  ON operation_events (operation_id, occurred_at);

COMMIT;
