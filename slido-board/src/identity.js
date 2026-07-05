// 身分不再是本機隨機產生就直接當真——真正的 participant id 由伺服器在 WS
// handshake 時核發（見 useSession.js）。這裡只保留兩個純本機的小工具：
// 暱稱（純顯示用，跨裝置不需要一致）跟房間專屬的重連密鑰。
const NAME_KEY = 'my-name'

export function randomName() {
  return `玩家-${Math.floor(100 + Math.random() * 900)}`
}

// 用 localStorage（不是 sessionStorage）：關掉分頁後暱稱、餘額、身分都還在，
// 犧牲的是「同機開兩分頁=兩個買家」的 demo 技巧。
export function getMyName() {
  let n = localStorage.getItem(NAME_KEY)
  if (!n) {
    n = randomName()
    localStorage.setItem(NAME_KEY, n)
  }
  return n
}

export function getClientToken(roomCode) {
  return localStorage.getItem(`slido-client-token-${roomCode}`)
}

export function setClientToken(roomCode, token) {
  localStorage.setItem(`slido-client-token-${roomCode}`, token)
}
