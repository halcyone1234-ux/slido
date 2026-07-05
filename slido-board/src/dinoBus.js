// 恐龍小遊戲的訊息現在跟主狀態共用同一條 WebSocket 連線（見 ws/socket.js），
// 不再是獨立的 BroadcastChannel——原本分開是為了避免污染同分頁的
// localStorage，這個理由在真正的網路連線下已經不存在。
// subscribe() 保留原本 `{data:{type,...}}` 的訊息形狀，DinoGame.jsx 等消費端不用改。
import { send, onMessage } from './ws/socket.js'

export function sendJump() {
  send({ type: 'dino.jump' })
}

export function sendGame(active) {
  send({ type: 'dino.setActive', active })
}

export function sendScore(payload) {
  send({ type: 'dino.score', score: payload.score })
}

export function subscribe(handler) {
  return onMessage((msg) => {
    if (msg.type === 'dino.jump') handler({ data: { type: 'jump' } })
    else if (msg.type === 'dino.state') handler({ data: { type: 'game', active: msg.active } })
    else if (msg.type === 'dino.scoreUpdate') {
      handler({ data: { type: 'score', id: msg.participantId, name: msg.name, score: msg.best } })
    }
  })
}
