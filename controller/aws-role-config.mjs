// Persists the one trigger-reader role ARN this Scaler installation has
// saved, plus the result of the last time it was verified. A singleton row
// (id = 1) — Scaler manages one AWS identity per installation, the same way
// AWS_CREDENTIAL_MODE is one setting for the whole deployment, not one per
// definition.

export async function ensureAwsRoleConfigSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS aws_role_config (
      id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      role_arn TEXT,
      verified BOOLEAN NOT NULL DEFAULT FALSE,
      verified_identity TEXT,
      verified_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

export async function getAwsRoleConfig(pool) {
  const result = await pool.query(
    'SELECT role_arn, verified, verified_identity, verified_at, updated_at FROM aws_role_config WHERE id = 1',
  );
  return result.rows[0] ?? null;
}

/** Saves a new role ARN. Resets verification — a changed ARN hasn't been tested yet. */
export async function saveAwsRoleArn(pool, roleArn) {
  const result = await pool.query(
    `INSERT INTO aws_role_config (id, role_arn, verified, verified_identity, verified_at, updated_at)
     VALUES (1, $1, FALSE, NULL, NULL, NOW())
     ON CONFLICT (id) DO UPDATE SET
       role_arn = EXCLUDED.role_arn,
       verified = FALSE,
       verified_identity = NULL,
       verified_at = NULL,
       updated_at = NOW()
     RETURNING role_arn, verified, verified_identity, verified_at, updated_at`,
    [roleArn],
  );
  return result.rows[0];
}

/**
 * Records a verification result against the currently *saved* role ARN.
 * Testing a different, not-yet-saved candidate ARN never calls this — see
 * server.mjs's handleTestAwsRole, which only persists when the tested ARN
 * matches what's already saved.
 */
export async function recordVerification(
  pool,
  roleArn,
  { verified, identity },
) {
  const result = await pool.query(
    `INSERT INTO aws_role_config (id, role_arn, verified, verified_identity, verified_at, updated_at)
     VALUES (1, $1, $2, $3, NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET
       role_arn = EXCLUDED.role_arn,
       verified = EXCLUDED.verified,
       verified_identity = EXCLUDED.verified_identity,
       verified_at = NOW(),
       updated_at = NOW()
     RETURNING role_arn, verified, verified_identity, verified_at, updated_at`,
    [roleArn, verified, identity ?? null],
  );
  return result.rows[0];
}
