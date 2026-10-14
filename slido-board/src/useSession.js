import { useState, useEffect, useCallback } from 'react'
import { connectRoom, disconnectRoom, send, onMessage } from './ws/socket.js'
import { getClientToken, setClientToken, getMyName } from './identity.js'

// 同步核心：以 WebSocket 連到後端（見 ws/socket.js），伺服器是單一權威資料來源，
// 房間狀態持久存在 PostgreSQL。取代原本的 BroadcastChannel + localStorage
// （只在同一瀏覽器分頁群組內生效）。對外函式簽名盡量維持不變，元件呼叫端才不用大改。

const SAMPLE_QUESTIONS = [
  '你今天的心情用一個詞形容？',
  '對這場活動最期待的一件事是什麼？',
  '用一個詞描述你心中的理想工作環境',
]

export { SAMPLE_QUESTIONS }

const emptyState = {
  mode: 'wordcloud',
  question: '',
  submissions: [],
  poll: { pollId: null, question: '', options: [], multi: false },
  quiz: { question: '', responses: {}, endsAt: null, durationSec: null },
  presence: {},
  hands: [], // [{ id, name }] 目前舉手者，記憶體即時態
  review: {
    gameId: null,
    title: '',
    status: 'lobby',
    index: 0,
    total: 0,
    question: null,
    responses: {},
    answeredCount: 0,
    reveal: null,
    results: null,
    bank: null, // 只有主持人會拿到（含正解）
  },
  auction: { status: 'idle', item: '', highestBid: 0, highestBidder: null, participants: {}, sold: [] },
}

// opts: { role: 'presenter'|'participant', roomCode, presenterToken } | null
// (null while the room code/token isn't known yet — see Presenter.jsx/Participant.jsx)
export function useSession(opts) {
  const [state, setState] = useState(emptyState)
  const [myId, setMyId] = useState(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!opts || !opts.roomCode) {
      disconnectRoom()
      setConnected(false)
      setMyId(null)
      setState(emptyState)
      return
    }

    const hello = { type: 'hello', role: opts.role, roomCode: opts.roomCode }
    if (opts.role === 'presenter') {
      hello.presenterToken = opts.presenterToken
    } else {
      const stored = getClientToken(opts.roomCode)
      if (stored) hello.clientToken = stored
      hello.displayName = getMyName()
    }

    setConnected(false)
    connectRoom(hello)

    const unsubscribe = onMessage((msg) => {
      if (msg.type === 'welcome') {
        setConnected(true)
        if (msg.participantId) setMyId(msg.participantId)
        if (msg.clientToken) setClientToken(opts.roomCode, msg.clientToken)
        setState(msg.state)
      } else if (msg.type === 'state') {
        setState(msg.state)
      } else if (msg.type === 'error' || msg.type === 'room.ended') {
        setConnected(false)
      }
    })

    return () => {
      unsubscribe()
      disconnectRoom()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts?.role, opts?.roomCode, opts?.presenterToken])

  const setQuestion = useCallback((question) => send({ type: 'wordcloud.setQuestion', question }), [])
  const setMode = useCallback((mode) => send({ type: 'mode.set', mode }), [])
  const submit = useCallback((text) => send({ type: 'wordcloud.submit', text }), [])
  const clearSubmissions = useCallback(() => send({ type: 'wordcloud.clear' }), [])

  const setPoll = useCallback(
    (question, labels, multi) => send({ type: 'poll.set', question, labels, multi: Boolean(multi) }),
    [],
  )
  // optionIds＝目前勾選的完整集合（單選＝一個、取消全部＝空陣列）
  const votePoll = useCallback((optionIds) => send({ type: 'poll.vote', optionIds }), [])
  const resetPoll = useCallback(() => send({ type: 'poll.reset' }), [])

  const setQuizQuestion = useCallback((question) => send({ type: 'quiz.setQuestion', question }), [])
  const answerQuiz = useCallback((_id, choice) => send({ type: 'quiz.answer', choice }), [])
  const resetQuiz = useCallback(() => send({ type: 'quiz.reset' }), [])
  const startQuizRound = useCallback((seconds) => send({ type: 'quiz.start', seconds }), [])
  const endQuizRound = useCallback(() => send({ type: 'quiz.end' }), [])

  // 期中複習競賽（Kahoot 式四選一）
  const setReviewQuestions = useCallback(
    (title, questions) => send({ type: 'review.setQuestions', title, questions }),
    [],
  )
  const useDefaultReview = useCallback(() => send({ type: 'review.useDefault' }), [])
  const startReview = useCallback(() => send({ type: 'review.start' }), [])
  const endReviewQuestion = useCallback(() => send({ type: 'review.end' }), [])
  const nextReviewQuestion = useCallback(() => send({ type: 'review.next' }), [])
  const finishReview = useCallback(() => send({ type: 'review.finish' }), [])
  const recapReview = useCallback((index) => send({ type: 'review.recap', index }), [])
  const showReviewResults = useCallback(() => send({ type: 'review.results' }), [])
  const resetReview = useCallback(() => send({ type: 'review.reset' }), [])
  const answerReview = useCallback((index, choice) => send({ type: 'review.answer', index, choice }), [])

  // 舉手：參與者切換自己舉手/放下；主持人一鍵全部放下。
  const setHand = useCallback((raised) => send({ type: 'hand.set', raised }), [])
  const clearHands = useCallback(() => send({ type: 'hand.clearAll' }), [])

  // Presence 現在由連線存活狀態自動推播，這兩個保留成 no-op 是為了不用動
  // Participant.jsx 既有的 join/leave 呼叫點。
  const join = useCallback(() => {}, [])
  const leave = useCallback(() => {}, [])

  const registerBidder = useCallback((_id, name) => send({ type: 'auction.register', name }), [])
  const startAuction = useCallback((item, startPrice) => send({ type: 'auction.start', item, startPrice }), [])
  const placeBid = useCallback((_id, amount) => send({ type: 'auction.bid', amount }), [])
  const closeAuction = useCallback(() => send({ type: 'auction.close' }), [])
  const nextItem = useCallback(() => send({ type: 'auction.nextItem' }), [])
  const useItem = useCallback((_participantId, itemId) => send({ type: 'auction.useItem', saleId: itemId }), [])
  const giveMoney = useCallback((participantId, amount) => send({ type: 'auction.giveMoney', participantId, amount }), [])
  const resetAuction = useCallback(() => send({ type: 'auction.reset' }), [])

  return {
    state,
    myId,
    connected,
    setQuestion,
    setMode,
    submit,
    clearSubmissions,
    setPoll,
    votePoll,
    resetPoll,
    setQuizQuestion,
    answerQuiz,
    resetQuiz,
    startQuizRound,
    endQuizRound,
    setHand,
    clearHands,
    setReviewQuestions,
    useDefaultReview,
    startReview,
    endReviewQuestion,
    nextReviewQuestion,
    finishReview,
    recapReview,
    showReviewResults,
    resetReview,
    answerReview,
    join,
    leave,
    registerBidder,
    startAuction,
    placeBid,
    closeAuction,
    nextItem,
    resetAuction,
    useItem,
    giveMoney,
  }
}
