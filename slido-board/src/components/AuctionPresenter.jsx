import { useState, useMemo } from 'react'
import AuctionOverview from './AuctionOverview.jsx'

export default function AuctionPresenter({ session }) {
  const {
    state,
    startAuction,
    closeAuction,
    nextItem,
    resetAuction,
    giveMoney,
  } = session
  const a = state.auction
  const [item, setItem] = useState('')
  const [price, setPrice] = useState(10)
  const [showOverview, setShowOverview] = useState(false)
  const [giveTarget, setGiveTarget] = useState('')
  const [giveAmount, setGiveAmount] = useState(10)

  const people = useMemo(() => {
    const topId =
      a.status === 'live' && a.highestBidder ? a.highestBidder.id : null
    return Object.entries(a.participants)
      .map(([id, p]) => {
        const held = id === topId ? a.highestBid : 0
        return { id, ...p, held, available: p.balance - held }
      })
      .sort((x, y) => y.available - x.available)
  }, [a.participants, a.status, a.highestBidder, a.highestBid])
  const count = people.length

  return (
    <div className="auction">
      {/* 控制列 */}
      <div className="auction-controls">
        {a.status !== 'live' ? (
          <>
            <input
              className="auc-item"
              value={item}
              onChange={(e) => setItem(e.target.value)}
              placeholder="商品名稱，例如：簽名球"
            />
            <label className="auc-price">
              起標價
              <input
                type="number"
                min="0"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
              />
            </label>
            <button
              className="btn-primary"
              onClick={() => {
                startAuction(item, price)
                setItem('')
              }}
            >
              🔨 開始拍賣
            </button>
          </>
        ) : (
          <button className="btn-primary auc-hammer" onClick={closeAuction}>
            成交！結標 🔨
          </button>
        )}
        {a.status === 'closed' && (
          <button className="btn-ghost" onClick={nextItem}>
            下一件
          </button>
        )}
        <button className="btn-ghost" onClick={() => setShowOverview(true)}>
          📦 商品總覽
        </button>
        <button className="btn-ghost" onClick={resetAuction}>
          整場重置（回到 ${100}）
        </button>
      </div>

      <div className="auction-body">
        {/* 中央拍賣台 */}
        <div className="auction-main">
          {a.status === 'idle' && (
            <div className="auc-idle">
              輸入商品與起標價，按「開始拍賣」<br />
              目前 <strong>{count}</strong> 位買家已加入（每人 $100）
            </div>
          )}

          {a.status === 'live' && (
            <div className="auc-live">
              <div className="auc-showcase">
                <span className="auc-tag">🔨 現正拍賣</span>
                <div className="auc-item-name">{a.item}</div>
              </div>
              <div className="auc-bid-big">${a.highestBid}</div>
              <div className="auc-bidder">
                {a.highestBidder
                  ? `目前最高：${a.highestBidder.name}`
                  : '尚無人出價（此為起標價）'}
              </div>
            </div>
          )}

          {a.status === 'closed' && (
            <div className="auc-closed">
              {a.highestBidder ? (
                <>
                  <div className="auc-sold-badge">成交 SOLD</div>
                  <div className="auc-showcase">
                    <span className="auc-tag">拍賣品</span>
                    <div className="auc-item-name">{a.item}</div>
                  </div>
                  <div className="auc-sold-line">
                    <strong>{a.highestBidder.name}</strong> 以{' '}
                    <strong>${a.highestBid}</strong> 標下！
                  </div>
                </>
              ) : (
                <div className="auc-sold-line">流標（無人出價）</div>
              )}
            </div>
          )}
        </div>

        {/* 買家餘額排行榜 */}
        <aside className="auction-side">
          <div className="side-title">可用餘額（{count}）</div>
          {count === 0 && (
            <div className="side-empty">
              等待買家加入…<br />請在參與者分頁輸入名稱加入
            </div>
          )}
          <ul className="ledger">
            {people.map((p) => (
              <li key={p.id}>
                <span className="ledger-name">
                  {p.name}
                  {p.held > 0 && <span className="ledger-held">🔒${p.held}</span>}
                </span>
                <span className="ledger-bal">${p.available}</span>
              </li>
            ))}
          </ul>

          {count > 0 && (
            <div className="give-box">
              <div className="side-title side-title-sold">💵 發錢給買家</div>
              <select
                className="give-select"
                value={giveTarget || people[0]?.id || ''}
                onChange={(e) => setGiveTarget(e.target.value)}
              >
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}（${p.balance}）
                  </option>
                ))}
              </select>
              <div className="give-row">
                <input
                  className="give-amount"
                  type="number"
                  value={giveAmount}
                  onChange={(e) => setGiveAmount(Number(e.target.value))}
                />
                <button
                  className="btn-primary give-btn"
                  onClick={() =>
                    giveMoney(giveTarget || people[0]?.id, giveAmount)
                  }
                >
                  發送
                </button>
              </div>
              <div className="give-quick">
                {[10, 50, -10].map((n) => (
                  <button
                    key={n}
                    className="chip"
                    onClick={() => giveMoney(giveTarget || people[0]?.id, n)}
                  >
                    {n > 0 ? `+$${n}` : `-$${-n}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {a.sold.length > 0 && (
            <>
              <div className="side-title side-title-sold">成交紀錄</div>
              <ul className="sold-list">
                {a.sold.map((s, i) => (
                  <li key={i}>
                    {s.item} → {s.name}{' '}
                    <span className="sold-amt">${s.amount}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>
      </div>

      {showOverview && (
        <AuctionOverview auction={a} onClose={() => setShowOverview(false)} />
      )}
    </div>
  )
}
