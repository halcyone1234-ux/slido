const express = require('express')

function buildHealthRouter(wsServerStats) {
  const router = express.Router()

  router.get('/health', (req, res) => {
    res.json({
      ok: true,
      uptimeSec: Math.round(process.uptime()),
      rooms: wsServerStats.roomCount(),
      connections: wsServerStats.connectionCount(),
    })
  })

  return router
}

module.exports = buildHealthRouter
