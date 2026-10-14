const knex = require('../database/knex')
const DEFAULT_BANK = require('../data/reviewDefaultQuestions')

const CHOICES = ['A', 'B', 'C', 'D']

// ---------- 記憶體內的 review 狀態 ----------
// {
//   gameId, title, questions: [{ section, text, options: {A,B,C,D}, answer, explain }],
//   status: 'lobby'|'question'|'reveal'|'finished'|'recap',
//   index,                      // 目前題目索引（0-based）
//   answers: { [index]: { [participantId]: 'A'|'B'|'C'|'D' } },
// }

function cleanQuestions(questions) {
  return questions.map((q) => ({
    section: String(q.section || '').trim().slice(0, 80),
    text: String(q.text || '').trim().slice(0, 600),
    options: Object.fromEntries(
      CHOICES.map((c) => [c, String((q.options || {})[c] || '').trim().slice(0, 300)]),
    ),
    answer: CHOICES.includes(q.answer) ? q.answer : 'A',
    explain: String(q.explain || '').trim().slice(0, 600),
  }))
}

async function loadAnswers(gameId) {
  const rows = await knex('review_answers').where({ game_id: gameId })
  const answers = {}
  for (const r of rows) {
    if (!answers[r.question_index]) answers[r.question_index] = {}
    answers[r.question_index][r.participant_id] = r.choice
  }
  return answers
}

function toState(game, answers) {
  return {
    gameId: game.id,
    title: game.title,
    questions: Array.isArray(game.questions) ? game.questions : JSON.parse(game.questions || '[]'),
    status: game.status,
    index: game.current_index,
    answers,
  }
}

async function createGame(roomId, title, questions, status = 'lobby') {
  const [game] = await knex('review_games')
    .insert({
      room_id: roomId,
      title: String(title || '').slice(0, 120),
      questions: JSON.stringify(cleanQuestions(questions)),
      status,
      current_index: 0,
    })
    .returning('*')
  return toState(game, {})
}

async function loadLatest(roomId) {
  const game = await knex('review_games')
    .where({ room_id: roomId })
    .orderBy('created_at', 'desc')
    .first()
  if (!game) return createGame(roomId, DEFAULT_BANK.title, DEFAULT_BANK.questions)
  return toState(game, await loadAnswers(game.id))
}

async function updateGame(review, patch) {
  const dbPatch = {}
  if (patch.status !== undefined) dbPatch.status = patch.status
  if (patch.index !== undefined) dbPatch.current_index = patch.index
  if (patch.status === 'finished') dbPatch.finished_at = knex.fn.now()
  await knex('review_games').where({ id: review.gameId }).update(dbPatch)
  return { ...review, ...patch }
}

// 主持人覆寫題庫：還在 lobby 就直接改這場；已開打就另開一場新的（舊紀錄保留）。
async function setQuestions(roomId, review, title, questions) {
  const clean = cleanQuestions(questions)
  const cleanTitle = String(title || '').slice(0, 120)
  if (review.status === 'lobby') {
    await knex('review_games')
      .where({ id: review.gameId })
      .update({ title: cleanTitle, questions: JSON.stringify(clean) })
    return { ...review, title: cleanTitle, questions: clean }
  }
  return createGame(roomId, cleanTitle, clean)
}

async function resetToDefault(roomId, review) {
  return setQuestions(roomId, review, DEFAULT_BANK.title, DEFAULT_BANK.questions)
}

// 開始：lobby 直接開打；已結束／進行中則用同一份題庫另開新局（重新比一次）。
async function start(roomId, review) {
  if (review.questions.length === 0) return review
  let current = review
  if (current.status !== 'lobby') {
    current = await createGame(roomId, current.title, current.questions)
  }
  return updateGame(current, { status: 'question', index: 0 })
}

async function end(review) {
  if (review.status !== 'question') return review
  return updateGame(review, { status: 'reveal' })
}

async function next(review) {
  if (review.status !== 'reveal' && review.status !== 'question') return review
  const nextIndex = review.index + 1
  if (nextIndex >= review.questions.length) return updateGame(review, { status: 'finished' })
  return updateGame(review, { status: 'question', index: nextIndex })
}

async function finish(review) {
  if (review.status === 'lobby') return review
  return updateGame(review, { status: 'finished' })
}

// 成績頁點某題回看（加強複習）：不重新開放作答，只重播那題的統計與解析。
async function recap(review, index) {
  if (review.status !== 'finished' && review.status !== 'recap') return review
  if (index < 0 || index >= review.questions.length) return review
  return updateGame(review, { status: 'recap', index })
}

async function results(review) {
  if (review.status !== 'recap') return review
  return updateGame(review, { status: 'finished' })
}

async function reset(roomId, review) {
  return createGame(roomId, review.title, review.questions)
}

// 參與者作答：只收目前這題、作答中、而且還沒答過的（答了就鎖，Kahoot 規則）。
async function answer(review, participantId, index, choice) {
  if (review.status !== 'question' || index !== review.index) return { ok: false, reason: 'closed' }
  const q = review.questions[index]
  if (!q) return { ok: false, reason: 'no_question' }
  const existing = (review.answers[index] || {})[participantId]
  if (existing) return { ok: false, reason: 'locked' }

  const inserted = await knex('review_answers')
    .insert({
      game_id: review.gameId,
      question_index: index,
      participant_id: participantId,
      choice,
      correct: choice === q.answer,
    })
    .onConflict(['game_id', 'question_index', 'participant_id'])
    .ignore()
    .returning('id')
  if (inserted.length === 0) return { ok: false, reason: 'locked' }

  if (!review.answers[index]) review.answers[index] = {}
  review.answers[index][participantId] = choice
  return { ok: true }
}

// ---------- 給前端的視圖 ----------
function countChoices(byParticipant) {
  const counts = { A: 0, B: 0, C: 0, D: 0 }
  for (const c of Object.values(byParticipant || {})) counts[c] = (counts[c] || 0) + 1
  return counts
}

function computeResults(review) {
  const n = review.questions.length
  const scoresById = {}
  const answersById = {}
  review.questions.forEach((q, i) => {
    for (const [pid, choice] of Object.entries(review.answers[i] || {})) {
      if (!answersById[pid]) answersById[pid] = {}
      answersById[pid][i] = choice
      if (scoresById[pid] === undefined) scoresById[pid] = 0
      if (choice === q.answer) scoresById[pid] += 1
    }
  })
  const scores = Object.values(scoresById)
  const distribution = Array.from({ length: n + 1 }, () => 0)
  for (const s of scores) distribution[s] += 1
  const average = scores.length === 0 ? 0 : scores.reduce((a, b) => a + b, 0) / scores.length
  const perQuestion = review.questions.map((q, i) => {
    const counts = countChoices(review.answers[i])
    const answered = CHOICES.reduce((sum, c) => sum + counts[c], 0)
    const correctCount = counts[q.answer] || 0
    return {
      index: i,
      n: i + 1,
      section: q.section,
      text: q.text,
      answer: q.answer,
      counts,
      answered,
      correctRate: answered === 0 ? null : correctCount / answered,
    }
  })
  return {
    total: n,
    participants: scores.length,
    scoresById,
    answersById,
    distribution,
    average,
    perQuestion,
  }
}

function toClientView(review, role) {
  const { status, index } = review
  const q = review.questions[index]
  const showQuestion = Boolean(q) && status !== 'lobby' && status !== 'finished'
  const revealed = status === 'reveal' || status === 'recap'
  const view = {
    gameId: review.gameId,
    title: review.title,
    status,
    index,
    total: review.questions.length,
    question: showQuestion
      ? { n: index + 1, section: q.section, text: q.text, options: q.options }
      : null,
    responses: showQuestion ? review.answers[index] || {} : {},
    answeredCount: showQuestion ? Object.keys(review.answers[index] || {}).length : 0,
    reveal:
      revealed && q
        ? { answer: q.answer, explain: q.explain, counts: countChoices(review.answers[index]) }
        : null,
    results: status === 'finished' || status === 'recap' ? computeResults(review) : null,
  }
  // 題庫（含正解）只給主持人
  if (role === 'presenter') view.bank = { title: review.title, questions: review.questions }
  return view
}

module.exports = {
  loadLatest,
  setQuestions,
  resetToDefault,
  start,
  end,
  next,
  finish,
  recap,
  results,
  reset,
  answer,
  toClientView,
  cleanQuestions,
}
