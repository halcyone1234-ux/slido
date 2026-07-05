exports.up = async function (knex) {
  await knex.schema.createTable('wordcloud_questions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    t.uuid('room_id').notNullable().references('id').inTable('rooms').onDelete('CASCADE')
    t.text('question').notNullable()
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    t.index(['room_id', 'created_at'], 'idx_wcq_room_created')
  })

  await knex.schema.createTable('wordcloud_submissions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    t.uuid('question_id').notNullable().references('id').inTable('wordcloud_questions').onDelete('CASCADE')
    t.uuid('room_id').notNullable().references('id').inTable('rooms').onDelete('CASCADE')
    t.uuid('participant_id').notNullable().references('id').inTable('participants').onDelete('CASCADE')
    t.string('text', 80).notNullable()
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    t.unique(['question_id', 'participant_id'], { indexName: 'wcs_one_per_participant' })
    t.index('question_id', 'idx_wcs_question')
  })
}

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('wordcloud_submissions')
  await knex.schema.dropTableIfExists('wordcloud_questions')
}
