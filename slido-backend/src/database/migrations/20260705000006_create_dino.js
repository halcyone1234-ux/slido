exports.up = async function (knex) {
  await knex.schema.createTable('dino_rounds', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    t.uuid('room_id').notNullable().references('id').inTable('rooms').onDelete('CASCADE')
    t.timestamp('started_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    t.timestamp('ended_at', { useTz: true })
    t.index(['room_id', 'started_at'], 'idx_dino_rounds_room')
  })

  await knex.schema.createTable('dino_scores', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    t.uuid('dino_round_id').notNullable().references('id').inTable('dino_rounds').onDelete('CASCADE')
    t.uuid('participant_id').notNullable().references('id').inTable('participants').onDelete('CASCADE')
    t.string('display_name', 20).notNullable()
    t.integer('best_score').notNullable().defaultTo(0)
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    t.unique(['dino_round_id', 'participant_id'], { indexName: 'dino_scores_one_per_round' })
  })
}

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('dino_scores')
  await knex.schema.dropTableIfExists('dino_rounds')
}
