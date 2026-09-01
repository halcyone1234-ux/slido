require('dotenv').config({ override: true })

function required(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

// 允許的前端來源。正式部署（如 Render）會自動注入 RENDER_EXTERNAL_URL＝本服務的
// 公開網址；單一服務同源部署時前端 Origin 就等於它，直接拿來用，免手動設 CORS_ORIGIN，
// 也免「網址還沒生成就要先填」的雞生蛋問題。手動設 CORS_ORIGIN 時仍以它為優先。
function resolveCorsOrigin() {
  const origin = process.env.CORS_ORIGIN || process.env.RENDER_EXTERNAL_URL
  if (!origin) throw new Error('Missing required env var: CORS_ORIGIN')
  return origin
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  host: process.env.HOST || '127.0.0.1',
  port: Number(process.env.PORT || 47243),
  corsOrigin: resolveCorsOrigin(),
  db: {
    host: required('DB_HOST'),
    port: Number(process.env.DB_PORT || 5432),
    database: required('DB_NAME'),
    user: required('DB_USER'),
    password: required('DB_PASSWORD'),
    // 雲端託管的 Postgres（如 Neon）強制 SSL；設 DB_SSL=true 才啟用，預設關閉不影響原行為。
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  },
}
