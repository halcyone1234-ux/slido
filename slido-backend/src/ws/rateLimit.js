// Fixed-window per-socket limiters. dino.jump gets its own tighter window since it's
// explicitly a high-frequency live-control signal, distinct from normal actions.
function makeLimiter(limit, windowMs) {
  return () => {
    let count = 0
    let windowStart = Date.now()
    return () => {
      const now = Date.now()
      if (now - windowStart >= windowMs) {
        windowStart = now
        count = 0
      }
      count += 1
      return count <= limit
    }
  }
}

const createGeneralLimiter = makeLimiter(30, 1000)
const createDinoJumpLimiter = makeLimiter(10, 1000)

function attachRateLimiters(ws) {
  ws._generalLimit = createGeneralLimiter()
  ws._dinoJumpLimit = createDinoJumpLimiter()
}

function allowMessage(ws, type) {
  if (type === 'dino.jump') return ws._dinoJumpLimit()
  return ws._generalLimit()
}

module.exports = { attachRateLimiters, allowMessage }
