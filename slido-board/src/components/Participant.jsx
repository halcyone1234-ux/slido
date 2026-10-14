import { useState, useEffect } from 'react'
import PollChart from './PollChart.jsx'
import WordCloud from './WordCloud.jsx'
import AuctionParticipant from './AuctionParticipant.jsx'
import ReviewParticipant from './ReviewParticipant.jsx'
import { checkRoom } from '../api.js'
import { useSession } from '../useSession.js'
import { useCountdown } from '../useCountdown.js'

function JoinByCode() {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')

  const handleJoin = async () => {
    const clean = code.trim().toUpperCase()
    if (!clean) return
    const { active } = await checkRoom(clean)
    if (!active) {
      setError('找不到這個房間，請確認房號')
      return
    }
    window.location.hash = `#join/${clean}`
  }

  return (
    <div className="phone">
      <header className="phone-top">
        <span className="brand-dot" />
        互動黑板
      </header>
      <div className="phone-body">
        <h2 className="phone-question">請輸入主持人給的房號</h2>
        <div className="landing-join">
          <input
            value={code}
            onChange={(e) => {
              setCode(e.target.value)
              setError('')
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            placeholder="例如 AB23CD"
            maxLength={6}
          />
          <button className="btn-primary" onClick={handleJoin}>
            加入
          </button>
        </div>
        {error && <p className="landing-error">{error}</p>}
      </div>
    </div>
  )
}

export default function Participant({ roomCode }) {
  const session = useSession(roomCode ? { role: 'participant', roomCode } : null)

  if (!roomCode) return <JoinByCode />
  if (!session.connected || !session.myId) {
    return (
      <div className="phone">
        <header className="phone-top">
          <span className="brand-dot" />
          互動黑板
        </header>
        <div className="phone-body">
          <p className="phone-hint">連線中…</p>
        </div>
      </div>
    )
  }

  return <ParticipantStage session={session} />
}

function ParticipantStage({ session }) {
  const { state, myId, submit, votePoll, answerQuiz, setHand, join, leave } = session
  const [text, setText] = useState('')
  const [justSent, setJustSent] = useState(false)
  const [myVotes, setMyVotes] = useState([]) // 這位參與者目前勾選的選項 id（複選題可多個）

  // 主持人更新投票（換了 pollId）→ 清掉本機勾選狀態
  useEffect(() => {
    setMyVotes([])
  }, [state.poll.pollId])

  // ---- 舉手（樂觀更新：按下立刻變，再與伺服器狀態對齊）----
  const serverHandUp = (state.hands || []).some((h) => h.id === myId)
  const [handUp, setHandUp] = useState(serverHandUp)
  useEffect(() => {
    setHandUp(serverHandUp)
  }, [serverHandUp])
  const toggleHand = () => {
    const next = !handUp
    setHandUp(next)
    setHand(next)
  }

  // Presence 現在由連線自動推播；join/leave 保留呼叫（no-op）只是不用動這段既有邏輯。
  useEffect(() => {
    join(myId)
    const onUnload = () => leave(myId)
    window.addEventListener('beforeunload', onUnload)
    return () => {
      leave(myId)
      window.removeEventListener('beforeunload', onUnload)
    }
  }, [myId, join, leave])

  const quizCd = useCountdown(state.quiz.endsAt)
  const quizLocked = Boolean(state.quiz.endsAt) && quizCd.timeUp

  const send = () => {
    if (!text.trim()) return
    submit(text, myId)
    setText('')
    setJustSent(true)
    setTimeout(() => setJustSent(false), 1500)
  }

  // 文字雲：同一人對同一題只能回答一次
  const wcAnswered = state.submissions.some((s) => s.by === myId)

  const handleVote = (optionId) => {
    let next
    if (state.poll.multi) {
      // 複選：點一下勾選、再點一下取消，永遠送出目前的完整集合
      next = myVotes.includes(optionId)
        ? myVotes.filter((id) => id !== optionId)
        : [...myVotes, optionId]
    } else {
      if (myVotes.length === 1 && myVotes[0] === optionId) return
      next = [optionId]
    }
    setMyVotes(next)
    votePoll(next)
  }

  // 是非題：樂觀更新——按下當下就變色（不等伺服器往返），答完鎖死兩顆不能改。
  // pending 會在「伺服器回報的答案」或「換題目」時重新對齊。
  const serverAnswer = state.quiz.responses[myId] || null
  const [pendingAnswer, setPendingAnswer] = useState(serverAnswer)
  useEffect(() => {
    setPendingAnswer(serverAnswer)
  }, [serverAnswer, state.quiz.question])
  const myAnswer = pendingAnswer || serverAnswer
  const quizAnswered = Boolean(myAnswer)
  const chooseQuiz = (choice) => {
    if (quizLocked || quizAnswered) return // 答完鎖死、時間到鎖死
    setPendingAnswer(choice) // 立即回饋
    answerQuiz(myId, choice)
  }

  return (
    <div className="phone">
      <header className="phone-top">
        <span className="brand-dot" />
        互動黑板
      </header>

      <div className="phone-body">
        <span className="phone-mode">
          {state.mode === 'wordcloud' && '☁️ 文字雲'}
          {state.mode === 'poll' && '📊 投票'}
          {state.mode === 'quiz' && '⭕❌ 快問快答'}
          {state.mode === 'auction' && '🔨 拍賣會'}
          {state.mode === 'review' && '🏆 期中複習'}
        </span>

        {state.mode === 'auction' ? (
          <AuctionParticipant session={session} />
        ) : state.mode === 'review' ? (
          <ReviewParticipant session={session} />
        ) : state.mode === 'quiz' ? (
          <>
            <h2 className="phone-question">{state.quiz.question}</h2>
            {quizCd.active && (
              <div
                className={`phone-timer ${quizCd.remaining <= 5 ? 'urgent' : ''}`}
              >
                ⏱ {quizCd.remaining}
              </div>
            )}
            <div className="quiz-choices">
              <button
                className={`quiz-choice quiz-choice-o ${
                  myAnswer === 'O' ? 'selected' : ''
                }`}
                disabled={quizLocked || quizAnswered}
                onClick={() => chooseQuiz('O')}
              >
                <span className="quiz-choice-mark">⭕</span>
                <span className="quiz-choice-label">對</span>
              </button>
              <button
                className={`quiz-choice quiz-choice-x ${
                  myAnswer === 'X' ? 'selected' : ''
                }`}
                disabled={quizLocked || quizAnswered}
                onClick={() => chooseQuiz('X')}
              >
                <span className="quiz-choice-mark">❌</span>
                <span className="quiz-choice-label">錯</span>
              </button>
            </div>
            {quizAnswered && !quizLocked && (
              <div className="quiz-answered-banner">
                已送出 ✓ 你選了 {myAnswer === 'O' ? '⭕ 對' : '❌ 錯'}
              </div>
            )}
            <p className="phone-hint">
              {quizLocked
                ? myAnswer
                  ? `時間到！你選了 ${myAnswer === 'O' ? '⭕ 對' : '❌ 錯'}`
                  : '時間到，無法作答'
                : quizAnswered
                  ? '答案已鎖定，等待主持人公佈統計'
                  : '點 ⭕ 或 ❌ 作答，主持人會看到即時統計'}
            </p>
          </>
        ) : state.mode === 'poll' ? (
          <>
            <h2 className="phone-question">{state.poll.question}</h2>
            <PollChart
              poll={state.poll}
              onVote={handleVote}
              selectedIds={myVotes}
            />
            <p className="phone-hint">
              {state.poll.multi
                ? '本題可複選：點選項勾選、再點一次取消，長條圖會即時更新。'
                : '點選一個選項投票，長條圖會即時更新；再點別的選項可以改票。'}
            </p>
          </>
        ) : (
          <>
            <h2 className="phone-question">{state.question}</h2>

            {wcAnswered ? (
              <div className="wc-done">
                <div className="wc-done-icon">✓</div>
                <div className="wc-done-title">您已經回答過此問題</div>
                <div className="wc-done-sub">等待主持人出下一題…</div>
              </div>
            ) : (
              <>
                <div className="phone-input">
                  <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && send()}
                    placeholder="用一個詞回答…"
                    maxLength={80}
                  />
                  <button className="btn-primary" onClick={send}>
                    送出
                  </button>
                </div>
                <p className="phone-hint">
                  你送出的詞會即時出現在投影幕的文字雲上，越多人打同一個詞就越大。每題限回答一次。
                </p>
              </>
            )}

            {/* 一律顯示大家的答案（不必等自己答完）— 手機縮小版文字雲 */}
            <div className="phone-cloud">
              <div className="phone-cloud-title">💬 大家的答案</div>
              {state.submissions.length === 0 ? (
                <div className="phone-cloud-empty">還沒有人回答，當第一個吧！</div>
              ) : (
                <WordCloud submissions={state.submissions} compact />
              )}
            </div>
          </>
        )}
      </div>

      <button
        className={`hand-fab ${handUp ? 'up' : ''}`}
        onClick={toggleHand}
        aria-pressed={handUp}
      >
        {handUp ? '✋ 放下手' : '✋ 舉手'}
      </button>
    </div>
  )
}
