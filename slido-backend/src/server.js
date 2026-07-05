const http = require('http')
const env = require('./config/env')
const logger = require('./utils/logger')
const buildApp = require('./app')
const { createWsServer, roomCount, connectionCount } = require('./ws')

const app = buildApp({ roomCount, connectionCount })
const server = http.createServer(app)
createWsServer(server)

server.listen(env.port, env.host, () => {
  logger.info('server_listening', { host: env.host, port: env.port })
})

process.on('unhandledRejection', (err) => {
  logger.error('unhandled_rejection', { message: err?.message })
})
