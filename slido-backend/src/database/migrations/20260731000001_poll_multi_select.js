// 投票支援複選：polls 加 multi 旗標；poll_votes 改為「每人每選項一筆」，
// 讓同一位參與者在複選題可以持有多筆投票（單選行為由服務層以整組覆寫維持）。
exports.up = async function (knex) {
  await knex.schema.alterTable('polls', (t) => {
    t.boolean('multi').notNullable().defaultTo(false)
  })
  await knex.schema.alterTable('poll_votes', (t) => {
    t.dropUnique(null, 'poll_votes_one_per_participant')
    t.unique(['poll_id', 'participant_id', 'option_id'], {
      indexName: 'poll_votes_one_per_option',
    })
  })
}

exports.down = async function (knex) {
  await knex.schema.alterTable('poll_votes', (t) => {
    t.dropUnique(null, 'poll_votes_one_per_option')
    t.unique(['poll_id', 'participant_id'], { indexName: 'poll_votes_one_per_participant' })
  })
  await knex.schema.alterTable('polls', (t) => {
    t.dropColumn('multi')
  })
}
