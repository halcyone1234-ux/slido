const knex = require('../database/knex')

const DEFAULT_QUESTION = '台灣的首都是台北，對嗎？'

async function loadRoundView(roundId, question) {
  const round = await knex('quiz_rounds').where({ id: roundId }).first()
  const responses = await knex('quiz_responses').where({ quiz_round_id: roundId })
  return {
    questionId: round.quiz_question_id,
    roundId: round.id,
    question,
    responses: Object.fromEntries(responses.map((r) => [r.participant_id, r.choice])),
    endsAt: round.ends_at ? round.ends_at.getTime() : null,
    durationSec: round.duration_sec,
  }
}

async function createQuestionWithRound(roomId, question) {
  const [q] = await knex('quiz_questions').insert({ room_id: roomId, question }).returning('*')
  const [round] = await knex('quiz_rounds').insert({ quiz_question_id: q.id }).returning('*')
  return { question: q, round }
}

async function loadLatest(roomId) {
  let question = await knex('quiz_questions').where({ room_id: roomId }).orderBy('created_at', 'desc').first()
  let round
  if (!question) {
    ;({ question, round } = await createQuestionWithRound(roomId, DEFAULT_QUESTION))
  } else {
    round = await knex('quiz_rounds')
      .where({ quiz_question_id: question.id })
      .orderBy('created_at', 'desc')
      .first()
  }
  return loadRoundView(round.id, question.question)
}

async function setQuestion(roomId, question) {
  const created = await createQuestionWithRound(roomId, question)
  return loadRoundView(created.round.id, created.question.question)
}

async function resetRound(questionId, question) {
  const [round] = await knex('quiz_rounds').insert({ quiz_question_id: questionId }).returning('*')
  return loadRoundView(round.id, question)
}

async function startRound(questionId, question, seconds) {
  const now = new Date()
  const [round] = await knex('quiz_rounds')
    .insert({
      quiz_question_id: questionId,
      duration_sec: seconds,
      started_at: now,
      ends_at: new Date(now.getTime() + seconds * 1000),
    })
    .returning('*')
  return loadRoundView(round.id, question)
}

async function endRound(roundId, question) {
  await knex('quiz_rounds').where({ id: roundId }).update({ ends_at: knex.fn.now() })
  return loadRoundView(roundId, question)
}

async function answer(roundId, participantId, choice) {
  const round = await knex('quiz_rounds').where({ id: roundId }).first()
  if (round.ends_at && round.ends_at.getTime() <= Date.now()) {
    return { ok: false, reason: 'locked' }
  }
  await knex('quiz_responses')
    .insert({ quiz_round_id: roundId, participant_id: participantId, choice })
    .onConflict(['quiz_round_id', 'participant_id'])
    .merge({ choice, answered_at: knex.fn.now() })
  return { ok: true }
}

module.exports = { loadLatest, loadRoundView, setQuestion, resetRound, startRound, endRound, answer }
