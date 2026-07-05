import { useState, useEffect } from 'react'

// 依共享的結束時間戳 endsAt 做本機倒數，所有分頁會一起倒數。
// 回傳：remaining（剩餘秒數）、active（倒數中）、timeUp（已結束）。
export function useCountdown(endsAt) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!endsAt) return
    setNow(Date.now())
    const t = setInterval(() => {
      const n = Date.now()
      setNow(n)
      if (n >= endsAt) clearInterval(t) // 倒數結束後停止 tick
    }, 250)
    return () => clearInterval(t)
  }, [endsAt])

  if (!endsAt) return { remaining: null, active: false, timeUp: false }
  const remaining = Math.max(0, Math.ceil((endsAt - now) / 1000))
  return { remaining, active: remaining > 0, timeUp: remaining === 0 }
}
