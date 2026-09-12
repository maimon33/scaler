# Database migrations

Numbered, forward-only SQL files applied on top of the fresh-install schema
(`deploy/db/001-schema.sql`, also embedded in the `scaler-database-schema`
ConfigMap in `deploy/scaler.yaml` and the Helm chart). A brand-new database
never needs them — the fresh-install schema already has every table. They
exist so an **existing** database can catch up.

`controller/server.mjs` and `controller/definitions.mjs` also run
`CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` on
every boot, so a database left behind by an older image will not crash the
app — but its schema won't match a fresh install's `CHECK` constraints and
indexes until you apply the matching migration. Treat these files as the
source of truth for existing databases; the boot-time statements are a safety
net, not a substitute.

## Applying a migration

**Local Docker Compose:**

```bash
docker compose exec -T postgres psql -U scaler -d scaler < deploy/migrations/004-scaler-definitions.sql
```

**In-cluster Postgres:**

```bash
kubectl -n scaler exec -i deployment/scaler-postgres -- psql -U scaler -d scaler < deploy/migrations/004-scaler-definitions.sql
```

**Amazon RDS** (or any external Postgres — see the README's "Using Amazon RDS
instead of in-cluster Postgres" section):

```bash
psql "postgresql://scaler:<password>@<rds-endpoint>:5432/scaler" -f deploy/migrations/004-scaler-definitions.sql
```

Back up first — see the README's "Local development database" section for
the `npm run db:backup` / `npm run db:restore` scripts, or take an RDS
snapshot before applying a migration there.

Apply migrations in order. Each file is idempotent (`IF NOT EXISTS` /
`ADD COLUMN IF NOT EXISTS`), so re-running one you already applied is safe.
