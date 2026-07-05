import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// host: true 讓同一 Wi-Fi 下的手機也能連進來測試
export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5173 },
})
