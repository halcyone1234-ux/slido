import { useMemo } from 'react'

const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#06b6d4', '#3b82f6', '#ef4444',
]

// 依文字（去空白、轉小寫）彙總計數，字級隨次數放大。
function aggregate(submissions) {
  const map = new Map()
  for (const s of submissions) {
    const key = s.text.trim().toLowerCase()
    if (!key) continue
    const prev = map.get(key)
    if (prev) prev.count += 1
    else map.set(key, { text: s.text.trim(), count: 1 })
  }
  return [...map.values()].sort((a, b) => b.count - a.count)
}

export default function WordCloud({ submissions }) {
  const words = useMemo(() => aggregate(submissions), [submissions])

  if (words.length === 0) {
    return (
      <div className="cloud-empty">
        還沒有人送出答案 · 等待參與者輸入…
      </div>
    )
  }

  const maxCount = words[0].count

  return (
    <div className="wordcloud">
      {words.map((w, i) => {
        // 字級 20 ~ 88px，依相對次數內插
        const ratio = maxCount === 1 ? 1 : w.count / maxCount
        const size = 20 + ratio * 68
        return (
          <span
            key={w.text + i}
            className="cloud-word"
            style={{
              fontSize: `${size}px`,
              color: COLORS[i % COLORS.length],
              opacity: 0.55 + ratio * 0.45,
            }}
            title={`${w.count} 次`}
          >
            {w.text}
            {w.count > 1 && <sup className="cloud-count">{w.count}</sup>}
          </span>
        )
      })}
    </div>
  )
}
