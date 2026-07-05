const knex = require('../database/knex')

const DEFAULT_QUESTION = '你對今天的主題有多熟悉？'
const DEFAULT_OPTIONS = ['非常同意', '同意', '普通', '不同意']

async function createPoll(roomId, question, labels) {
  const [poll] = await knex('polls').insert({ room_id: roomId, question }).returning('*')
  const cleanLabels = labels.map((l) => l.trim().slice(0, 80)).filter(Boolean)
  if (cleanLabels.length > 0) {
    await knex('poll_options').insert(
      cleanLabels.map((label, i) => ({ poll_id: poll.id, label, position: i })),
    )
  }
  return poll
}

async function loadPollView(pollId, question) {
  const options = await knex('poll_options')
    .leftJoin('poll_votes', 'poll_votes.option_id', 'poll_options.id')
    .where('poll_options.poll_id', pollId)
    .groupBy('poll_options.id', 'poll_options.label', 'poll_options.position')
    .orderBy('poll_options.position', 'asc')
    .select('poll_options.id', 'poll_options.label')
    .count('poll_votes.id as votes')

  return {
    pollId,
    question,
    options: options.map((o) => ({ id: o.id, label: o.label, votes: Number(o.votes) })),
  }
}

async function loadLatest(roomId) {
  let poll = await knex('polls').where({ room_id: roomId }).orderBy('created_at', 'desc').first()
  if (!poll) {
    poll = await createPoll(roomId, DEFAULT_QUESTION, DEFAULT_OPTIONS)
  }
  return loadPollView(poll.id, poll.question)
}

async function setPoll(roomId, question, labels) {
  const poll = await createPoll(roomId, question || '投票', labels)
  return loadPollView(poll.id, poll.question)
}

async function reset(roomId, pollId) {
  const current = await knex('polls').where({ id: pollId }).first()
  const options = await knex('poll_options').where({ poll_id: pollId }).orderBy('position', 'asc')
  const poll = await createPoll(roomId, current.question, options.map((o) => o.label))
  return loadPollView(poll.id, poll.question)
}

async function vote(pollId, participantId, optionId) {
  const option = await knex('poll_options').where({ id: optionId, poll_id: pollId }).first()
  if (!option) return { ok: false, reason: 'invalid_option' }

  await knex('poll_votes')
    .insert({ poll_id: pollId, option_id: optionId, participant_id: participantId })
    .onConflict(['poll_id', 'participant_id'])
    .merge({ option_id: optionId, updated_at: knex.fn.now() })

  return { ok: true }
}

module.exports = { loadLatest, loadPollView, setPoll, reset, vote }
