const wordcloudService = require('../../services/wordcloudService')
const { broadcastState, send } = require('../roomState')

async function setQuestion(room, ws, payload) {
  if (ws.role !== 'presenter') return
  room.wordcloud = await wordcloudService.setQuestion(room.roomId, payload.question.trim().slice(0, 200))
  broadcastState(room)
}

async function clear(room, ws) {
  if (ws.role !== 'presenter') return
  room.wordcloud = await wordcloudService.clear(room.roomId, room.wordcloud.questionId)
  broadcastState(room)
}

async function submit(room, ws, payload) {
  if (ws.role !== 'participant') return
  const result = await wordcloudService.submit(room.roomId, room.wordcloud.questionId, ws.participantId, String(payload.text || ''))
  if (!result.ok) {
    send(ws, { type: 'wordcloud.rejected', reason: result.reason })
    return
  }
  room.wordcloud.submissions.push(result.submission)
  broadcastState(room)
}

module.exports = { setQuestion, clear, submit }
