const { WebSocketServer } = require('ws')
const env = require('../config/env')
const logger = require('../utils/logger')
const knex = require('../database/knex')
const roomService = require('../services/roomService')
const roomState = require('./roomState')
const { parseHello, parseMessage } = require('./schemas')
const { attachRateLimiters, allowMessage } = require('./rateLimit')

const wordcloudHandlers = require('./handlers/wordcloud')
const pollHandlers = require('./handlers/poll')
const quizHandlers = require('./handlers/quiz')
const auctionHandlers = require('./handlers/auction')
const dinoHandlers = require('./handlers/dino')

const HELLO_TIMEOUT_MS = 10_000
const IP_CONNECT_LIMIT = 20
const IP_CONNECT_WINDOW_MS = 60_000

const handlers = {
  'mode.set': async (room, ws, payload) => {
    if (ws.role !== 'presenter') return
    room.mode = payload.mode
    await knex('rooms').where({ id: room.roomId }).update({ mode: payload.mode })
    roomState.broadcastState(room)
  },
  'wordcloud.setQuestion': wordcloudHandlers.setQuestion,
  'wordcloud.clear': wordcloudHandlers.clear,
  'wordcloud.submit': wordcloudHandlers.submit,
  'poll.set': pollHandlers.set,
  'poll.reset': pollHandlers.reset,
  'poll.vote': pollHandlers.vote,
  'quiz.setQuestion': quizHandlers.setQuestion,
  'quiz.reset': quizHandlers.reset,
  'quiz.start': quizHandlers.start,
  'quiz.end': quizHandlers.end,
  'quiz.answer': quizHandlers.answer,
  'auction.register': auctionHandlers.register,
  'auction.start': auctionHandlers.start,
  'auction.bid': auctionHandlers.bid,
  'auction.close': auctionHandlers.close,
  'auction.nextItem': auctionHandlers.nextItem,
  'auction.useItem': auctionHandlers.useItem,
  'auction.giveMoney': auctionHandlers.giveMoney,
  'auction.reset': auctionHandlers.reset,
  'dino.jump': dinoHandlers.jump,
  'dino.setActive': dinoHandlers.setActive,
  'dino.score': dinoHandlers.score,
  'room.end': async (room, ws) => {
    if (ws.role !== 'presenter') return
    await roomService.endRoom(room.roomId)
    roomState.broadcastAll(room, { type: 'room.ended' })
    for (const sock of room.sockets) sock.close(4000, 'room_ended')
  },
}

const ipConnectCounts = new Map() // ip -> { count, windowStart }

function ipAllowed(ip) {
  const now = Date.now()
  const entry = ipConnectCounts.get(ip)
  if (!entry || now - entry.windowStart >= IP_CONNECT_WINDOW_MS) {
    ipConnectCounts.set(ip, { count: 1, windowStart: now })
    return true
  }
  entry.count += 1
  return entry.count <= IP_CONNECT_LIMIT
}

async function handleHello(ws, data) {
  const parsed = parseHello(data)
  if (!parsed.success) {
    ws.close(4000, 'invalid_hello')
    return
  }
  const { role, roomCode, presenterToken, clientToken, displayName } = parsed.data

  const roomRow = await roomService.findActiveByCode(roomCode.toUpperCase())
  if (!roomRow) {
    ws.send(JSON.stringify({ type: 'error', code: 'room_not_found' }))
    ws.close(4004, 'room_not_found')
    return
  }

  if (role === 'presenter') {
    if (!roomService.verifyPresenterToken(roomRow, presenterToken)) {
      ws.send(JSON.stringify({ type: 'error', code: 'unauthorized' }))
      ws.close(4001, 'unauthorized')
      return
    }
    ws.role = 'presenter'
  } else {
    const result = await roomService.findOrCreateParticipant(roomRow.id, clientToken, displayName)
    ws.role = 'participant'
    ws.participantId = result.participantId
    ws.displayName = result.displayName
    ws._newClientToken = result.clientToken
  }

  ws.roomId = roomRow.id
  ws.authenticated = true

  const room = await roomState.getRoom(roomRow.id, roomRow.code)
  ws.room = room
  room.sockets.add(ws)

  roomState.send(ws, {
    type: 'welcome',
    role: ws.role,
    participantId: ws.participantId || null,
    clientToken: ws._newClientToken || null,
    state: roomState.toClientState(room),
    dino: { active: room.dino.active, scores: room.dino.scores },
  })

  if (ws.role === 'participant') roomState.broadcastState(room)
}

function createWsServer(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws', maxPayload: 8192 })

  wss.on('connection', (ws, req) => {
    const ip = req.socket.remoteAddress
    const origin = req.headers.origin
    if (origin && origin !== env.corsOrigin) {
      logger.warn('ws_origin_rejected', { origin, ip })
      ws.close(4003, 'bad_origin')
      return
    }
    if (!ipAllowed(ip)) {
      ws.close(4029, 'rate_limited')
      return
    }

    ws.authenticated = false
    attachRateLimiters(ws)

    const helloTimer = setTimeout(() => {
      if (!ws.authenticated) ws.close(4008, 'hello_timeout')
    }, HELLO_TIMEOUT_MS)

    ws.on('message', async (raw) => {
      let data
      try {
        data = JSON.parse(raw.toString())
      } catch {
        return
      }

      if (!ws.authenticated) {
        if (data.type !== 'hello') return
        clearTimeout(helloTimer)
        try {
          await handleHello(ws, data)
        } catch (err) {
          logger.error('hello_failed', { message: err.message })
          ws.close(4000, 'hello_failed')
        }
        return
      }

      if (!allowMessage(ws, data.type)) return

      const parsed = parseMessage(data)
      if (!parsed.success) return

      const handler = handlers[parsed.data.type]
      if (!handler) return

      try {
        await handler(ws.room, ws, parsed.data)
      } catch (err) {
        logger.error('ws_handler_failed', { type: parsed.data.type, message: err.message })
      }
    })

    ws.on('close', () => {
      clearTimeout(helloTimer)
      const room = ws.room
      if (!room) return
      room.sockets.delete(ws)
      if (ws.role === 'presenter' && room.dino.active) {
        room.dino.active = false
        roomState.broadcastDino(room)
      }
      if (ws.role === 'participant') roomState.broadcastState(room)
    })
  })

  return wss
}

module.exports = {
  createWsServer,
  roomCount: () => roomState.rooms.size,
  connectionCount: () => {
    let total = 0
    for (const room of roomState.rooms.values()) total += room.sockets.size
    return total
  },
}
