const knex = require('../database/knex')

async function loadScores(roundId) {
  if (!roundId) return []
  const rows = await knex('dino_scores').where({ dino_round_id: roundId })
  return rows.map((r) => ({ id: r.participant_id, name: r.display_name, best: r.best_score }))
}

async function startRound(roomId) {
  const [round] = await knex('dino_rounds').insert({ room_id: roomId }).returning('*')
  return round
}

async function endRound(roundId) {
  if (!roundId) return
  await knex('dino_rounds').where({ id: roundId }).update({ ended_at: knex.fn.now() })
}

async function reportScore(roundId, participantId, name, score) {
  await knex('dino_scores')
    .insert({ dino_round_id: roundId, participant_id: participantId, display_name: name.slice(0, 20), best_score: score })
    .onConflict(['dino_round_id', 'participant_id'])
    .merge({ best_score: knex.raw('GREATEST(dino_scores.best_score, EXCLUDED.best_score)'), updated_at: knex.fn.now() })

  const row = await knex('dino_scores').where({ dino_round_id: roundId, participant_id: participantId }).first()
  return { id: participantId, name: row.display_name, best: row.best_score }
}

module.exports = { loadScores, startRound, endRound, reportScore }
