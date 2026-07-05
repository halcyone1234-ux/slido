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
  for (const sock of room.sockets) {
    if (sock.role === 'participant') presence[sock.participantId] = true
  }
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
