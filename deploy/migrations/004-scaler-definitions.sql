-- Adds the scaler_definitions table (the persisted scaler.io/v1alpha1
-- contract the reconciler polls) and push_source_state (decaying demand
-- counter for push triggers such as the S3 "Object Created" webhook).
--
-- controller/definitions.mjs also creates these tables with
-- CREATE TABLE IF NOT EXISTS on every controller/events-server boot, so
-- applying this migration is optional but documents the change explicitly,
-- matching the project's numbered-migration convention.
BEGIN;

CREATE TABLE IF NOT EXISTS scaler_definitions (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  namespace TEXT NOT NULL,
  target_kind TEXT NOT NULL DEFAULT 'Deployment',
  target_name TEXT NOT NULL,
  min_replicas INTEGER NOT NULL CHECK (min_replicas >= 0),
  max_replicas INTEGER NOT NULL CHECK (max_replicas >= 1),
  headroom JSONB NOT NULL DEFAULT '{"type":"none","value":0}'::jsonb,
  source_type TEXT NOT NULL,
  source_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  on_source_failure JSONB NOT NULL DEFAULT '{"strategy":"hold-current"}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (namespace, name)
);

CREATE TABLE IF NOT EXISTS push_source_state (
  definition_id BIGINT PRIMARY KEY REFERENCES scaler_definitions(id) ON DELETE CASCADE,
  event_count INTEGER NOT NULL DEFAULT 0,
  last_event_at TIMESTAMPTZ
);

COMMIT;
