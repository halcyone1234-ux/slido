// Centralized structured logging — the only place allowed to touch console.*,
// so raw tokens/secrets never leak through an ad-hoc console.log elsewhere.
function line(level, msg, meta) {
  const entry = { level, msg, ts: new Date().toISOString(), ...meta }
  const out = level === 'error' ? console.error : console.log
  out(JSON.stringify(entry))
}

module.exports = {
  info: (msg, meta) => line('info', msg, meta),
  warn: (msg, meta) => line('warn', msg, meta),
  error: (msg, meta) => line('error', msg, meta),
}
