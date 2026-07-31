const knex = require('../database/knex')

const DEFAULT_QUESTION = '你對今天的主題有多熟悉？'
const DEFAULT_OPTIONS = ['非常同意', '同意', '普通', '不同意']

async function createPoll(roomId, question, labels, multi = false) {
  const [poll] = await knex('polls')
    .insert({ room_id: roomId, question, multi })
    .returning('*')
  const cleanLabels = labels.map((l) => l.trim().slice(0, 80)).filter(Boolean)
  if (cleanLabels.length > 0) {
    await knex('poll_options').insert(
      cleanLabels.map((label, i) => ({ poll_id: poll.id, label, position: i })),
    )
  }
  return poll
}

async function loadPollView(pollId) {
  const poll = await knex('polls').where({ id: pollId }).first()
  const options = await knex('poll_options')
    .leftJoin('poll_votes', 'poll_votes.option_id', 'poll_options.id')
    .where('poll_options.poll_id', pollId)
    .groupBy('poll_options.id', 'poll_options.label', 'poll_options.position')
    .orderBy('poll_options.position', 'asc')
    .select('poll_options.id', 'poll_options.label')
    .count('poll_votes.id as votes')

  return {
    pollId,
    question: poll.question,
    multi: poll.multi,
    options: options.map((o) => ({ id: o.id, label: o.label, votes: Number(o.votes) })),
  }
}

async function loadLatest(roomId) {
  let poll = await knex('polls').where({ room_id: roomId }).orderBy('created_at', 'desc').first()
  if (!poll) {
    poll = await createPoll(roomId, DEFAULT_QUESTION, DEFAULT_OPTIONS)
  }
  return loadPollView(poll.id)
}

async function setPoll(roomId, question, labels, multi) {
  const poll = await createPoll(roomId, question || '投票', labels, Boolean(multi))
  return loadPollView(poll.id)
}

async function reset(roomId, pollId) {
  const current = await knex('polls').where({ id: pollId }).first()
  const options = await knex('poll_options').where({ poll_id: pollId }).orderBy('position', 'asc')
  const poll = await createPoll(
    roomId,
    current.question,
    options.map((o) => o.label),
    current.multi,
  )
  return loadPollView(poll.id)
}

// 投票：optionIds 為這位參與者「目前勾選的完整集合」（單選＝至多一個）。
// 以整組覆寫（先刪後插）同時支援投票、改票與取消勾選。
async function vote(pollId, participantId, optionIds) {
  const poll = await knex('polls').where({ id: pollId }).first()
  if (!poll) return { ok: false, reason: 'poll_not_found' }

  const unique = [...new Set(optionIds)]
  const valid = await knex('poll_options')
    .where({ poll_id: pollId })
    .whereIn('id', unique)
    .pluck('id')
  if (valid.length !== unique.length) return { ok: false, reason: 'invalid_option' }

  const finalIds = poll.multi ? valid : valid.slice(0, 1)

  await knex.transaction(async (trx) => {
    await trx('poll_votes').where({ poll_id: pollId, participant_id: participantId }).del()
    if (finalIds.length > 0) {
      await trx('poll_votes').insert(
        finalIds.map((optionId) => ({
          poll_id: pollId,
          option_id: optionId,
          participant_id: participantId,
        })),
      )
    }
  })

  return { ok: true }
}

module.exports = { loadLatest, loadPollView, setPoll, reset, vote }
