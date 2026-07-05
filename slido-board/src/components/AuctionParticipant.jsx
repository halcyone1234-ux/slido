import { useState } from 'react'
import { randomName } from '../identity.js'

const INCREMENTS = [1, 5, 10]

export default function AuctionParticipant({ session }) {
  const { state, myId, registerBidder, placeBid, useItem } = session
  const a = state.auction
  const me = a.participants[myId]
  const [name, setName] = useState(randomName)

  // 尚未加入：輸入名字領 100 元
  if (!me) {
    return (
      <div className="auc-join">
        <div className="auc-join-emoji">🔨</div>
        <h2>加入拍賣會</h2>
        <p className="auc-join-sub">加入即可獲得 $100 競標本錢</p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="你的名字"
          maxLength={12}
        />
        <button
          className="btn-primary"
          onClick={() => registerBidder(myId, name.trim() || randomName())}
        >
          領 $100 加入
        </button>
      </div>
    )
  }

  const isTopBidder = a.highestBidder?.id === myId
  // 若目前是最高出價者，這筆錢在成交前先「保留」，不算在可用餘額內。
  const held = a.status === 'live' && isTopBidder ? a.highestBid : 0
  const available = me.balance - held
  const myItems = me.items || [] // 我獲得的商品（戰利品）

  return (
    <div className="auc-play">
      <div className="auc-wallet">
        <span className="auc-wallet-name">{me.name}</span>
        <span className="auc-wallet-bal">可用餘額 ${available}</span>
      </div>
      {held > 0 && (
        <div className="auc-held">🔒 已出價保留 ${held}（成交才扣款）</div>
      )}

      {a.status === 'idle' && (
        <div className="auc-wait">等待主持人開始拍賣下一件商品…</div>
      )}

      {a.status === 'live' && (
        <>
          <div className="auc-showcase auc-showcase-sm">
            <span className="auc-tag">🔨 拍賣品</span>
            <div className="auc-item-name auc-item-sm">{a.item}</div>
          </div>
          <div className="auc-current">
            目前最高 <strong>${a.highestBid}</strong>
            {a.highestBidder && (
              <span className="auc-current-who">
                （{isTopBidder ? '就是你！' : a.highestBidder.name}）
              </span>
            )}
          </div>

          <div className="auc-bid-btns">
            {INCREMENTS.map((inc) => {
              const bid = a.highestBid + inc
              const tooRich = bid > me.balance
              return (
                <button
                  key={inc}
                  className="auc-bid-btn"
                  disabled={tooRich}
                  onClick={() => placeBid(myId, bid)}
                >
                  出價 ${bid}
                  <small>+{inc}</small>
                </button>
              )
            })}
          </div>

          {isTopBidder ? (
            <p className="auc-note auc-note-top">✓ 你目前是最高出價者</p>
          ) : (
            <p className="auc-note">
              {a.highestBid + 1 > me.balance
                ? '你的餘額不足以再加價了'
                : '點按鈕加價搶標，別超過你的餘額'}
            </p>
          )}
        </>
      )}

      {a.status === 'closed' && (
        <div className="auc-result">
          {a.highestBidder ? (
            a.highestBidder.id === myId ? (
              <>🎉 恭喜！你以 ${a.highestBid} 標下「{a.item}」</>
            ) : (
              <>本件由 {a.highestBidder.name} 以 ${a.highestBid} 得標</>
            )
          ) : (
            <>本件流標</>
          )}
        </div>
      )}

      {/* 我的戰利品：持續顯示已獲得的商品（日後在此掛上各商品的使用方法） */}
      <div className="auc-inventory">
        <div className="auc-inv-title">🎁 我獲得的商品（{myItems.length}）</div>
        {myItems.length === 0 ? (
          <div className="auc-inv-empty">尚未獲得商品，加油競標！</div>
        ) : (
          <ul className="auc-inv-list">
            {myItems.map((it) => (
              <li className="auc-inv-item" key={it.id}>
                <div className="auc-inv-info">
                  <span className="auc-inv-name">{it.name}</span>
                  <span className="auc-inv-amt">${it.amount}</span>
                </div>
                <button
                  className="auc-use-btn"
                  disabled={it.used}
                  onClick={() => useItem(myId, it.id)}
                >
                  {it.used ? '已使用' : '使用道具'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
