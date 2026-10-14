const reviewService = require('../../services/reviewService')
const { broadcastState } = require('../roomState')

function presenterOnly(fn) {
  return async (room, ws, payload) => {
    if (ws.role !== 'presenter') return
    room.review = await fn(room, payload)
    broadcastState(room)
  }
}

const setQuestions = presenterOnly((room, p) =>
  reviewService.setQuestions(room.roomId, room.review, p.title, p.questions),
)
const useDefault = presenterOnly((room) => reviewService.resetToDefault(room.roomId, room.review))
const start = presenterOnly((room) => reviewService.start(room.roomId, room.review))
const end = presenterOnly((room) => reviewService.end(room.review))
const next = presenterOnly((room) => reviewService.next(room.review))
const finish = presenterOnly((room) => reviewService.finish(room.review))
const recap = presenterOnly((room, p) => reviewService.recap(room.review, p.index))
const results = presenterOnly((room) => reviewService.results(room.review))
const reset = presenterOnly((room) => reviewService.reset(room.roomId, room.review))

async function answer(room, ws, payload) {
  if (ws.role !== 'participant') return
  const result = await reviewService.answer(room.review, ws.participantId, payload.index, payload.choice)
  if (!result.ok) return
  broadcastState(room)
}

module.exports = { setQuestions, useDefault, start, end, next, finish, recap, results, reset, answer }
