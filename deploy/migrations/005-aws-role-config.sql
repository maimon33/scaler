-- Adds the aws_role_config singleton table backing the Connections panel's
-- "Create a trigger-reader role" flow (GET/PUT /v1/aws/role,
-- POST /v1/aws/role/test in controller/server.mjs).
BEGIN;

CREATE TABLE IF NOT EXISTS aws_role_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  role_arn TEXT,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  verified_identity TEXT,
  verified_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
