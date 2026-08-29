# Scaler UI mock

A deliberately narrow Kubernetes scaling control plane for teams that need safe manual changes, schedules, and a first-class AWS SQS policy without adopting a general-purpose event-driven autoscaling platform.

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

### Initial scope

- discover Deployments, StatefulSets, native HPAs, and their current owner;
- apply guarded manual changes through the Kubernetes `/scale` subresource;
- pause Scaler-owned automation for a bounded manual-override window;
- run timezone-aware replica schedules;
- scale EKS consumers from AWS SQS queue depth using IRSA or EKS Pod Identity;
- record requested, accepted, scheduled, ready, timed-out, and failed operation stages;
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

1. Build and publish the application image as `ghcr.io/maimon33/scaler:latest`, or change the image reference in the manifest.
2. Replace `CHANGE_ME` in the `scaler-secrets` Secret with a strong password. For production, use External Secrets or your cluster's secret manager instead of committing the real value.
3. On EKS, install the EBS CSI driver. On another Kubernetes platform, change `scaler-gp3` to an available storage class and remove the included AWS storage class.
4. If using OIDC/IRSA, uncomment the service-account role annotation and replace its example ARN.

Build and publish the image:

```bash
docker build -t ghcr.io/maimon33/scaler:latest .
docker push ghcr.io/maimon33/scaler:latest
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

The current interface is still a mock frontend. This deployment creates and persists the production history schema and passes the database connection settings to the application. The next implementation step is the focused controller/API described above: native scale operations, ownership detection, schedules, and one SQS policy. It should not expose kube-proxy to the browser in production; the server should use its in-cluster service-account identity.

The schema ConfigMap initializes a new database volume only. Future schema changes should be delivered as numbered migrations rather than editing an already-initialized database in place.
