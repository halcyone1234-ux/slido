import { useMemo } from 'react'

// 主持人：商品總覽 — 已賣出的商品 + 目前誰擁有什麼。
export default function AuctionOverview({ auction, onClose }) {
  const owners = useMemo(
    () =>
      Object.entries(auction.participants)
        .map(([id, p]) => ({ id, ...p, items: p.items || [] }))
        .filter((p) => p.items.length > 0)
        .sort((a, b) => b.items.length - a.items.length),
    [auction.participants],
  )

  return (
    <div className="ov-overlay" onClick={onClose}>
      <div className="ov-panel" onClick={(e) => e.stopPropagation()}>
        <button className="qr-close" onClick={onClose} aria-label="關閉">
          ✕
        </button>
        <h2 className="ov-title">📦 商品總覽</h2>

        <section className="ov-section">
          <h3 className="ov-h3">已賣出的商品（{auction.sold.length}）</h3>
          {auction.sold.length === 0 ? (
            <div className="ov-empty">還沒有商品成交</div>
          ) : (
            <ul className="ov-sold">
              {auction.sold.map((s, i) => (
                <li key={i}>
                  <span className="ov-sold-item">{s.item}</span>
                  <span className="ov-sold-meta">
                    {s.name} · <b>${s.amount}</b>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="ov-section">
          <h3 className="ov-h3">目前誰擁有什麼</h3>
          {owners.length === 0 ? (
            <div className="ov-empty">目前沒有人擁有商品</div>
          ) : (
            <div className="ov-owners">
              {owners.map((p) => (
                <div className="ov-owner" key={p.id}>
                  <div className="ov-owner-head">
                    <span className="ov-owner-name">{p.name}</span>
                    <span className="ov-owner-bal">餘額 ${p.balance}</span>
                  </div>
                  <div className="ov-owner-items">
                    {p.items.map((it) => (
                      <span
                        className={`ov-chip ${it.used ? 'ov-chip-used' : ''}`}
                        key={it.id}
                      >
                        {it.name}
                        {it.used && <span className="ov-used-tag">已使用</span>}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
