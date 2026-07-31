require('dotenv').config({ override: true })

const connection = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
}

module.exports = {
  production: {
    client: 'pg',
    connection,
    pool: { min: 2, max: 10 },
    migrations: { directory: './src/database/migrations' },
    seeds: { directory: './src/database/seeds' },
  },
}
