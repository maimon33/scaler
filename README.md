# Scaler UI mock

A lightweight control-plane mock for fast Kubernetes scaling. The interface demonstrates manual scaling, second-granularity reconciliation, schedules and suggestions, operation timing and timeout accounting, kube-proxy access, and AWS credential options.

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

Grant only the AWS actions needed by configured trigger sources. Use Kubernetes RBAC to limit scaling access to intended namespaces and workload kinds.
