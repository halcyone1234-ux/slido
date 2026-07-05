const dinoService = require('../../services/dinoService')
const { broadcastDino, broadcastAll, relayDinoJump } = require('../roomState')

async function jump(room, ws) {
  if (ws.role !== 'participant') return
  relayDinoJump(room, ws)
}

async function setActive(room, ws, payload) {
  if (ws.role !== 'presenter') return
  const active = Boolean(payload.active)
  if (active === room.dino.active) return

  if (active) {
    const round = await dinoService.startRound(room.roomId)
    room.dino.active = true
    room.dino.roundId = round.id
    room.dino.scores = []
  } else {
    await dinoService.endRound(room.dino.roundId)
    room.dino.active = false
  }
  broadcastDino(room)
}

async function score(room, ws, payload) {
  if (ws.role !== 'participant' || !room.dino.active || !room.dino.roundId) return
  const value = Math.round(Number(payload.score))
  if (!Number.isFinite(value) || value < 0) return

  const updated = await dinoService.reportScore(room.dino.roundId, ws.participantId, ws.displayName || '玩家', value)
  const existing = room.dino.scores.find((s) => s.id === ws.participantId)
  if (existing) existing.best = updated.best
  else room.dino.scores.push(updated)

  broadcastAll(room, { type: 'dino.scoreUpdate', participantId: updated.id, name: updated.name, best: updated.best })
}

module.exports = { jump, setActive, score }
