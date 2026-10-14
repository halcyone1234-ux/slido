import { useState, useEffect, useMemo } from 'react'
import { CHOICES, parseBankText, formatBankText, toScore } from '../reviewText.js'

// 期中複習競賽（投影幕）：Kahoot 式四選一。
// lobby → question（即時顯示已答人數）→ reveal（ABCD 分佈＋正解＋解析）→ 下一題 … → finished（成績分佈）
// finished 可點「錯最多的題目」回看（recap）那題的統計與解析，做加強複習。

const TILE_CLASS = { A: 'rv-a', B: 'rv-b', C: 'rv-c', D: 'rv-d' }
const TILE_ICON = { A: '▲', B: '◆', C: '●', D: '■' }

export default function ReviewPresenter({ session }) {
  const { state } = session
  const review = state.review
  const joined = Object.keys(state.presence).length

  if (review.status === 'lobby') return <Lobby session={session} review={review} joined={joined} />
  if (review.status === 'finished') return <Results session={session} review={review} />
  return <Question session={session} review={review} joined={joined} />
}

// ---------- 大廳：題庫、開始 ----------
function Lobby({ session, review, joined }) {
  const { startReview, setReviewQuestions, useDefaultReview } = session
  const [editing, setEditing] = useState(false)
  const bank = review.bank
  const [draft, setDraft] = useState('')
  const [errors, setErrors] = useState([])
  const [saved, setSaved] = useState(false)

  // 伺服器題庫更新 → 同步到編輯器（未開啟編輯時）
  useEffect(() => {
    if (!editing && bank) setDraft(formatBankText(bank.title, bank.questions))
  }, [bank, editing])

  const parsed = useMemo(() => (editing ? parseBankText(draft) : null), [editing, draft])

  const apply = () => {
    const { title, questions, errors: errs } = parseBankText(draft)
    setErrors(errs)
    if (errs.length) return
    setReviewQuestions(title || bank?.title || '複習競賽', questions)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
    setEditing(false)
  }

  const sections = useMemo(() => {
    const map = new Map()
    for (const q of bank?.questions || []) map.set(q.section || '未分章節', (map.get(q.section || '未分章節') || 0) + 1)
    return [...map.entries()]
  }, [bank])

  return (
    <div className="rv rv-lobby">
      <div className="rv-lobby-hero">
        <div className="rv-kicker">🏆 期中複習競賽</div>
        <h1 className="rv-title">{review.title || '複習競賽'}</h1>
        <div className="rv-lobby-meta">
          <span className="quiz2-stat">
            <b>{review.total}</b> 題
          </span>
          <span className="quiz2-stat quiz2-stat-answered">
            <b>{joined}</b> 人在線
          </span>
        </div>
        <div className="rv-sections">
          {sections.map(([name, count]) => (
            <span key={name} className="rv-section-chip">
              {name} <b>{count}</b>
            </span>
          ))}
        </div>
        <div className="rv-lobby-actions">
          <button className="rv-big-btn" onClick={startReview} disabled={review.total === 0}>
            ▶ 開始競賽
          </button>
          <button className="btn-ghost rv-ghost" onClick={() => setEditing((v) => !v)}>
            {editing ? '收起題庫' : '✏️ 編輯題庫'}
          </button>
        </div>
        <p className="rv-lobby-hint">
          學生用手機掃 QR 加入後，每題四選一作答；你按「結束作答」公佈分佈與正解，按「下一題」繼續。
          全部答完後看成績分佈，點錯最多的題目可以回看加強複習。
        </p>
      </div>

      {editing && (
        <div className="rv-editor">
          <div className="rv-editor-head">
            <span>
              題庫文字（{parsed?.questions.length || 0} 題）— 格式：<code>[章節]</code>、
              <code>1. 題目</code>、<code>(A)…(D)</code>、<code>答：C</code>、<code>解：…</code>
            </span>
            <div className="rv-editor-btns">
              <button className="btn-ghost rv-ghost" onClick={useDefaultReview}>
                載回預設 25 題
              </button>
              <button className="btn-primary" onClick={apply}>
                {saved ? '已套用 ✓' : '套用題庫'}
              </button>
            </div>
          </div>
          <textarea
            className="rv-editor-text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
            rows={18}
          />
          {errors.length > 0 && (
            <ul className="rv-editor-errors">
              {errors.slice(0, 6).map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

// ---------- 作答中／揭曉／回看 ----------
function Question({ session, review, joined }) {
  const { endReviewQuestion, nextReviewQuestion, finishReview, showReviewResults } = session
  const q = review.question
  const revealed = Boolean(review.reveal)
  const isRecap = review.status === 'recap'
  const isLast = review.index + 1 >= review.total
  const counts = review.reveal?.counts || { A: 0, B: 0, C: 0, D: 0 }
  const answered = revealed ? CHOICES.reduce((s, c) => s + counts[c], 0) : review.answeredCount
  const maxCount = Math.max(1, ...CHOICES.map((c) => counts[c]))
  const progress = joined === 0 ? 0 : Math.min(100, Math.round((review.answeredCount / joined) * 100))

  if (!q) return <div className="cloud-empty">題庫是空的，請回大廳編輯題庫。</div>

  return (
    <div className={`rv rv-q ${revealed ? 'revealed' : ''}`}>
      <div className="rv-qbar">
        <div className="rv-qbar-left">
          <span className="rv-qnum">
            {isRecap ? '回看 ' : ''}第 {q.n} / {review.total} 題
          </span>
          {q.section && <span className="rv-qsection">{q.section}</span>}
        </div>
        <div className="rv-qbar-right">
          {!revealed && <span className="quiz2-status">作答中…</span>}
          <span className="quiz2-stat">
            <b>{joined}</b> 在線
          </span>
          <span className="quiz2-stat quiz2-stat-answered">
            <b>{answered}</b> 已回答
          </span>
        </div>
      </div>

      {!revealed && (
        <div className="rv-progress">
          <span style={{ width: `${progress}%` }} />
        </div>
      )}

      <h1 className="rv-qtext">{q.text}</h1>

      <div className="rv-tiles">
        {CHOICES.map((c) => {
          const isCorrect = revealed && review.reveal.answer === c
          const n = counts[c]
          const pct = answered === 0 ? 0 : Math.round((n / answered) * 100)
          return (
            <div
              key={c}
              className={`rv-tile ${TILE_CLASS[c]} ${revealed ? (isCorrect ? 'correct' : 'wrong') : ''}`}
            >
              <div className="rv-tile-head">
                <span className="rv-tile-letter">
                  <i>{TILE_ICON[c]}</i> {c}
                </span>
                {revealed && (
                  <span className="rv-tile-count">
                    {n} 人 · {pct}%{isCorrect && ' ✓'}
                  </span>
                )}
              </div>
              <div className="rv-tile-text">{q.options[c]}</div>
              {revealed && (
                <div className="rv-tile-bar">
                  <span style={{ width: `${Math.round((n / maxCount) * 100)}%` }} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {revealed && (
        <div className="rv-explain">
          <span className="rv-explain-tag">正解 {review.reveal.answer}</span>
          <span className="rv-explain-text">{review.reveal.explain || '（本題無解析）'}</span>
        </div>
      )}

      <div className="rv-actions">
        {isRecap ? (
          <button className="rv-big-btn" onClick={showReviewResults}>
            ← 回成績頁
          </button>
        ) : !revealed ? (
          <>
            <button className="rv-big-btn rv-btn-end" onClick={endReviewQuestion}>
              ⏹ 結束作答，公佈答案
            </button>
            <button className="btn-ghost rv-ghost" onClick={finishReview}>
              提早結束，看成績
            </button>
          </>
        ) : (
          <>
            <button className="rv-big-btn" onClick={nextReviewQuestion}>
              {isLast ? '🏁 看成績' : '下一題 →'}
            </button>
            {!isLast && (
              <button className="btn-ghost rv-ghost" onClick={finishReview}>
                提早結束，看成績
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ---------- 成績：全班分佈＋錯最多的題目 ----------
function Results({ session, review }) {
  const { recapReview, resetReview, startReview } = session
  const r = review.results
  const total = r?.total || 0
  const dist = r?.distribution || []
  const maxDist = Math.max(1, ...dist)
  const avgScore = toScore(r?.average || 0, total)
  const hardest = useMemo(
    () =>
      [...(r?.perQuestion || [])]
        .filter((p) => p.answered > 0)
        .sort((a, b) => a.correctRate - b.correctRate || b.answered - a.answered),
    [r],
  )

  return (
    <div className="rv rv-results">
      <div className="rv-results-head">
        <div>
          <div className="rv-kicker">🏁 成績揭曉</div>
          <h1 className="rv-title">{review.title}</h1>
        </div>
        <div className="rv-results-stats">
          <div className="rv-stat-card">
            <div className="rv-stat-num">{avgScore}</div>
            <div className="rv-stat-label">全班平均分</div>
          </div>
          <div className="rv-stat-card">
            <div className="rv-stat-num">
              {(r?.average || 0).toFixed(1)}
              <small>/{total}</small>
            </div>
            <div className="rv-stat-label">平均答對題數</div>
          </div>
          <div className="rv-stat-card">
            <div className="rv-stat-num">{r?.participants || 0}</div>
            <div className="rv-stat-label">人作答</div>
          </div>
        </div>
      </div>

      <div className="rv-results-grid">
        <section className="rv-panel">
          <h3 className="rv-panel-title">答對題數分佈</h3>
          <div className="rv-hist">
            {dist.map((count, k) => (
              <div key={k} className="rv-hist-col" title={`答對 ${k} 題：${count} 人`}>
                <span className="rv-hist-count">{count > 0 ? count : ''}</span>
                <div className="rv-hist-bar" style={{ height: `${Math.round((count / maxDist) * 100)}%` }} />
                <span className="rv-hist-label">{k}</span>
              </div>
            ))}
          </div>
          <div className="rv-hist-axis">答對題數（滿分 {total} 題＝100 分）</div>
        </section>

        <section className="rv-panel">
          <h3 className="rv-panel-title">錯最多的題目 · 點一題回看加強複習</h3>
          <ol className="rv-hard-list">
            {hardest.length === 0 && <li className="rv-hard-empty">沒有人作答</li>}
            {hardest.map((p) => {
              const rate = Math.round((p.correctRate || 0) * 100)
              return (
                <li key={p.index}>
                  <button className="rv-hard-row" onClick={() => recapReview(p.index)}>
                    <span className={`rv-hard-rate ${rate < 50 ? 'bad' : rate < 75 ? 'mid' : 'ok'}`}>{rate}%</span>
                    <span className="rv-hard-n">Q{p.n}</span>
                    <span className="rv-hard-text">
                      <small>{p.section}</small>
                      {p.text}
                    </span>
                    <span className="rv-hard-ans">正解 {p.answer}</span>
                  </button>
                </li>
              )
            })}
          </ol>
        </section>
      </div>

      <div className="rv-actions">
        <button className="rv-big-btn" onClick={startReview}>
          🔁 再比一次（同一份題庫）
        </button>
        <button className="btn-ghost rv-ghost" onClick={resetReview}>
          回大廳（可改題庫）
        </button>
      </div>
    </div>
  )
}
