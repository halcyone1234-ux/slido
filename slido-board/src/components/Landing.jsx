import { useState } from 'react'
import { createRoom, checkRoom } from '../api.js'

export default function Landing() {
  const [creating, setCreating] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState('')

  const lastRoom = localStorage.getItem('slido-last-room-code')
  const hasResumableRoom = lastRoom && localStorage.getItem(`slido-presenter-token-${lastRoom}`)

  const handleCreate = async () => {
    setCreating(true)
    try {
      const { code, presenterToken } = await createRoom()
      localStorage.setItem(`slido-presenter-token-${code}`, presenterToken)
      localStorage.setItem('slido-last-room-code', code)
      window.location.hash = `#present/${code}`
    } catch {
      setCreating(false)
    }
  }

  const handleJoin = async () => {
    const code = joinCode.trim().toUpperCase()
    if (!code) return
    const { active } = await checkRoom(code)
    if (!active) {
      setJoinError('找不到這個房間，請確認房號')
      return
    }
    window.location.hash = `#join/${code}`
  }

  return (
    <div className="landing">
      <div className="landing-card">
        <div className="brand">
          <span className="brand-dot" />
          互動黑板
        </div>
        <h1>選擇你的角色</h1>
        <p className="landing-sub">
          建立一個房間，手機跟投影幕即時同步——<strong>不限同一台電腦</strong>。
        </p>

        <div className="role-grid">
          <button className="role-btn role-present" onClick={handleCreate} disabled={creating}>
            <span className="role-emoji">🖥️</span>
            <span className="role-title">{creating ? '建立中…' : '主持人 / 投影幕'}</span>
            <span className="role-desc">建立新房間、出題、切換模式</span>
          </button>
          <div className="role-btn role-join">
            <span className="role-emoji">📱</span>
            <span className="role-title">參與者 / 手機</span>
            <span className="role-desc">輸入主持人給的房號加入</span>
            <div className="landing-join">
              <input
                value={joinCode}
                onChange={(e) => {
                  setJoinCode(e.target.value)
                  setJoinError('')
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                placeholder="房號，例如 AB23CD"
                maxLength={6}
              />
              <button className="btn-primary" onClick={handleJoin}>
                加入
              </button>
            </div>
            {joinError && <p className="landing-error">{joinError}</p>}
          </div>
        </div>

        {hasResumableRoom && (
          <p className="landing-tip">
            <a href={`#present/${lastRoom}`}>↻ 繼續我上次建立的房間（{lastRoom}）</a>
          </p>
        )}
      </div>
    </div>
  )
}
