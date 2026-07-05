exports.up = async function (knex) {
  await knex.schema.createTable('polls', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    t.uuid('room_id').notNullable().references('id').inTable('rooms').onDelete('CASCADE')
    t.text('question').notNullable()
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    t.index(['room_id', 'created_at'], 'idx_polls_room_created')
  })

  await knex.schema.createTable('poll_options', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    t.uuid('poll_id').notNullable().references('id').inTable('polls').onDelete('CASCADE')
    t.string('label', 80).notNullable()
    t.smallint('position').notNullable()
    t.unique(['poll_id', 'position'], { indexName: 'poll_options_position_unique' })
  })

  await knex.schema.createTable('poll_votes', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    t.uuid('poll_id').notNullable().references('id').inTable('polls').onDelete('CASCADE')
    t.uuid('option_id').notNullable().references('id').inTable('poll_options').onDelete('CASCADE')
    t.uuid('participant_id').notNullable().references('id').inTable('participants').onDelete('CASCADE')
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    t.unique(['poll_id', 'participant_id'], { indexName: 'poll_votes_one_per_participant' })
    t.index('option_id', 'idx_poll_votes_option')
  })
}

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('poll_votes')
  await knex.schema.dropTableIfExists('poll_options')
  await knex.schema.dropTableIfExists('polls')
}
