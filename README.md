# Scaler UI mock

A deliberately narrow Kubernetes scaling control plane for teams that need safe manual changes, schedules, and a first-class AWS SQS policy without adopting a general-purpose event-driven autoscaling platform.

## Quick install

From the repository root, choose one installer. Each one-liner creates random database and event API credentials with `openssl` and installs into the `scaler` namespace.

**Helm**

```bash
helm upgrade --install scaler ./deploy/helm/scaler --namespace scaler --create-namespace --set-string secrets.databasePassword="$(openssl rand -hex 24)" --set-string secrets.eventsToken="$(openssl rand -hex 32)"
```

**kubectl**

```bash
sed -e "s/DATABASE_PASSWORD: \"CHANGE_ME\"/DATABASE_PASSWORD: \"$(openssl rand -hex 24)\"/" -e "s/SCALER_EVENTS_TOKEN: \"CHANGE_ME\"/SCALER_EVENTS_TOKEN: \"$(openssl rand -hex 32)\"/" deploy/scaler.yaml | kubectl apply -f -
```

**Kustomize**

```bash
kustomize build deploy | sed -e "s/DATABASE_PASSWORD: \"CHANGE_ME\"/DATABASE_PASSWORD: \"$(openssl rand -hex 24)\"/" -e "s/SCALER_EVENTS_TOKEN: \"CHANGE_ME\"/SCALER_EVENTS_TOKEN: \"$(openssl rand -hex 32)\"/" | kubectl apply -f -
```

These defaults use the EKS EBS CSI `gp3` storage class and the `236565801201.dkr.ecr.eu-central-1.amazonaws.com/scaler:latest` image. For production, use a private Helm values file or external secret manager, pin an image tag, configure IRSA or EKS Pod Identity, and set `secrets.slackWebhookUrl` if Slack alerts are required.

## Product premise: simpler on purpose

Scaler is not intended to reproduce KEDA or become a universal metrics adapter. Its premise is that a focused controller can be easier to understand and operate when the supported problem is intentionally small.

The design follows these rules:

- **Use Kubernetes primitives first.** Scaler writes through the workload `/scale` subresource and observes native HPA instead of replacing it.
- **Never create two owners.** A workload already controlled by HPA, KEDA, or another reconciler is read-only until an explicit ownership transfer is reviewed.
- **Support fewer sources well.** The first external policy is AWS SQS on EKS. New sources should be added only with a concrete production need.
- **Keep recommendations advisory.** Suggestions create a reviewable draft; they never change cluster state silently.
- **Separate request time from readiness time.** API acceptance, replica creation, scheduling, and application readiness are reported independently. Scaler does not promise one-second end-to-end scaling.
- **Fail safely and visibly.** Source failures use an explicit per-workload policy such as hold-current or a configured replica floor, and every decision is recorded.

## Product features

### Define a scaler three ways

Scaler definitions are not intended to be GUI-only. The authoring workspace exposes the same policy in three forms:

- **Guided:** structured boxes for the definition, workload, signal, and safety limits;
- **Flow / Composer:** a left-to-right view of signal, demand calculation, and scale action;
- **YAML:** the declarative `scaler.io/v1alpha1` contract for GitOps and CI workflows.

Each definition can reserve optional headroom above calculated demand, expressed as a percentage or a fixed replica count. Headroom is applied before the configured maximum replica limit.

Example percentage-based headroom:

```yaml
apiVersion: scaler.io/v1alpha1
kind: Scaler
metadata:
  name: events-worker-sqs
  namespace: production
spec:
  targetRef:
    kind: Deployment
    name: events-worker
  replicas:
    min: 2
    max: 80
    headroom:
      type: percent
      value: 20
```

For fixed capacity, use `type: replicas`. The controller first calculates source demand, adds the configured headroom, and finally clamps the result to the `min`/`max` range. Headroom belongs to each Scaler definition and does not change any other workload policy.

The current application demonstrates this contract in the interactive mock. Controller-side parsing and reconciliation remain part of the API/controller implementation described below.

### Initial scope

- discover Deployments, StatefulSets, native HPAs, and their current owner;
- apply guarded manual changes through the Kubernetes `/scale` subresource;
- pause Scaler-owned automation for a bounded manual-override window;
- run timezone-aware replica schedules;
- scale EKS consumers from AWS SQS queue depth using IRSA or EKS Pod Identity;
- record requested, accepted, scheduled, ready, timed-out, and failed operation stages;
- set an event-retention period per scale job and purge expired events nightly;
- show advisory recommendations and ownership-transfer plans for review.

### Suggested next features

- configurable SQS source-failure policies and stale-metric detection;
- leader election, rate limiting, jitter, and idempotent reconciliation;
- readiness SLOs based on Pod readiness rather than only the replica field;
- namespace-scoped policy and approval rules;
- Prometheus metrics and Kubernetes audit-log correlation;
- dry-run and rollback plans for schedules and ownership transfers.

### Explicitly out of scope for now

- a generic external-metrics API server;
- dozens of interchangeable trigger providers;
- silently managing workloads owned by HPA or KEDA;
- claiming that a scale request means Pods are ready;
- node provisioning, vertical rightsizing, or application-level concurrency control.

## Run with Docker

```bash
docker compose up --build
```

Open <http://localhost:3000>. The UI uses realistic mock data; controls are interactive but do not modify a cluster.

## Local kube-proxy access

```bash
kubectl proxy --port=8001
```

The Compose setup exposes it to the UI container as `http://host.docker.internal:8001`. Keep this local; do not publish the proxy through an ingress.

## AWS credentials

The deployment is designed for three credential modes:

1. **EKS node credentials:** use the worker instance profile (`AWS_CREDENTIAL_MODE=node`). Simple, but pods on the node may share the role's reach.
2. **OIDC / IRSA (recommended):** create a least-privilege IAM role and attach it to the `scaler` service account.
3. **Static keys for local development only:** pass `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and optionally `AWS_SESSION_TOKEN` as runtime secrets. Never add them to the image or repository.

Example IRSA attachment:

```bash
eksctl create iamserviceaccount \
  --cluster my-cluster \
  --namespace scaler \
  --name scaler \
  --attach-role-arn arn:aws:iam::123456789012:role/scaler \
  --approve
```

Equivalent service-account annotation:

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: scaler
  namespace: scaler
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::123456789012:role/scaler
```

Grant only the AWS actions needed for SQS inspection. Use Kubernetes RBAC to limit scaling access to intended namespaces and workload kinds.

## Deploy to Kubernetes

The complete deployment is in one manifest: [`deploy/scaler.yaml`](deploy/scaler.yaml). It includes:

- the Scaler deployment and internal `ClusterIP` service;
- a dedicated service account with workload-scaling access and read-only HPA discovery;
- PostgreSQL with tables for operations, schedules, and scaling suggestions;
- an encrypted 10 GiB EBS-backed persistent volume claim with `Retain` policy;
- health checks, resource limits, and database network isolation.

PostgreSQL is used instead of SQLite because it safely supports a future move to multiple Scaler replicas. The database is internal-only and its volume survives pod replacement.

Before applying the manifest:

1. Publish the application image as `236565801201.dkr.ecr.eu-central-1.amazonaws.com/scaler:latest`, or change the image reference in the manifest.
2. Replace both `CHANGE_ME` values in `scaler-secrets`: use a strong database password and a separate long random event API token. For production, use External Secrets or your cluster's secret manager instead of committing real values.
3. On EKS, install the EBS CSI driver. On another Kubernetes platform, change `scaler-gp3` to an available storage class and remove the included AWS storage class.
4. If using OIDC/IRSA, uncomment the service-account role annotation and replace its example ARN.

### Automated ECR publishing

The [`Build and Push to ECR`](.github/workflows/build-and-push.yml) workflow runs on every push to `main` and can also be started manually. It follows the repository-standard AWS flow:

- request a GitHub OIDC token and assume `arn:aws:iam::236565801201:role/maimons-infra-github-ssm`;
- authenticate Docker to ECR in `eu-central-1`;
- build the repository `Dockerfile`;
- push `scaler:latest` and `scaler:<git-commit-sha>`.

The ECR repository must already exist, and the IAM role trust policy must allow this GitHub repository. The role also needs ECR authorization and image-push permissions.

To publish manually from a workstation:

```bash
aws ecr get-login-password --region eu-central-1 | docker login --username AWS --password-stdin 236565801201.dkr.ecr.eu-central-1.amazonaws.com
docker build -t 236565801201.dkr.ecr.eu-central-1.amazonaws.com/scaler:latest .
docker push 236565801201.dkr.ecr.eu-central-1.amazonaws.com/scaler:latest
```

If the GHCR package is private, add an image-pull secret to the `scaler` namespace and reference it with `imagePullSecrets` in the Scaler pod specification.

Apply everything:

```bash
kubectl apply -f deploy/scaler.yaml
kubectl -n scaler rollout status deployment/scaler-postgres
kubectl -n scaler rollout status deployment/scaler
```

Keep the UI private and open it through Kubernetes:

```bash
kubectl -n scaler port-forward service/scaler 3000:80
```

Then visit <http://localhost:3000>.

The current interface still uses representative frontend data. The deployment now includes a real internal event API that persists operation results, classifies critical scaling issues, produces structured logs, and sends Slack alerts. The native Kubernetes scale executor, ownership detection, schedules, and SQS policy remain the next controller steps. They should report every result to the event API and use the in-cluster service-account identity; kube-proxy must not be exposed to the browser in production.

The schema ConfigMap initializes a new database volume only. Future schema changes should be delivered as numbered migrations rather than editing an already-initialized database in place.

### Per-job event retention

Each schedule or scaling policy chooses an event-retention period. That value is copied to every operation created by the job, so changing a job affects new operations without silently rewriting the retention contract of previous attempts. The GUI shows the period on every operation and allows pending jobs to be edited.

`operation_events` rows older than their parent operation's `retention_days` value are permanently deleted by the `scaler-retention` CronJob each night. The operation summary itself is retained for auditability. Existing databases must apply [`deploy/migrations/002-operation-event-retention.sql`](deploy/migrations/002-operation-event-retention.sql); editing the initialization ConfigMap alone does not migrate an existing volume.

## Critical logs and Slack notifications

The `events` sidecar listens internally on port `3001`. It records every reported scale operation and marks these conditions critical:

- scale-up or scale-down failed;
- scale-up or scale-down timed out;
- a completed operation exceeded `CRITICAL_SCALE_DURATION_SECONDS`;
- Kubernetes reported success but the actual replica count missed the desired target.

Critical Kubernetes log lines are JSON and always include the customizable `marker`, `emphasis`, and `reasons` fields. For example:

```json
{"level":"critical","event":"CRITICAL_SCALE_OPERATION","marker":"SCALER_CRITICAL","emphasis":"!!! CRITICAL SCALING ISSUE !!!","workload":"events-worker","direction":"up","status":"failed","reasons":["SCALE_UP_FAILED"]}
```

Configure the policy in `scaler-config`:

- `CRITICAL_SCALE_DURATION_SECONDS`: duration after which a completed scale is critical;
- `SLACK_NOTIFICATION_COOLDOWN_SECONDS`: suppress repeated Slack alerts for the same workload during this period;
- `CRITICAL_LOG_MARKER` and `CRITICAL_LOG_EMPHASIS`: text added to every critical log record.

Configure `SLACK_WEBHOOK_URL` in `scaler-secrets` with an incoming Slack webhook. An empty value disables Slack delivery while keeping critical logging and database history enabled. Set `SCALER_EVENTS_TOKEN` to a long random value; all event API calls except `/health` require it as a Bearer token.

Report a completed operation:

```bash
kubectl -n scaler port-forward service/scaler 3001:3001

curl -X POST http://localhost:3001/v1/operations \
  -H "Authorization: Bearer $SCALER_EVENTS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cluster_name": "eks-prod-01",
    "namespace": "production",
    "workload_kind": "Deployment",
    "workload_name": "events-worker",
    "source": "sqs-policy",
    "previous_replicas": 18,
    "desired_replicas": 24,
    "actual_replicas": 18,
    "status": "failed",
    "duration_ms": 10342,
    "error_message": "deployment scale subresource did not converge"
  }'
```

Test the Slack webhook after deployment:

```bash
curl -X POST http://localhost:3001/v1/notifications/slack/test \
  -H "Authorization: Bearer $SCALER_EVENTS_TOKEN"
```

Slack failures never block operation recording. The delivery result is stored as `sent`, `suppressed`, `disabled`, or `failed`, and deduplication uses persisted history so it survives Pod restarts. Existing databases must also apply [`deploy/migrations/003-critical-notifications.sql`](deploy/migrations/003-critical-notifications.sql).
