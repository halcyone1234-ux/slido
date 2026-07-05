import { useState, useEffect, useCallback } from 'react'
import PollChart from './PollChart.jsx'
import AuctionParticipant from './AuctionParticipant.jsx'
import { getMyName } from '../identity.js'
import { checkRoom } from '../api.js'
import { useSession } from '../useSession.js'
import { useCountdown } from '../useCountdown.js'
import { subscribe, sendScore } from '../dinoBus.js'
import DinoGame from './DinoGame.jsx'

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
  const { state, myId, submit, votePoll, answerQuiz, join, leave } = session
  const [text, setText] = useState('')
  const [justSent, setJustSent] = useState(false)
  const [myVote, setMyVote] = useState(null) // 這位參與者投的選項 id

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

  // 恐龍待機遊戲：收到投影幕的心跳就顯示「跳」鈕，超過 4 秒沒心跳則隱藏
  const [dinoOn, setDinoOn] = useState(false)
  useEffect(() => {
    let hideTimer
    const unsub = subscribe((e) => {
      if (!e.data || e.data.type !== 'game') return
      clearTimeout(hideTimer)
      if (e.data.active) {
        setDinoOn(true)
        hideTimer = setTimeout(() => setDinoOn(false), 4000)
      } else {
        setDinoOn(false)
      }
    })
    return () => {
      unsub()
      clearTimeout(hideTimer)
    }
  }, [])

  const reportScore = useCallback(
    (score) => sendScore({ id: myId, name: getMyName(), score }),
    [myId],
  )

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
    if (optionId === myVote) return
    votePoll(optionId, myVote) // 傳入舊選項以支援「改票」
    setMyVote(optionId)
  }

  const myAnswer = state.quiz.responses[myId] || null

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
        </span>

        {state.mode === 'auction' ? (
          <AuctionParticipant session={session} />
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
                disabled={quizLocked}
                onClick={() => answerQuiz(myId, 'O')}
              >
                <span className="quiz-choice-mark">⭕</span>
                <span className="quiz-choice-label">對</span>
              </button>
              <button
                className={`quiz-choice quiz-choice-x ${
                  myAnswer === 'X' ? 'selected' : ''
                }`}
                disabled={quizLocked}
                onClick={() => answerQuiz(myId, 'X')}
              >
                <span className="quiz-choice-mark">❌</span>
                <span className="quiz-choice-label">錯</span>
              </button>
            </div>
            <p className="phone-hint">
              {quizLocked
                ? myAnswer
                  ? `時間到！你選了 ${myAnswer === 'O' ? '⭕ 對' : '❌ 錯'}`
                  : '時間到，無法作答'
                : myAnswer
                  ? '已作答 ✓ 想改的話再點另一個即可'
                  : '點 ⭕ 或 ❌ 作答，主持人會看到即時統計'}
            </p>
          </>
        ) : state.mode === 'poll' ? (
          <>
            <h2 className="phone-question">{state.poll.question}</h2>
            <PollChart
              poll={state.poll}
              onVote={handleVote}
              selectedId={myVote}
            />
            <p className="phone-hint">
              點選一個選項投票，長條圖會即時更新；再點別的選項可以改票。
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
          </>
        )}
      </div>

      {dinoOn && <DinoGame onScore={reportScore} />}
    </div>
  )
}
