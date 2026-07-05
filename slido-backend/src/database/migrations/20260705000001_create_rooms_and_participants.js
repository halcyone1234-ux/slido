exports.up = async function (knex) {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS pgcrypto')

  await knex.schema.createTable('rooms', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    t.string('code', 8).notNullable().unique()
    t.string('presenter_token_hash', 64).notNullable().unique()
    t.text('name')
    t.string('mode', 20).notNullable().defaultTo('wordcloud')
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    t.timestamp('ended_at', { useTz: true })
    t.check("mode in ('wordcloud','poll','quiz','auction')")
  })
  await knex.raw('CREATE INDEX idx_rooms_active ON rooms (code) WHERE ended_at IS NULL')

  await knex.schema.createTable('participants', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    t.uuid('room_id').notNullable().references('id').inTable('rooms').onDelete('CASCADE')
    t.string('client_token_hash', 64).notNullable()
    t.text('display_name')
    t.timestamp('first_seen_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    t.timestamp('last_seen_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    t.unique(['room_id', 'client_token_hash'])
  })
  await knex.schema.alterTable('participants', (t) => {
    t.index('room_id', 'idx_participants_room')
  })
}

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('participants')
  await knex.schema.dropTableIfExists('rooms')
}
