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
  'mode.set': z.object({ type: z.literal('mode.set'), mode: z.enum(['wordcloud', 'poll', 'quiz', 'auction', 'review']) }),

  'wordcloud.setQuestion': z.object({ type: z.literal('wordcloud.setQuestion'), question: z.string().min(1).max(200) }),
  'wordcloud.clear': z.object({ type: z.literal('wordcloud.clear') }),
  'wordcloud.submit': z.object({ type: z.literal('wordcloud.submit'), text: z.string().min(1).max(80) }),

  'poll.set': z.object({
    type: z.literal('poll.set'),
    question: z.string().min(1).max(200),
    labels: z.array(z.string().max(80)).min(1).max(8),
    multi: z.boolean().optional(),
  }),
  'poll.reset': z.object({ type: z.literal('poll.reset') }),
  // optionIds＝參與者目前勾選的完整集合；空陣列＝取消所有勾選
  'poll.vote': z.object({ type: z.literal('poll.vote'), optionIds: z.array(z.string().uuid()).max(8) }),

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

  // 期中複習競賽（四選一）
  'review.setQuestions': z.object({
    type: z.literal('review.setQuestions'),
    title: z.string().max(120),
    questions: z
      .array(
        z.object({
          section: z.string().max(80).optional(),
          text: z.string().min(1).max(600),
          options: z.object({
            A: z.string().max(300),
            B: z.string().max(300),
            C: z.string().max(300),
            D: z.string().max(300),
          }),
          answer: z.enum(['A', 'B', 'C', 'D']),
          explain: z.string().max(600).optional(),
        }),
      )
      .min(1)
      .max(60),
  }),
  'review.useDefault': z.object({ type: z.literal('review.useDefault') }),
  'review.start': z.object({ type: z.literal('review.start') }),
  'review.end': z.object({ type: z.literal('review.end') }),
  'review.next': z.object({ type: z.literal('review.next') }),
  'review.finish': z.object({ type: z.literal('review.finish') }),
  'review.recap': z.object({ type: z.literal('review.recap'), index: z.number().int().min(0).max(59) }),
  'review.results': z.object({ type: z.literal('review.results') }),
  'review.reset': z.object({ type: z.literal('review.reset') }),
  'review.answer': z.object({
    type: z.literal('review.answer'),
    index: z.number().int().min(0).max(59),
    choice: z.enum(['A', 'B', 'C', 'D']),
  }),

  'hand.set': z.object({ type: z.literal('hand.set'), raised: z.boolean() }),
  'hand.clearAll': z.object({ type: z.literal('hand.clearAll') }),

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
