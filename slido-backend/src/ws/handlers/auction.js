const auctionService = require('../../services/auctionService')
const { broadcastState, send } = require('../roomState')

async function register(room, ws, payload) {
  if (ws.role !== 'participant') return
  const fallbackName = `玩家-${Math.floor(100 + Math.random() * 900)}`
  const result = await auctionService.register(room.auction.sessionId, ws.participantId, String(payload.name || '').trim() || fallbackName)
  if (!result.alreadyRegistered) {
    room.auction.participants[ws.participantId] = { name: result.name, balance: result.balance, items: [] }
    broadcastState(room)
  }
}

async function start(room, ws, payload) {
  if (ws.role !== 'presenter') return
  if (room.auction.status === 'live') return
  const result = await auctionService.startAuction(room.auction.sessionId, String(payload.item || ''), payload.startPrice)
  room.auction.status = 'live'
  room.auction.lotId = result.lotId
  room.auction.item = result.item
  room.auction.highestBid = result.highestBid
  room.auction.highestBidder = null
  broadcastState(room)
}

async function bid(room, ws, payload) {
  if (ws.role !== 'participant') return
  if (room.auction.status !== 'live') return
  const amount = Math.round(Number(payload.amount))
  if (!Number.isFinite(amount) || amount <= 0) return

  const result = await auctionService.placeBid(room.auction.lotId, ws.participantId, room.auction.sessionId, amount)
  if (!result.ok) {
    send(ws, { type: 'auction.rejected', reason: result.reason })
    return
  }
  room.auction.highestBid = amount
  room.auction.highestBidder = { id: ws.participantId, name: result.name }
  broadcastState(room)
}

async function close(room, ws) {
  if (ws.role !== 'presenter') return
  if (room.auction.status !== 'live') return
  const result = await auctionService.closeAuction(room.auction.lotId, room.auction.sessionId)
  if (!result.ok) return

  room.auction.status = 'closed'
  if (result.sale) {
    const winner = room.auction.participants[result.sale.winnerId]
    if (winner) {
      winner.balance = result.sale.winnerBalance
      winner.items.push({ id: result.sale.id, name: result.sale.item, amount: result.sale.amount, used: false })
    }
    room.auction.sold.push({ item: result.sale.item, name: result.sale.winnerName, amount: result.sale.amount, winnerId: result.sale.winnerId })
  }
  broadcastState(room)
}

async function nextItem(room, ws) {
  if (ws.role !== 'presenter') return
  room.auction.status = 'idle'
  room.auction.lotId = null
  room.auction.item = ''
  room.auction.highestBid = 0
  room.auction.highestBidder = null
  broadcastState(room)
}

async function useItem(room, ws, payload) {
  if (ws.role !== 'participant') return
  const result = await auctionService.useItem(ws.participantId, String(payload.saleId || ''))
  if (!result.ok) return
  const participant = room.auction.participants[ws.participantId]
  const item = participant?.items.find((it) => it.id === payload.saleId)
  if (item) item.used = true
  broadcastState(room)
}

async function giveMoney(room, ws, payload) {
  if (ws.role !== 'presenter') return
  const amount = Math.round(Number(payload.amount))
  if (!Number.isFinite(amount)) return
  const result = await auctionService.giveMoney(room.auction.sessionId, String(payload.participantId || ''), amount)
  if (!result.ok) return
  const participant = room.auction.participants[payload.participantId]
  if (participant) participant.balance = result.balance
  broadcastState(room)
}

async function reset(room, ws) {
  if (ws.role !== 'presenter') return
  const result = await auctionService.resetAuction(room.roomId)
  room.auction.sessionId = result.sessionId
  room.auction.status = 'idle'
  room.auction.lotId = null
  room.auction.item = ''
  room.auction.highestBid = 0
  room.auction.highestBidder = null
  room.auction.sold = []
  room.auction.participants = {}
  for (const p of result.participants) {
    room.auction.participants[p.participantId] = { name: p.name, balance: 100, items: [] }
  }
  broadcastState(room)
}

module.exports = { register, start, bid, close, nextItem, useItem, giveMoney, reset }
