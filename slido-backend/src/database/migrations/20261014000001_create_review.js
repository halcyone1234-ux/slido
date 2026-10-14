// 期中複習競賽（Kahoot 式四選一）：
// - rooms.mode 新增 'review'
// - review_games：一場競賽＝一列，題庫整份存 jsonb（主持人可改題），status 走
//   lobby → question ⇄ reveal → finished（finished 後可 recap 回看某題）
// - review_answers：每人每題一筆，答了就鎖（Kahoot 規則）
exports.up = async function (knex) {
  // knex 的 t.check() 產生的是未命名的 table-level 約束，Postgres 自動取名
  // （通常是 rooms_check 或 rooms_mode_check）。這裡不猜名字，直接查 catalog 刪掉再重建。
  const { rows } = await knex.raw(`
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'rooms'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%mode%'
  `)
  for (const r of rows) {
    await knex.raw(`ALTER TABLE rooms DROP CONSTRAINT "${r.conname}"`)
  }
  await knex.raw(
    `ALTER TABLE rooms ADD CONSTRAINT rooms_mode_check CHECK (mode in ('wordcloud','poll','quiz','auction','review'))`,
  )

  await knex.schema.createTable('review_games', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    t.uuid('room_id').notNullable().references('id').inTable('rooms').onDelete('CASCADE')
    t.text('title').notNullable().defaultTo('')
    t.jsonb('questions').notNullable().defaultTo('[]')
    t.string('status', 16).notNullable().defaultTo('lobby')
    t.integer('current_index').notNullable().defaultTo(0)
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    t.timestamp('finished_at', { useTz: true })
    t.index(['room_id', 'created_at'], 'idx_review_games_room_created')
    t.check("status in ('lobby','question','reveal','finished','recap')")
  })

  await knex.schema.createTable('review_answers', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    t.uuid('game_id').notNullable().references('id').inTable('review_games').onDelete('CASCADE')
    t.integer('question_index').notNullable()
    t.uuid('participant_id').notNullable().references('id').inTable('participants').onDelete('CASCADE')
    t.string('choice', 1).notNullable()
    t.boolean('correct').notNullable()
    t.timestamp('answered_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    t.unique(['game_id', 'question_index', 'participant_id'], { indexName: 'review_answers_one_per_question' })
    t.check("choice in ('A','B','C','D')")
  })
}

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('review_answers')
  await knex.schema.dropTableIfExists('review_games')
  await knex.raw(`ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_mode_check`)
  await knex('rooms').where({ mode: 'review' }).update({ mode: 'wordcloud' })
  await knex.raw(
    `ALTER TABLE rooms ADD CONSTRAINT rooms_mode_check CHECK (mode in ('wordcloud','poll','quiz','auction'))`,
  )
}
