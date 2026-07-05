exports.up = async function (knex) {
  await knex.schema.createTable('quiz_questions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    t.uuid('room_id').notNullable().references('id').inTable('rooms').onDelete('CASCADE')
    t.text('question').notNullable()
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    t.index(['room_id', 'created_at'], 'idx_qq_room_created')
  })

  await knex.schema.createTable('quiz_rounds', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    t.uuid('quiz_question_id').notNullable().references('id').inTable('quiz_questions').onDelete('CASCADE')
    t.integer('duration_sec')
    t.timestamp('started_at', { useTz: true })
    t.timestamp('ends_at', { useTz: true })
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    t.index(['quiz_question_id', 'created_at'], 'idx_qr_question_created')
  })

  await knex.schema.createTable('quiz_responses', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    t.uuid('quiz_round_id').notNullable().references('id').inTable('quiz_rounds').onDelete('CASCADE')
    t.uuid('participant_id').notNullable().references('id').inTable('participants').onDelete('CASCADE')
    t.string('choice', 1).notNullable()
    t.timestamp('answered_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    t.unique(['quiz_round_id', 'participant_id'], { indexName: 'quiz_responses_one_per_participant' })
    t.check("choice in ('O','X')")
  })
}

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('quiz_responses')
  await knex.schema.dropTableIfExists('quiz_rounds')
  await knex.schema.dropTableIfExists('quiz_questions')
}
