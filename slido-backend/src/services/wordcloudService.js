const knex = require('../database/knex')

const SAMPLE_QUESTION = '你今天的心情用一個詞形容？'

async function loadLatest(roomId) {
  let question = await knex('wordcloud_questions')
    .where({ room_id: roomId })
    .orderBy('created_at', 'desc')
    .first()

  if (!question) {
    ;[question] = await knex('wordcloud_questions')
      .insert({ room_id: roomId, question: SAMPLE_QUESTION })
      .returning('*')
  }

  const submissions = await knex('wordcloud_submissions')
    .where({ question_id: question.id })
    .orderBy('created_at', 'asc')

  return {
    questionId: question.id,
    question: question.question,
    submissions: submissions.map((s) => ({ id: s.id, text: s.text, by: s.participant_id, ts: s.created_at.getTime() })),
  }
}

async function setQuestion(roomId, question) {
  const [row] = await knex('wordcloud_questions').insert({ room_id: roomId, question }).returning('*')
  return { questionId: row.id, question: row.question, submissions: [] }
}

async function clear(roomId, questionId) {
  const current = await knex('wordcloud_questions').where({ id: questionId }).first()
  const [row] = await knex('wordcloud_questions')
    .insert({ room_id: roomId, question: current.question })
    .returning('*')
  return { questionId: row.id, question: row.question, submissions: [] }
}

async function submit(roomId, questionId, participantId, text) {
  const clean = text.trim().slice(0, 80)
  if (!clean) return { ok: false, reason: 'empty' }
  try {
    const [row] = await knex('wordcloud_submissions')
      .insert({ question_id: questionId, room_id: roomId, participant_id: participantId, text: clean })
      .returning('*')
    return { ok: true, submission: { id: row.id, text: row.text, by: row.participant_id, ts: row.created_at.getTime() } }
  } catch (err) {
    if (err.code === '23505') return { ok: false, reason: 'already_answered' }
    throw err
  }
}

module.exports = { loadLatest, setQuestion, clear, submit }
