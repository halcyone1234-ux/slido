const knex = require('../database/knex')
const { randomToken, hashToken, timingSafeEqualHex, randomRoomCode } = require('../utils/crypto')

const MAX_CODE_ATTEMPTS = 10

async function createRoom(name) {
  const presenterToken = randomToken()
  const presenterTokenHash = hashToken(presenterToken)

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    const code = randomRoomCode()
    try {
      const [room] = await knex('rooms')
        .insert({ code, presenter_token_hash: presenterTokenHash, name: name || null })
        .returning(['id', 'code'])
      return { roomId: room.id, code: room.code, presenterToken }
    } catch (err) {
      if (err.code === '23505') continue // unique_violation on code, retry
      throw err
    }
  }
  throw new Error('Failed to generate a unique room code')
}

async function findActiveByCode(code) {
  return knex('rooms').where({ code, ended_at: null }).first()
}

function verifyPresenterToken(room, presenterToken) {
  if (!room || !presenterToken) return false
  return timingSafeEqualHex(hashToken(presenterToken), room.presenter_token_hash)
}

async function endRoom(roomId) {
  await knex('rooms').where({ id: roomId }).update({ ended_at: knex.fn.now() })
}

async function findOrCreateParticipant(roomId, clientToken, displayName) {
  const cleanName = displayName ? String(displayName).trim().slice(0, 20) : null

  if (clientToken) {
    const existing = await knex('participants')
      .where({ room_id: roomId, client_token_hash: hashToken(clientToken) })
      .first()
    if (existing) {
      const update = { last_seen_at: knex.fn.now() }
      if (cleanName) update.display_name = cleanName
      const [row] = await knex('participants').where({ id: existing.id }).update(update).returning(['id', 'display_name'])
      return { participantId: row.id, clientToken: null, isNew: false, displayName: row.display_name }
    }
  }
  const newToken = randomToken()
  const [row] = await knex('participants')
    .insert({ room_id: roomId, client_token_hash: hashToken(newToken), display_name: cleanName })
    .returning(['id', 'display_name'])
  return { participantId: row.id, clientToken: newToken, isNew: true, displayName: row.display_name }
}

module.exports = {
  createRoom,
  findActiveByCode,
  verifyPresenterToken,
  endRoom,
  findOrCreateParticipant,
}
