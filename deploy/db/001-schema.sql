-- Canonical fresh-install schema, used to initialize the local Docker
-- Compose Postgres (see compose.yaml) and an RDS instance you provision
-- yourself. This is the same schema embedded inline in the
-- `scaler-database-schema` ConfigMap in deploy/scaler.yaml and
-- deploy/helm/scaler/templates/scaler.yaml, kept there rather than templated
-- from this file so `kubectl apply -f deploy/scaler.yaml` stays a single,
-- dependency-free manifest. If you change one, change all three, and add a
-- numbered file under deploy/migrations/ for existing databases — see
-- deploy/migrations/README.md.
CREATE TABLE IF NOT EXISTS operations (
  id BIGSERIAL PRIMARY KEY,
  request_id UUID NOT NULL UNIQUE,
  cluster_name TEXT NOT NULL,
  namespace TEXT NOT NULL,
  workload_kind TEXT NOT NULL,
  workload_name TEXT NOT NULL,
  source TEXT NOT NULL,
  previous_replicas INTEGER,
  desired_replicas INTEGER NOT NULL CHECK (desired_replicas >= 0),
  actual_replicas INTEGER,
  direction TEXT NOT NULL DEFAULT 'unchanged',
  status TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'timed_out')),
  requested_by TEXT,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),
  retention_days INTEGER NOT NULL DEFAULT 30 CHECK (retention_days BETWEEN 1 AND 3650),
  critical BOOLEAN NOT NULL DEFAULT FALSE,
  critical_reasons TEXT[] NOT NULL DEFAULT '{}'::text[],
  notification_status TEXT NOT NULL DEFAULT 'not_required',
  notification_sent_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS operations_workload_started_idx
  ON operations (cluster_name, namespace, workload_name, started_at DESC);
CREATE INDEX IF NOT EXISTS operations_status_started_idx
  ON operations (status, started_at DESC);
CREATE INDEX IF NOT EXISTS operations_critical_started_idx
  ON operations (critical, started_at DESC);

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

CREATE TABLE IF NOT EXISTS schedules (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  cluster_name TEXT NOT NULL,
  namespace TEXT NOT NULL,
  workload_kind TEXT NOT NULL DEFAULT 'Deployment',
  workload_name TEXT NOT NULL,
  desired_replicas INTEGER NOT NULL CHECK (desired_replicas >= 0),
  cron_expression TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  event_retention_days INTEGER NOT NULL DEFAULT 30 CHECK (event_retention_days BETWEEN 1 AND 3650),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS schedules_enabled_idx
  ON schedules (enabled, cluster_name, namespace);

CREATE TABLE IF NOT EXISTS scaling_suggestions (
  id BIGSERIAL PRIMARY KEY,
  cluster_name TEXT NOT NULL,
  namespace TEXT NOT NULL,
  workload_name TEXT NOT NULL,
  suggested_replicas INTEGER NOT NULL CHECK (suggested_replicas >= 0),
  suggested_start TIMESTAMPTZ,
  reason TEXT NOT NULL,
  confidence NUMERIC(5, 4) CHECK (confidence BETWEEN 0 AND 1),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'accepted', 'dismissed', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS aws_role_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  role_arn TEXT,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  verified_identity TEXT,
  verified_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
