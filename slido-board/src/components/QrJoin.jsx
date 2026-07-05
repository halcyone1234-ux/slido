import { useState, useEffect } from 'react'
import QRCode from 'qrcode'

// 產生「加入」QR Code。預設用目前網址的來源 + #join/房號，
// 也可手動改成 Vite 印出的 Network 網址（如 http://192.168.1.107:5173），
// 這樣同一 Wi-Fi 的手機掃描後就能開啟參與者畫面。
export default function QrJoin({ roomCode, onClose }) {
  const [base, setBase] = useState(window.location.origin)
  const [dataUrl, setDataUrl] = useState('')

  const joinUrl = `${base.replace(/\/$/, '')}/#join/${roomCode}`

  useEffect(() => {
    QRCode.toDataURL(joinUrl, {
      width: 320,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then(setDataUrl)
      .catch(() => setDataUrl(''))
  }, [joinUrl])

  return (
    <div className="qr-overlay" onClick={onClose}>
      <div className="qr-panel" onClick={(e) => e.stopPropagation()}>
        <button className="qr-close" onClick={onClose} aria-label="關閉">
          ✕
        </button>
        <h2 className="qr-title">掃描加入</h2>
        {dataUrl ? (
          <img className="qr-img" src={dataUrl} alt="加入用 QR Code" />
        ) : (
          <div className="qr-img qr-img-empty">產生中…</div>
        )}
        <p className="qr-url">{joinUrl}</p>

        <label className="qr-field">
          <span>加入網址（要讓手機掃描，請填 Network 網址）</span>
          <input
            value={base}
            onChange={(e) => setBase(e.target.value)}
            placeholder="http://192.168.1.107:5173"
          />
        </label>
        <p className="qr-tip">
          提醒：手機掃描後會直接加入這個房間，跟投影幕即時同步，不需要跟投影幕在同一台電腦或同一個 Wi-Fi。
        </p>
      </div>
    </div>
  )
}
