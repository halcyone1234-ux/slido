import { useMemo } from 'react'
import { useCountdown } from '../useCountdown.js'

// 主持人端：Kahoot 風格版面 + 倒數計時 + 參加/已答人數。
// 倒數進行中：隱藏圈叉分佈（製造懸念），只顯示已作答人數。
// 未計時或時間到：揭曉圈叉統計。
export default function QuizStats({ quiz, joined }) {
  const { remaining, active, timeUp } = useCountdown(quiz.endsAt)

  const { o, x, total } = useMemo(() => {
    let o = 0
    let x = 0
    for (const c of Object.values(quiz.responses)) {
      if (c === 'O') o += 1
      else if (c === 'X') x += 1
    }
    return { o, x, total: o + x }
  }, [quiz.responses])

  const oPct = total === 0 ? 50 : Math.round((o / total) * 100)
  const xPct = total === 0 ? 50 : 100 - oPct
  const reveal = !active // 沒在倒數（含時間到、或未開始計時）就揭曉

  return (
    <div className="quiz2">
      {/* 頂部資訊列 */}
      <div className="quiz2-bar">
        <div className="quiz2-timer-slot">
          {active ? (
            <div
              className={`quiz2-timer ${remaining <= 5 ? 'urgent' : ''}`}
            >
              {remaining}
            </div>
          ) : quiz.endsAt ? (
            <div className="quiz2-timeup">時間到</div>
          ) : (
            <div className="quiz2-timer-idle">未計時</div>
          )}
        </div>
        <div className="quiz2-meta">
          {active && <span className="quiz2-status">作答中…</span>}
          <span className="quiz2-stat">
            <b>{joined}</b> 人參加
          </span>
          <span className="quiz2-stat quiz2-stat-answered">
            <b>{total}</b> 已作答
          </span>
        </div>
      </div>

      {/* 兩張大答案磚 */}
      <div className="quiz2-tiles">
        <div className={`quiz2-tile t-o ${reveal ? 'revealed' : ''}`}>
          <span className="t-icon t-icon-o" />
          <div className="t-name">對</div>
          {reveal && (
            <div className="t-result">
              <span className="t-count">{o}</span>
              <span className="t-pct">{total === 0 ? '0%' : `${oPct}%`}</span>
            </div>
          )}
        </div>
        <div className={`quiz2-tile t-x ${reveal ? 'revealed' : ''}`}>
          <span className="t-icon t-icon-x" />
          <div className="t-name">錯</div>
          {reveal && (
            <div className="t-result">
              <span className="t-count">{x}</span>
              <span className="t-pct">{total === 0 ? '0%' : `${xPct}%`}</span>
            </div>
          )}
        </div>
      </div>

      {/* 底部：揭曉後才顯示比例條（作答中的狀態改放右上角） */}
      {reveal && (
        <div className="quiz2-splitbar">
          <span className="quiz2-split-o" style={{ width: `${oPct}%` }} />
          <span className="quiz2-split-x" style={{ width: `${xPct}%` }} />
        </div>
      )}
    </div>
  )
}
