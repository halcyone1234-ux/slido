const { broadcastState } = require('../roomState')

// 舉手是記憶體即時態（見 roomState.loadRoom 的 room.hands），不寫資料庫。
async function set(room, ws, payload) {
  if (ws.role !== 'participant') return
  if (payload.raised) room.hands.add(ws.participantId)
  else room.hands.delete(ws.participantId)
  broadcastState(room)
}

async function clearAll(room, ws) {
  if (ws.role !== 'presenter') return
  room.hands.clear()
  broadcastState(room)
}

module.exports = { set, clearAll }
