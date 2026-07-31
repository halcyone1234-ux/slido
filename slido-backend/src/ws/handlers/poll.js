const pollService = require('../../services/pollService')
const { broadcastState } = require('../roomState')

async function set(room, ws, payload) {
  if (ws.role !== 'presenter') return
  room.poll = await pollService.setPoll(room.roomId, payload.question, payload.labels, payload.multi)
  broadcastState(room)
}

async function reset(room, ws) {
  if (ws.role !== 'presenter') return
  room.poll = await pollService.reset(room.roomId, room.poll.pollId)
  broadcastState(room)
}

async function vote(room, ws, payload) {
  if (ws.role !== 'participant') return
  const result = await pollService.vote(room.poll.pollId, ws.participantId, payload.optionIds)
  if (!result.ok) return
  room.poll = await pollService.loadPollView(room.poll.pollId)
  broadcastState(room)
}

module.exports = { set, reset, vote }
