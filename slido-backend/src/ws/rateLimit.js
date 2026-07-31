// Fixed-window per-socket limiter shared by all message types.
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

function attachRateLimiters(ws) {
  ws._generalLimit = createGeneralLimiter()
}

function allowMessage(ws) {
  return ws._generalLimit()
}

module.exports = { attachRateLimiters, allowMessage }
