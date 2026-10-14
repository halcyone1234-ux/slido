const { WebSocket } = require('ws')
const knex = require('../database/knex')
const wordcloudService = require('../services/wordcloudService')
const pollService = require('../services/pollService')
const quizService = require('../services/quizService')
const auctionService = require('../services/auctionService')
const reviewService = require('../services/reviewService')

const rooms = new Map() // roomId -> RoomState

async function loadRoom(roomId, code) {
  const roomRow = await knex('rooms').where({ id: roomId }).first()
  const wordcloud = await wordcloudService.loadLatest(roomId)
  const poll = await pollService.loadLatest(roomId)
  const quiz = await quizService.loadLatest(roomId)
  const auction = await auctionService.loadFullView(roomId)
  const review = await reviewService.loadLatest(roomId)

  return {
    roomId,
    code,
    mode: roomRow.mode,
    sockets: new Set(),
    wordcloud,
    poll,
    quiz,
    auction,
    review,
    hands: new Set(), // participantId 集合；記憶體即時態，斷線自動移除、不進資料庫
  }
}

async function getRoom(roomId, code) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, await loadRoom(roomId, code))
  }
  return rooms.get(roomId)
}

// role：'presenter' 會多拿到複習題庫（含正解）；參與者永遠拿不到未公佈的答案。
function toClientState(room, role) {
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
    poll: {
      pollId: room.poll.pollId,
      question: room.poll.question,
      options: room.poll.options,
      multi: Boolean(room.poll.multi),
    },
    quiz: {
      question: room.quiz.question,
      responses: room.quiz.responses,
      endsAt: room.quiz.endsAt,
      durationSec: room.quiz.durationSec,
    },
    presence,
    hands,
    review: reviewService.toClientView(room.review, role),
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
  // 主持人與參與者看到的 state 不同（題庫正解只給主持人），各算一份。
  const participantState = toClientState(room, 'participant')
  let presenterState = null
  for (const sock of room.sockets) {
    if (sock.role === 'presenter') {
      if (!presenterState) presenterState = toClientState(room, 'presenter')
      send(sock, { type: 'state', state: presenterState })
    } else {
      send(sock, { type: 'state', state: participantState })
    }
  }
}

module.exports = { getRoom, toClientState, broadcastState, broadcastAll, send, rooms }
