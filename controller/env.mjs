// Small env-parsing helper shared by every controller entry point
// (server.mjs, reconciler.mjs) so each one parses integer settings the
// same way instead of drifting.
export function integerEnv(name, fallback) {
  const value = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
