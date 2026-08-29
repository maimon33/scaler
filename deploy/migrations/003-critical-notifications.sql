BEGIN;

ALTER TABLE operations
  ADD COLUMN IF NOT EXISTS actual_replicas INTEGER;

ALTER TABLE operations
  ADD COLUMN IF NOT EXISTS direction TEXT NOT NULL DEFAULT 'unchanged';

ALTER TABLE operations
  ADD COLUMN IF NOT EXISTS critical BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE operations
  ADD COLUMN IF NOT EXISTS critical_reasons TEXT[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE operations
  ADD COLUMN IF NOT EXISTS notification_status TEXT NOT NULL DEFAULT 'not_required';

ALTER TABLE operations
  ADD COLUMN IF NOT EXISTS notification_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS operations_critical_started_idx
  ON operations (critical, started_at DESC);

COMMIT;
