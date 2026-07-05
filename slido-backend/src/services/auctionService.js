const knex = require('../database/knex')

const START_BALANCE = 100

async function getOrCreateSession(roomId) {
  let session = await knex('auction_sessions').where({ room_id: roomId }).orderBy('started_at', 'desc').first()
  if (!session) {
    ;[session] = await knex('auction_sessions').insert({ room_id: roomId }).returning('*')
  }
  return session
}

async function loadParticipantsMap(sessionId) {
  const rows = await knex('auction_participants').where({ session_id: sessionId })
  const sales = await knex('auction_sales')
    .where({ session_id: sessionId })
    .select('id', 'winner_participant_id', 'item_name', 'amount', 'used')

  const map = {}
  for (const p of rows) {
    map[p.participant_id] = { name: p.display_name, balance: p.balance, items: [] }
  }
  for (const s of sales) {
    if (map[s.winner_participant_id]) {
      map[s.winner_participant_id].items.push({ id: s.id, name: s.item_name, amount: s.amount, used: s.used })
    }
  }
  return map
}

async function loadSoldList(sessionId) {
  return knex('auction_sales')
    .join('auction_participants', function () {
      this.on('auction_participants.session_id', '=', 'auction_sales.session_id').andOn(
        'auction_participants.participant_id',
        '=',
        'auction_sales.winner_participant_id',
      )
    })
    .where('auction_sales.session_id', sessionId)
    .orderBy('auction_sales.sold_at', 'asc')
    .select(
      'auction_sales.item_name as item',
      'auction_participants.display_name as name',
      'auction_sales.amount as amount',
      'auction_sales.winner_participant_id as winnerId',
    )
}

// Only used at room rehydration time (process (re)start / first touch) — NOT after every
// action, because the DB alone can't distinguish "closed, awaiting nextItem" from "idle,
// ready for a new lot" once nextItem has been clicked. Live updates instead patch the
// in-memory view directly from each mutation's own return value (see handlers).
async function loadFullView(roomId) {
  const session = await getOrCreateSession(roomId)
  const lot = await knex('auction_lots').where({ session_id: session.id }).orderBy('opened_at', 'desc').first()
  const participants = await loadParticipantsMap(session.id)
  const sold = await loadSoldList(session.id)

  // Conservative default on rehydration: an already-closed lot resets to idle rather than
  // replaying the transient "just closed" screen, since we can't know if nextItem() had
  // already been clicked before the process restarted.
  const status = lot && lot.status === 'live' ? 'live' : 'idle'
  const highestBidder =
    status === 'live' && lot.highest_bidder_participant_id
      ? { id: lot.highest_bidder_participant_id, name: participants[lot.highest_bidder_participant_id]?.name }
      : null

  return {
    sessionId: session.id,
    lotId: status === 'live' ? lot.id : null,
    status,
    item: status === 'live' ? lot.item_name : '',
    highestBid: status === 'live' ? lot.highest_bid : 0,
    highestBidder,
    participants,
    sold,
  }
}

async function register(sessionId, participantId, name) {
  const existing = await knex('auction_participants').where({ session_id: sessionId, participant_id: participantId }).first()
  if (existing) return { ok: true, alreadyRegistered: true, name: existing.display_name, balance: existing.balance }
  const cleanName = name.slice(0, 12)
  await knex('auction_participants').insert({
    session_id: sessionId,
    participant_id: participantId,
    display_name: cleanName,
    balance: START_BALANCE,
  })
  return { ok: true, alreadyRegistered: false, name: cleanName, balance: START_BALANCE }
}

async function startAuction(sessionId, item, startPrice) {
  const price = Math.max(0, Math.round(Number(startPrice) || 0))
  const [lot] = await knex('auction_lots')
    .insert({ session_id: sessionId, item_name: item.trim() || '神秘商品', start_price: price, highest_bid: price, status: 'live' })
    .returning('*')
  return { lotId: lot.id, item: lot.item_name, highestBid: lot.highest_bid }
}

async function placeBid(lotId, participantId, sessionId, amount) {
  return knex.transaction(async (trx) => {
    const lot = await trx('auction_lots').where({ id: lotId }).forUpdate().first()
    if (!lot || lot.status !== 'live') return { ok: false, reason: 'not_live' }
    if (amount <= lot.highest_bid) return { ok: false, reason: 'too_low' }

    const bidder = await trx('auction_participants').where({ session_id: sessionId, participant_id: participantId }).first()
    if (!bidder || amount > bidder.balance) return { ok: false, reason: 'insufficient_balance' }

    await trx('auction_bids').insert({ lot_id: lotId, participant_id: participantId, amount })
    await trx('auction_lots').where({ id: lotId }).update({ highest_bid: amount, highest_bidder_participant_id: participantId })
    return { ok: true, amount, name: bidder.display_name }
  })
}

async function closeAuction(lotId, sessionId) {
  return knex.transaction(async (trx) => {
    const lot = await trx('auction_lots').where({ id: lotId }).forUpdate().first()
    if (!lot || lot.status !== 'live') return { ok: false, reason: 'not_live' }

    let sale = null
    if (lot.highest_bidder_participant_id) {
      const [saleRow] = await trx('auction_sales')
        .insert({
          lot_id: lot.id,
          session_id: sessionId,
          winner_participant_id: lot.highest_bidder_participant_id,
          item_name: lot.item_name,
          amount: lot.highest_bid,
        })
        .returning('*')
      const [updated] = await trx('auction_participants')
        .where({ session_id: sessionId, participant_id: lot.highest_bidder_participant_id })
        .update({ balance: trx.raw('GREATEST(0, balance - ?)', [lot.highest_bid]) })
        .returning(['balance', 'display_name'])
      sale = {
        id: saleRow.id,
        item: saleRow.item_name,
        amount: saleRow.amount,
        winnerId: saleRow.winner_participant_id,
        winnerName: updated.display_name,
        winnerBalance: updated.balance,
      }
    }
    await trx('auction_lots').where({ id: lotId }).update({ status: 'closed', closed_at: trx.fn.now() })
    return { ok: true, sale }
  })
}

async function giveMoney(sessionId, participantId, amount) {
  const [updated] = await knex('auction_participants')
    .where({ session_id: sessionId, participant_id: participantId })
    .update({ balance: knex.raw('GREATEST(0, balance + ?)', [amount]) })
    .returning('balance')
  if (!updated) return { ok: false, reason: 'not_registered' }
  await knex('auction_balance_adjustments').insert({ session_id: sessionId, participant_id: participantId, amount })
  return { ok: true, balance: updated.balance }
}

async function useItem(participantId, saleId) {
  const sale = await knex('auction_sales').where({ id: saleId }).first()
  if (!sale || sale.winner_participant_id !== participantId || sale.used) return { ok: false }
  await knex('auction_sales').where({ id: saleId }).update({ used: true, used_at: knex.fn.now() })
  return { ok: true }
}

async function resetAuction(roomId) {
  const oldSession = await getOrCreateSession(roomId)
  const oldParticipants = await knex('auction_participants').where({ session_id: oldSession.id })
  const [newSession] = await knex('auction_sessions').insert({ room_id: roomId }).returning('*')
  if (oldParticipants.length > 0) {
    await knex('auction_participants').insert(
      oldParticipants.map((p) => ({
        session_id: newSession.id,
        participant_id: p.participant_id,
        display_name: p.display_name,
        balance: START_BALANCE,
      })),
    )
  }
  return {
    sessionId: newSession.id,
    participants: oldParticipants.map((p) => ({ participantId: p.participant_id, name: p.display_name })),
  }
}

module.exports = {
  loadFullView,
  register,
  startAuction,
  placeBid,
  closeAuction,
  giveMoney,
  useItem,
  resetAuction,
}
