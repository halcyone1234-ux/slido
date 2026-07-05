import { useRef, useEffect } from 'react'
import { subscribe } from '../dinoBus.js'

// Chrome 斷線恐龍風格的待機小遊戲（投影幕）。
// 跳躍來源：投影幕點擊 / 空白鍵、以及參與者透過 dino 頻道送來的「跳」訊號。
const W = 900
const H = 280
const GROUND = 230
const DINO_X = 120
const DINO_W = 46
const DINO_H = 50
const OBS_W = 34
const OBS_H = 46
const TEACHER_MS = 60000 // 玩滿 60 秒，老師登場把恐龍抓走 XD

export default function DinoGame({ onExit, onScore }) {
  const canvasRef = useRef(null)
  const gameRef = useRef(null)

  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d')
    const g = {
      elevation: 0,
      vy: 0,
      onGround: true,
      obstacles: [],
      nextGap: 55,
      score: 0,
      speed: 6,
      over: false,
      overAt: 0,
      raf: 0,
      frames: 0,
      reportedBest: 0,
      startAt: performance.now(),
      teacherX: null, // 老師登場後的 x 位置
      caught: false, // 是否被老師抓到
    }
    gameRef.current = g

    // 回傳目前最佳分數（只在刷新最佳時送）
    const report = () => {
      const disp = Math.floor(g.score / 5)
      if (onScore && disp > g.reportedBest) {
        g.reportedBest = disp
        onScore(disp)
      }
    }

    const jump = () => {
      if (g.over) return
      if (g.onGround) {
        g.vy = 15.5
        g.onGround = false
      }
    }
    g.jump = jump

    const reset = () => {
      g.elevation = 0
      g.vy = 0
      g.onGround = true
      g.obstacles = []
      g.nextGap = 55
      g.score = 0
      g.speed = 6
      g.over = false
    }

    const tick = () => {
      if (!g.over) {
        if (!g.onGround) {
          g.elevation += g.vy
          g.vy -= 0.9
          if (g.elevation <= 0) {
            g.elevation = 0
            g.vy = 0
            g.onGround = true
          }
        }

        // 玩滿 60 秒 → 老師登場，清空仙人掌、快步追過來
        if (g.teacherX === null && performance.now() - g.startAt >= TEACHER_MS) {
          g.teacherX = W + 60
          g.obstacles = []
        }

        if (g.teacherX === null) {
          g.nextGap -= 1
          if (g.nextGap <= 0) {
            g.obstacles.push({ x: W + 20 })
            g.nextGap = 70 + Math.floor(Math.random() * 70)
          }
          for (const o of g.obstacles) o.x -= g.speed
          g.obstacles = g.obstacles.filter((o) => o.x > -50)
        } else {
          g.teacherX -= 11 // 老師比仙人掌更快，逃不掉 XD
          if (g.teacherX <= DINO_X + 30) {
            g.teacherX = DINO_X + 30
            g.caught = true
            g.over = true
            g.overAt = performance.now()
            report()
          }
        }

        g.score += 1
        g.speed = 6 + g.score / 500
        g.frames += 1
        if (g.frames % 30 === 0) report() // 每 ~0.5 秒回傳一次最佳分

        // 撞到仙人掌
        const dx = DINO_X + 8
        const dy = GROUND - DINO_H - g.elevation
        const dw = DINO_W - 16
        const dh = DINO_H - 8
        for (const o of g.obstacles) {
          const ox = o.x + 6
          const oy = GROUND - OBS_H
          const ow = OBS_W - 12
          if (
            dx < ox + ow &&
            dx + dw > ox &&
            dy < oy + OBS_H &&
            dy + dh > oy
          ) {
            g.over = true
            g.overAt = performance.now()
            report()
          }
        }
      } else if (!g.caught && performance.now() - g.overAt > 1600) {
        reset() // 被老師抓到是終局，不重新開始
      }

      // 繪製
      ctx.clearRect(0, 0, W, H)
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(0, GROUND + 3)
      ctx.lineTo(W, GROUND + 3)
      ctx.stroke()

      ctx.textBaseline = 'alphabetic'
      ctx.font = '46px serif'
      const lift = g.caught ? 22 : 0 // 被抓到時恐龍被拎起來
      ctx.fillText('🦖', DINO_X, GROUND - g.elevation - lift)
      ctx.font = '40px serif'
      for (const o of g.obstacles) ctx.fillText('🌵', o.x, GROUND)
      if (g.teacherX !== null) {
        ctx.font = '54px serif'
        ctx.fillText('🧑‍🏫', g.teacherX, GROUND)
      }

      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      ctx.font = 'bold 22px system-ui, sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText(String(Math.floor(g.score / 5)).padStart(5, '0'), W - 24, 40)
      ctx.textAlign = 'left'

      if (g.over) {
        ctx.fillStyle = 'rgba(255,255,255,0.95)'
        ctx.textAlign = 'center'
        if (g.caught) {
          ctx.font = 'bold 32px system-ui, sans-serif'
          ctx.fillText('🧑‍🏫 被老師抓走了！', W / 2, H / 2 - 8)
          ctx.font = '18px system-ui, sans-serif'
          ctx.fillText(
            `分數 ${Math.floor(g.score / 5)} · 該回來上課囉`,
            W / 2,
            H / 2 + 22,
          )
        } else {
          ctx.font = 'bold 34px system-ui, sans-serif'
          ctx.fillText('G A M E   O V E R', W / 2, H / 2 - 6)
          ctx.font = '17px system-ui, sans-serif'
          ctx.fillText('即將重新開始…', W / 2, H / 2 + 24)
        }
        ctx.textAlign = 'left'
      }

      g.raf = requestAnimationFrame(tick)
    }
    g.raf = requestAnimationFrame(tick)

    const onKey = (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault()
        jump()
      } else if (e.code === 'Escape' && onExit) {
        onExit()
      }
    }
    window.addEventListener('keydown', onKey)
    const unsub = subscribe((ev) => {
      if (ev.data && ev.data.type === 'jump') jump()
    })

    return () => {
      cancelAnimationFrame(g.raf)
      window.removeEventListener('keydown', onKey)
      unsub()
    }
  }, [onExit, onScore])

  return (
    <div className="dino-overlay" onClick={() => gameRef.current?.jump()}>
      {onExit && (
        <div className="dino-head" onClick={(e) => e.stopPropagation()}>
          <span>💤 待機中 · 小恐龍快跑！</span>
          <button className="dino-exit" onClick={onExit}>
            離開 ✕
          </button>
        </div>
      )}
      <canvas ref={canvasRef} width={W} height={H} className="dino-canvas" />
      <div className="dino-hint">
        {onExit
          ? '按空白鍵 / 點擊畫面讓恐龍越過仙人掌'
          : '點畫面讓恐龍跳過仙人掌！🦖'}
      </div>
    </div>
  )
}
