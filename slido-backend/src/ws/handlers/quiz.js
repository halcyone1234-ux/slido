const quizService = require('../../services/quizService')
const { broadcastState } = require('../roomState')

async function setQuestion(room, ws, payload) {
  if (ws.role !== 'presenter') return
  room.quiz = await quizService.setQuestion(room.roomId, payload.question.trim().slice(0, 200))
  broadcastState(room)
}

async function reset(room, ws) {
  if (ws.role !== 'presenter') return
  room.quiz = await quizService.resetRound(room.quiz.questionId, room.quiz.question)
  broadcastState(room)
}

async function start(room, ws, payload) {
  if (ws.role !== 'presenter') return
  room.quiz = await quizService.startRound(room.quiz.questionId, room.quiz.question, payload.seconds)
  broadcastState(room)
}

async function end(room, ws) {
  if (ws.role !== 'presenter') return
  room.quiz = await quizService.endRound(room.quiz.roundId, room.quiz.question)
  broadcastState(room)
}

async function answer(room, ws, payload) {
  if (ws.role !== 'participant') return
  const result = await quizService.answer(room.quiz.roundId, ws.participantId, payload.choice)
  if (!result.ok) return
  room.quiz.responses[ws.participantId] = payload.choice
  broadcastState(room)
}

module.exports = { setQuestion, reset, start, end, answer }
