// Minimal REST calls to the backend's room API. Real-time sync itself goes over
// WebSocket (see ws/socket.js) — this is only for creating a room and checking a
// join code before attempting the WS handshake.

export async function createRoom() {
  const res = await fetch('/api/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  if (!res.ok) throw new Error('create_room_failed')
  return res.json() // { roomId, code, presenterToken }
}

export async function checkRoom(code) {
  const res = await fetch(`/api/rooms/${encodeURIComponent(code)}`)
  if (!res.ok) return { exists: false, active: false }
  return res.json()
}
