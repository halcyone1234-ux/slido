import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// host: true 讓同一 Wi-Fi 下的手機也能連進來測試。
// 開發時把 /api 與 /ws 轉給本地後端（預設 127.0.0.1:47243，見 slido-backend/.env）。
// 後端會擋掉 Origin 不等於 CORS_ORIGIN 的連線；開發來源（localhost 或手機區網 IP）
// 一定對不上正式網址，所以在 proxy 這層把 Origin 拿掉，讓後端視為同源放行。
// 註：此 proxy 只在 vite 開發伺服器生效，正式環境（後端直接服務靜態檔）完全不受影響。
const stripOrigin = (proxy) => {
  proxy.on('proxyReq', (proxyReq) => proxyReq.removeHeader('origin'))
  proxy.on('proxyReqWs', (proxyReq) => proxyReq.removeHeader('origin'))
}

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:47243', changeOrigin: true, configure: stripOrigin },
      '/ws': { target: 'http://127.0.0.1:47243', ws: true, changeOrigin: true, configure: stripOrigin },
    },
  },
})
