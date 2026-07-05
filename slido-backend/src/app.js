const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const env = require('./config/env')
const roomsRouter = require('./routes/rooms')
const buildHealthRouter = require('./routes/health')
const errorHandler = require('./middleware/errorHandler')

function buildApp(wsServerStats) {
  const app = express()
  app.use(helmet())
  app.use(cors({ origin: env.corsOrigin }))
  app.use(express.json({ limit: '10kb' }))

  app.use('/api', buildHealthRouter(wsServerStats))
  app.use('/api', roomsRouter)

  app.use(errorHandler)
  return app
}

module.exports = buildApp
