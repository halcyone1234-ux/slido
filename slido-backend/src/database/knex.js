const knexLib = require('knex')
const env = require('../config/env')

const knex = knexLib({
  client: 'pg',
  connection: env.db,
  pool: { min: 2, max: 10 },
})

module.exports = knex
