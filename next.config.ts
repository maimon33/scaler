import type { NextConfig } from 'next';

// The Docker/Kubernetes deployment (Dockerfile, deploy/scaler.yaml, the Helm
// chart) runs this app as a server via `npm run start` and needs the default
// build. The public demo deployment (see
// .github/workflows/deploy-scaler-app-demo.yml) is a static site with no
// backend behind it at all, so it opts into a static export instead — the
// entire dashboard is client-rendered demo data, so nothing is lost.
const nextConfig: NextConfig = {};

if (process.env.SCALER_STATIC_EXPORT === 'true') {
  nextConfig.output = 'export';
}

export default nextConfig;
