const logger = require('../utils/logger')

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  logger.error('request_failed', { path: req.path, message: err.message })
  res.status(500).json({ error: 'internal_error' })
}

module.exports = errorHandler
