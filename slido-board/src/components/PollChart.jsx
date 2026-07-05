import { useMemo } from 'react'

const BAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#06b6d4', '#3b82f6', '#ef4444',
]

// 即時投票。onVote 有傳入時每條可點（參與者端）；否則唯讀（投影幕）。
// selectedId 標示目前這位參與者投的選項。
export default function PollChart({ poll, onVote, selectedId }) {
  const total = useMemo(
    () => poll.options.reduce((sum, o) => sum + o.votes, 0),
    [poll.options],
  )

  if (poll.options.length === 0) {
    return <div className="cloud-empty">主持人尚未設定投票選項…</div>
  }

  return (
    <div className="poll">
      {poll.options.map((o, i) => {
        const pct = total === 0 ? 0 : Math.round((o.votes / total) * 100)
        const color = BAR_COLORS[i % BAR_COLORS.length]
        const active = o.id === selectedId
        return (
          <button
            key={o.id}
            className={`poll-row ${onVote ? 'poll-row-clickable' : ''} ${
              active ? 'poll-row-active' : ''
            }`}
            onClick={onVote ? () => onVote(o.id) : undefined}
            disabled={!onVote}
            style={{ '--bar': color }}
          >
            <span className="poll-fill" style={{ width: `${pct}%` }} />
            <span className="poll-label">
              {active && <span className="poll-check">✓</span>}
              {o.label}
            </span>
            <span className="poll-num">
              {pct}% · {o.votes}
            </span>
          </button>
        )
      })}
      <div className="poll-total">共 {total} 票</div>
    </div>
  )
}
