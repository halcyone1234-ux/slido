// Single shared WebSocket connection for the currently mounted room view
// (presenter or participant). useSession.js and dinoBus.js both send/receive
// over this one connection, replacing the old BroadcastChannel+localStorage
// same-browser-only sync layer with real cross-device sync.

const WS_URL =
  import.meta.env.VITE_WS_URL || `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`

let ws = null
let helloPayload = null
let reconnectTimer = null
let reconnectDelay = 500
const listeners = new Set()

function emit(msg) {
  for (const fn of listeners) fn(msg)
}

function scheduleReconnect() {
  clearTimeout(reconnectTimer)
  reconnectTimer = setTimeout(() => {
    reconnectDelay = Math.min(reconnectDelay * 2, 8000)
    open()
  }, reconnectDelay)
}

function open() {
  if (!helloPayload) return
  ws = new WebSocket(WS_URL)
  ws.onopen = () => {
    reconnectDelay = 500
    ws.send(JSON.stringify(helloPayload))
  }
  ws.onmessage = (evt) => {
    let msg
    try {
      msg = JSON.parse(evt.data)
    } catch {
      return
    }
    emit(msg)
  }
  ws.onclose = () => {
    if (helloPayload) scheduleReconnect()
  }
}

// Connects (or reconnects) with the given hello payload. Tears down any
// previous connection first, so only one room is ever live per tab.
export function connectRoom(payload) {
  helloPayload = payload
  clearTimeout(reconnectTimer)
  reconnectDelay = 500
  if (ws) ws.close()
  open()
}

export function disconnectRoom() {
  helloPayload = null
  clearTimeout(reconnectTimer)
  if (ws) ws.close()
  ws = null
}

export function send(payload) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload))
}

export function onMessage(handler) {
  listeners.add(handler)
  return () => listeners.delete(handler)
}
