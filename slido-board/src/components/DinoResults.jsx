import { useMemo } from 'react'

const MEDALS = ['🥇', '🥈', '🥉']

// 主持人收回遊戲時顯示：本輪誰的恐龍跳最遠。
export default function DinoResults({ scores, onClose }) {
  const ranking = useMemo(
    () =>
      Object.values(scores)
        .sort((a, b) => b.best - a.best)
        .slice(0, 10),
    [scores],
  )

  return (
    <div className="ov-overlay" onClick={onClose}>
      <div className="ov-panel" onClick={(e) => e.stopPropagation()}>
        <button className="qr-close" onClick={onClose} aria-label="關閉">
          ✕
        </button>
        <h2 className="ov-title">🦖 本輪恐龍戰績</h2>
        {ranking.length === 0 ? (
          <div className="ov-empty">這輪沒有人玩到分數</div>
        ) : (
          <ol className="dino-rank">
            {ranking.map((r, i) => (
              <li className={`dino-rank-row ${i < 3 ? 'top' : ''}`} key={i}>
                <span className="dino-rank-pos">{MEDALS[i] || i + 1}</span>
                <span className="dino-rank-name">{r.name}</span>
                <span className="dino-rank-score">{r.best}</span>
              </li>
            ))}
          </ol>
        )}
        <p className="dino-rank-hint">跳最遠的同學，掌聲鼓勵 👏</p>
      </div>
    </div>
  )
}
