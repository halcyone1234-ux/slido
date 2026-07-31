require('dotenv').config({ override: true })

function required(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  host: process.env.HOST || '127.0.0.1',
  port: Number(process.env.PORT || 47243),
  corsOrigin: required('CORS_ORIGIN'),
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
