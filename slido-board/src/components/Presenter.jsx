import { useState, useEffect, useRef } from 'react'
import { useSession, SAMPLE_QUESTIONS } from '../useSession.js'
import { createRoom } from '../api.js'
import WordCloud from './WordCloud.jsx'
import PollChart from './PollChart.jsx'
import QuizStats from './QuizStats.jsx'
import QrJoin from './QrJoin.jsx'
import AuctionPresenter from './AuctionPresenter.jsx'

function usePresenterRoom(roomCode) {
  const [code, setCode] = useState(roomCode)
  const [presenterToken, setPresenterToken] = useState(() =>
    roomCode ? localStorage.getItem(`slido-presenter-token-${roomCode}`) : null,
  )
  const [error, setError] = useState(null)
  const creatingRef = useRef(false)

  useEffect(() => {
    if (roomCode) {
      const token = localStorage.getItem(`slido-presenter-token-${roomCode}`)
      if (!token) {
        setError('找不到主持人權限，請回首頁建立新房間')
        return
      }
      setCode(roomCode)
      setPresenterToken(token)
      return
    }
    if (creatingRef.current) return
    creatingRef.current = true
    createRoom()
      .then(({ code: newCode, presenterToken: newToken }) => {
        localStorage.setItem(`slido-presenter-token-${newCode}`, newToken)
        localStorage.setItem('slido-last-room-code', newCode)
        window.location.hash = `#present/${newCode}`
        setCode(newCode)
        setPresenterToken(newToken)
      })
      .catch(() => setError('建立房間失敗，請重新整理再試'))
  }, [roomCode])

  return { code, presenterToken, error }
}

export default function Presenter({ roomCode }) {
  const { code, presenterToken, error } = usePresenterRoom(roomCode)
  const session = useSession(code && presenterToken ? { role: 'presenter', roomCode: code, presenterToken } : null)

  if (error) return <div className="stage-loading">{error}</div>
  if (!code || !session.connected) return <div className="stage-loading">連線中…</div>

  return <PresenterStage session={session} roomCode={code} />
}

function PresenterStage({ session, roomCode }) {
  const {
    state,
    setQuestion,
    setMode,
    clearSubmissions,
    setPoll,
    resetPoll,
    setQuizQuestion,
    resetQuiz,
    startQuizRound,
    endQuizRound,
    clearHands,
  } = session
  const hands = state.hands || []
  const [draft, setDraft] = useState(state.question)
  const [pollQ, setPollQ] = useState(state.poll.question)
  const [pollOpts, setPollOpts] = useState(
    state.poll.options.map((o) => o.label).join('\n'),
  )
  const [pollMulti, setPollMulti] = useState(Boolean(state.poll.multi))
  const [quizDraft, setQuizDraft] = useState(state.quiz.question)
  const [showQr, setShowQr] = useState(false)

  const applyQuestion = () => {
    if (draft.trim()) setQuestion(draft.trim())
  }

  const applyPoll = () => {
    setPoll(pollQ.trim() || '投票', pollOpts.split('\n'), pollMulti)
  }

  const isAuction = state.mode === 'auction'

  return (
    <div className="stage">
      <header className="stage-top">
        <div className="brand brand-light">
          <span className="brand-dot" />
          互動黑板 · 投影幕
        </div>
        <div className="stage-top-right">
          <div className="mode-switch">
            <button
              className={state.mode === 'wordcloud' ? 'active' : ''}
              onClick={() => setMode('wordcloud')}
            >
              ☁️ 文字雲
            </button>
            <button
              className={state.mode === 'poll' ? 'active' : ''}
              onClick={() => setMode('poll')}
            >
              📊 投票
            </button>
            <button
              className={state.mode === 'quiz' ? 'active' : ''}
              onClick={() => setMode('quiz')}
            >
              ⭕❌ 快問快答
            </button>
            <button
              className={state.mode === 'auction' ? 'active' : ''}
              onClick={() => setMode('auction')}
            >
              🔨 拍賣會
            </button>
          </div>
          <button className="qr-btn" onClick={() => setShowQr(true)}>
            📷 加入 QR
          </button>
        </div>
      </header>

      {isAuction ? (
        <main className="stage-main stage-main-auction">
          <AuctionPresenter session={session} />
        </main>
      ) : (
        <>
          <div className="stage-controls">
            {state.mode === 'poll' ? (
              <div className="poll-editor">
                <input
                  className="poll-q"
                  value={pollQ}
                  onChange={(e) => setPollQ(e.target.value)}
                  placeholder="投票題目…"
                />
                <textarea
                  className="poll-opts"
                  value={pollOpts}
                  onChange={(e) => setPollOpts(e.target.value)}
                  placeholder="每行一個選項"
                  rows={4}
                />
                <div className="poll-editor-btns">
                  <label className="poll-multi-toggle">
                    <input
                      type="checkbox"
                      checked={pollMulti}
                      onChange={(e) => setPollMulti(e.target.checked)}
                    />
                    允許複選
                  </label>
                  <button className="btn-primary" onClick={applyPoll}>
                    更新投票
                  </button>
                  <button className="btn-ghost" onClick={resetPoll}>
                    票數歸零
                  </button>
                </div>
              </div>
            ) : state.mode === 'quiz' ? (
              <div className="quiz-ctrl">
                <div className="q-editor">
                  <input
                    value={quizDraft}
                    onChange={(e) => setQuizDraft(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === 'Enter' &&
                      setQuizQuestion(quizDraft.trim() || '是非題')
                    }
                    placeholder="輸入是非題，例如：地球是平的，對嗎？"
                  />
                  <button
                    className="btn-primary"
                    onClick={() =>
                      setQuizQuestion(quizDraft.trim() || '是非題')
                    }
                  >
                    出題
                  </button>
                  <button className="btn-ghost" onClick={resetQuiz}>
                    清除作答
                  </button>
                </div>
                <div className="quiz-timer-ctrl">
                  <span className="quiz-timer-label">⏱ 開始倒數：</span>
                  {[10, 20, 30].map((s) => (
                    <button
                      key={s}
                      className="chip"
                      onClick={() => startQuizRound(s)}
                    >
                      {s} 秒
                    </button>
                  ))}
                  <button className="chip chip-reveal" onClick={endQuizRound}>
                    ⏹ 公佈答案
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="q-editor">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && applyQuestion()}
                    placeholder="輸入要問大家的問題…"
                  />
                  <button className="btn-primary" onClick={applyQuestion}>
                    更新題目
                  </button>
                  <button className="btn-ghost" onClick={clearSubmissions}>
                    清除答案
                  </button>
                </div>
                <div className="q-samples">
                  {SAMPLE_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      className="chip"
                      onClick={() => {
                        setDraft(q)
                        setQuestion(q)
                      }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <main className="stage-main">
            <h1 className="stage-question">
              {state.mode === 'poll'
                ? state.poll.question
                : state.mode === 'quiz'
                  ? state.quiz.question
                  : state.question}
              {state.mode === 'poll' && state.poll.multi && (
                <span className="poll-multi-badge">可複選</span>
              )}
            </h1>
            <div className="stage-display">
              {state.mode === 'wordcloud' && (
                <WordCloud submissions={state.submissions} />
              )}
              {state.mode === 'poll' && <PollChart poll={state.poll} />}
              {state.mode === 'quiz' && (
                <QuizStats
                  quiz={state.quiz}
                  joined={Object.keys(state.presence).length}
                />
              )}
            </div>
          </main>
        </>
      )}

      <footer className="stage-foot">
        參與者請在另一個分頁開啟 <code>#join</code>，或按右上角
        <strong> 📷 加入 QR</strong> 掃描
      </footer>

      {hands.length > 0 && (
        <div className="hands-panel">
          <div className="hands-panel-head">
            <span className="hands-count">✋ {hands.length} 人舉手</span>
            <button className="hands-clear" onClick={clearHands}>
              全部放下
            </button>
          </div>
          <div className="hands-names">
            {hands.map((h) => (
              <span key={h.id} className="hand-chip">
                {h.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {showQr && <QrJoin roomCode={roomCode} onClose={() => setShowQr(false)} />}
    </div>
  )
}
