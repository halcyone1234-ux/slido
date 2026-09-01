const path = require('path')
const fs = require('fs')
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const env = require('./config/env')
const roomsRouter = require('./routes/rooms')
const buildHealthRouter = require('./routes/health')
const errorHandler = require('./middleware/errorHandler')

// 正式環境下，後端同時把前端 build 出來的靜態檔（slido-board/dist）一起服務，
// 這樣前端、API、WebSocket 全部同源，免去跨網域 CORS / WS Origin 設定。
// dist 不存在（例如純開發、前端由 vite dev server 提供）時就跳過，行為與原本相同。
const FRONTEND_DIST = path.join(__dirname, '..', '..', 'slido-board', 'dist')

function buildApp(wsServerStats) {
  const app = express()
  // 服務 SPA 時關閉 helmet 的 CSP，否則預設 default-src 'self' 會擋掉
  // WebSocket 連線與 QR 的 data: 圖片；其餘 helmet 防護維持開啟。
  app.use(helmet({ contentSecurityPolicy: false }))
  app.use(cors({ origin: env.corsOrigin }))
  app.use(express.json({ limit: '10kb' }))

  app.use('/api', buildHealthRouter(wsServerStats))
  app.use('/api', roomsRouter)

  if (fs.existsSync(FRONTEND_DIST)) {
    app.use(express.static(FRONTEND_DIST))
    // SPA fallback：非 /api 的 GET 一律回 index.html，交給前端 hash 路由處理。
    app.get(/^(?!\/api\/).*/, (req, res, next) => {
      if (req.method !== 'GET') return next()
      res.sendFile(path.join(FRONTEND_DIST, 'index.html'))
    })
  }

  app.use(errorHandler)
  return app
}

module.exports = buildApp
