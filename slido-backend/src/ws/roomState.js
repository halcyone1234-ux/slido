const { WebSocket } = require('ws')
const knex = require('../database/knex')
const wordcloudService = require('../services/wordcloudService')
const pollService = require('../services/pollService')
const quizService = require('../services/quizService')
const auctionService = require('../services/auctionService')

const rooms = new Map() // roomId -> RoomState

async function loadRoom(roomId, code) {
  const roomRow = await knex('rooms').where({ id: roomId }).first()
  const wordcloud = await wordcloudService.loadLatest(roomId)
  const poll = await pollService.loadLatest(roomId)
  const quiz = await quizService.loadLatest(roomId)
  const auction = await auctionService.loadFullView(roomId)

  return {
    roomId,
    code,
    mode: roomRow.mode,
    sockets: new Set(),
    wordcloud,
    poll,
    quiz,
    auction,
    hands: new Set(), // participantId 集合；記憶體即時態，斷線自動移除、不進資料庫
    dino: { active: false, roundId: null, scores: [] },
  }
}

async function getRoom(roomId, code) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, await loadRoom(roomId, code))
  }
  return rooms.get(roomId)
}

function toClientState(room) {
  const presence = {}
  const nameById = {}
  for (const sock of room.sockets) {
    if (sock.role === 'participant') {
      presence[sock.participantId] = true
      nameById[sock.participantId] = sock.displayName || '參與者'
    }
  }
  // 只回報「目前仍連線」的舉手者（斷線者已在 close 事件移除，這裡再過濾一次保險）
  const hands = [...(room.hands || [])]
    .filter((id) => nameById[id])
    .map((id) => ({ id, name: nameById[id] }))
  return {
    mode: room.mode,
    question: room.wordcloud.question,
    submissions: room.wordcloud.submissions,
    poll: { question: room.poll.question, options: room.poll.options },
    quiz: {
      question: room.quiz.question,
      responses: room.quiz.responses,
      endsAt: room.quiz.endsAt,
      durationSec: room.quiz.durationSec,
    },
    presence,
    hands,
    auction: {
      status: room.auction.status,
      item: room.auction.item,
      highestBid: room.auction.highestBid,
      highestBidder: room.auction.highestBidder,
      participants: room.auction.participants,
      sold: room.auction.sold,
    },
  }
}

function send(sock, payload) {
  if (sock.readyState === WebSocket.OPEN) sock.send(JSON.stringify(payload))
}

function broadcastAll(room, payload) {
  for (const sock of room.sockets) send(sock, payload)
}

function broadcastState(room) {
  broadcastAll(room, { type: 'state', state: toClientState(room) })
}

function broadcastDino(room) {
  broadcastAll(room, { type: 'dino.state', active: room.dino.active, scores: room.dino.scores })
}

function relayDinoJump(room, fromSocket) {
  for (const sock of room.sockets) {
    if (sock !== fromSocket && sock.role === 'presenter') send(sock, { type: 'dino.jump' })
  }
}

module.exports = { getRoom, toClientState, broadcastState, broadcastDino, broadcastAll, relayDinoJump, send, rooms }
