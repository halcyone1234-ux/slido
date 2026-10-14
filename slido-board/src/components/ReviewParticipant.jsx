import { useState, useEffect, useMemo } from 'react'
import { CHOICES, toScore } from '../reviewText.js'

// 期中複習競賽（手機端）：四選一作答、答完鎖定、揭曉對錯與解析、最後看自己的分數與全班分佈。

const TILE_CLASS = { A: 'rv-a', B: 'rv-b', C: 'rv-c', D: 'rv-d' }
const TILE_ICON = { A: '▲', B: '◆', C: '●', D: '■' }

export default function ReviewParticipant({ session }) {
  const { state, myId, answerReview } = session
  const review = state.review

  if (review.status === 'lobby') {
    return (
      <div className="rvp-wait">
        <div className="rvp-wait-emoji">🏆</div>
        <h2 className="phone-question">{review.title || '期中複習競賽'}</h2>
        <p className="phone-hint">
          共 {review.total} 題四選一。等待主持人按下「開始競賽」，題目會直接出現在這裡。
        </p>
      </div>
    )
  }

  if (review.status === 'finished') return <MyResult review={review} myId={myId} />

  return <AnswerView review={review} myId={myId} answerReview={answerReview} />
}

function AnswerView({ review, myId, answerReview }) {
  const q = review.question
  const revealed = Boolean(review.reveal)
  const serverChoice = review.responses[myId] || null
  // 樂觀更新：按下立刻鎖定，不等伺服器往返；換題或伺服器回報時重新對齊
  const [pending, setPending] = useState(serverChoice)
  useEffect(() => {
    setPending(serverChoice)
  }, [serverChoice, review.gameId, review.index])
  const myChoice = serverChoice || pending
  const locked = Boolean(myChoice) || revealed

  const choose = (c) => {
    if (locked) return
    setPending(c)
    answerReview(review.index, c)
  }

  if (!q) return <p className="phone-hint">等待題目…</p>

  const correct = revealed ? review.reveal.answer : null
  const isRight = revealed && myChoice === correct

  return (
    <>
      <div className="rvp-head">
        <span className="rvp-qnum">
          {review.status === 'recap' ? '回看 ' : ''}第 {q.n} / {review.total} 題
        </span>
        {q.section && <span className="rvp-section">{q.section}</span>}
      </div>
      <h2 className="phone-question rvp-qtext">{q.text}</h2>

      {revealed && (
        <div className={`rvp-verdict ${myChoice ? (isRight ? 'right' : 'wrong') : 'none'}`}>
          {myChoice ? (isRight ? '答對了 🎉' : `答錯了，正解是 ${correct}`) : `你沒有作答，正解是 ${correct}`}
        </div>
      )}

      <div className="rvp-choices">
        {CHOICES.map((c) => {
          const cls = [
            'rvp-choice',
            TILE_CLASS[c],
            myChoice === c ? 'selected' : '',
            revealed ? (c === correct ? 'correct' : 'dim') : '',
          ].join(' ')
          return (
            <button key={c} className={cls} disabled={locked} onClick={() => choose(c)}>
              <span className="rvp-choice-letter">
                <i>{TILE_ICON[c]}</i>
                {c}
              </span>
              <span className="rvp-choice-text">{q.options[c]}</span>
              {revealed && c === correct && <span className="rvp-choice-mark">✓</span>}
              {revealed && c !== correct && myChoice === c && <span className="rvp-choice-mark">✗</span>}
            </button>
          )
        })}
      </div>

      {revealed ? (
        <div className="rvp-explain">
          <b>解析</b>
          {review.reveal.explain || '（本題無解析）'}
        </div>
      ) : myChoice ? (
        <div className="quiz-answered-banner">已送出 ✓ 你選了 {myChoice}，等待主持人公佈</div>
      ) : (
        <p className="phone-hint">點一個選項作答，送出後不能更改。</p>
      )}
    </>
  )
}

function MyResult({ review, myId }) {
  const r = review.results
  const total = r?.total || 0
  const myCorrect = r?.scoresById?.[myId]
  const answered = myCorrect !== undefined
  const myScore = toScore(myCorrect || 0, total)
  const avgScore = toScore(r?.average || 0, total)
  const dist = r?.distribution || []
  const maxDist = Math.max(1, ...dist)

  // 贏過多少比例的同學（嚴格低於自己的人數 / 全部作答人數）
  const beat = useMemo(() => {
    if (!answered || !r?.participants) return null
    const scores = Object.values(r.scoresById)
    const below = scores.filter((s) => s < myCorrect).length
    return Math.round((below / scores.length) * 100)
  }, [answered, r, myCorrect])

  const wrong = useMemo(() => {
    if (!answered) return []
    const mine = r.answersById?.[myId] || {}
    return r.perQuestion.filter((p) => mine[p.index] !== p.answer).map((p) => ({ ...p, mine: mine[p.index] || '—' }))
  }, [answered, r, myId])

  return (
    <div className="rvp-result">
      <div className="rvp-score-card">
        <div className="rvp-score-label">{answered ? '你的分數' : '你沒有參加這一輪'}</div>
        <div className="rvp-score-num">{answered ? myScore : '—'}</div>
        <div className="rvp-score-sub">
          {answered ? `答對 ${myCorrect} / ${total} 題` : `共 ${total} 題`}
          {beat !== null && ` · 贏過 ${beat}% 的同學`}
        </div>
        <div className="rvp-score-avg">全班平均 {avgScore} 分（{r?.participants || 0} 人作答）</div>
      </div>

      <div className="rvp-panel">
        <div className="rvp-panel-title">全班答對題數分佈</div>
        <div className="rv-hist rv-hist-sm">
          {dist.map((count, k) => (
            <div key={k} className={`rv-hist-col ${answered && k === myCorrect ? 'me' : ''}`}>
              <span className="rv-hist-count">{count > 0 ? count : ''}</span>
              <div className="rv-hist-bar" style={{ height: `${Math.round((count / maxDist) * 100)}%` }} />
              <span className="rv-hist-label">{k}</span>
            </div>
          ))}
        </div>
        {answered && <div className="rvp-hist-note">藍色＝你的位置</div>}
      </div>

      {answered && (
        <div className="rvp-panel">
          <div className="rvp-panel-title">
            {wrong.length === 0 ? '全部答對，太強了 🎉' : `要加強的 ${wrong.length} 題`}
          </div>
          <ul className="rvp-wrong-list">
            {wrong.map((p) => (
              <li key={p.index}>
                <span className="rvp-wrong-n">Q{p.n}</span>
                <span className="rvp-wrong-body">
                  <small>{p.section}</small>
                  {p.text}
                  <em>
                    你選 {p.mine} · 正解 {p.answer}
                  </em>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
