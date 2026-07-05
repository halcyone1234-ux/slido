const rateLimit = require('express-rate-limit')

const roomsLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
})

module.exports = { roomsLimiter }
