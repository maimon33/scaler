// Structured JSON logging shared by every controller entry point. Critical
// records always carry the customizable `marker` and `emphasis` fields so
// they're greppable in any log pipeline, matching the README's documented
// critical-log contract.
export function createLogger({
  criticalMarker = 'SCALER_CRITICAL',
  criticalEmphasis = '!!! CRITICAL SCALING ISSUE !!!',
} = {}) {
  return function log(level, event, fields = {}) {
    const critical = fields.critical === true;
    const line = {
      timestamp: new Date().toISOString(),
      level: critical ? 'critical' : level,
      event,
      marker: critical ? criticalMarker : undefined,
      emphasis: critical ? criticalEmphasis : undefined,
      ...fields,
    };
    const output = JSON.stringify(line);
    if (critical || level === 'error') console.error(output);
    else if (level === 'warn') console.warn(output);
    else console.log(output);
  };
}
