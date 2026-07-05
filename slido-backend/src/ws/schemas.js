const { z } = require('zod')

const helloSchema = z.object({
  type: z.literal('hello'),
  role: z.enum(['presenter', 'participant']),
  roomCode: z.string().trim().min(1).max(8),
  presenterToken: z.string().max(200).optional(),
  clientToken: z.string().max(200).optional(),
  displayName: z.string().max(20).optional(),
})

// One schema per C2S action, keyed by `type`. Anything that doesn't match a known
// type or fails validation is dropped before it reaches business logic.
const messageSchemas = {
  'mode.set': z.object({ type: z.literal('mode.set'), mode: z.enum(['wordcloud', 'poll', 'quiz', 'auction']) }),

  'wordcloud.setQuestion': z.object({ type: z.literal('wordcloud.setQuestion'), question: z.string().min(1).max(200) }),
  'wordcloud.clear': z.object({ type: z.literal('wordcloud.clear') }),
  'wordcloud.submit': z.object({ type: z.literal('wordcloud.submit'), text: z.string().min(1).max(80) }),

  'poll.set': z.object({
    type: z.literal('poll.set'),
    question: z.string().min(1).max(200),
    labels: z.array(z.string().max(80)).min(1).max(8),
  }),
  'poll.reset': z.object({ type: z.literal('poll.reset') }),
  'poll.vote': z.object({ type: z.literal('poll.vote'), optionId: z.string().uuid() }),

  'quiz.setQuestion': z.object({ type: z.literal('quiz.setQuestion'), question: z.string().min(1).max(200) }),
  'quiz.reset': z.object({ type: z.literal('quiz.reset') }),
  'quiz.start': z.object({ type: z.literal('quiz.start'), seconds: z.number().int().min(5).max(300) }),
  'quiz.end': z.object({ type: z.literal('quiz.end') }),
  'quiz.answer': z.object({ type: z.literal('quiz.answer'), choice: z.enum(['O', 'X']) }),

  'auction.register': z.object({ type: z.literal('auction.register'), name: z.string().max(12).optional() }),
  'auction.start': z.object({
    type: z.literal('auction.start'),
    item: z.string().max(80),
    startPrice: z.number().min(0).max(1_000_000),
  }),
  'auction.bid': z.object({ type: z.literal('auction.bid'), amount: z.number().min(1).max(1_000_000) }),
  'auction.close': z.object({ type: z.literal('auction.close') }),
  'auction.nextItem': z.object({ type: z.literal('auction.nextItem') }),
  'auction.useItem': z.object({ type: z.literal('auction.useItem'), saleId: z.string().uuid() }),
  'auction.giveMoney': z.object({
    type: z.literal('auction.giveMoney'),
    participantId: z.string().uuid(),
    amount: z.number().min(-1_000_000).max(1_000_000),
  }),
  'auction.reset': z.object({ type: z.literal('auction.reset') }),

  'dino.jump': z.object({ type: z.literal('dino.jump') }),
  'dino.setActive': z.object({ type: z.literal('dino.setActive'), active: z.boolean() }),
  'dino.score': z.object({ type: z.literal('dino.score'), score: z.number().min(0).max(1_000_000) }),

  'room.end': z.object({ type: z.literal('room.end') }),
}

function parseHello(raw) {
  return helloSchema.safeParse(raw)
}

function parseMessage(raw) {
  const schema = raw && typeof raw.type === 'string' ? messageSchemas[raw.type] : null
  if (!schema) return { success: false }
  return schema.safeParse(raw)
}

module.exports = { parseHello, parseMessage }
