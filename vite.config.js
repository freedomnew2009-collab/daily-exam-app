import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// ชื่อ repo ใน GitHub Pages -> base path
// ถ้าใช้ custom domain หรือ user page (เช่น username.github.io) ให้เปลี่ยนเป็น '/'
const REPO = 'daily-exam-app'

export default defineConfig({
  base: `/${REPO}/`,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['pwa-icon.svg'],
      manifest: {
        name: 'น้องออดี้ — ติวข้อสอบ Audiology',
        short_name: 'น้องออดี้',
        description: 'เพื่อนซ้อมข้อสอบของชาว Audiology — ทำข้อสอบ พร้อมเฉลยและถาม-ตอบ',
        theme_color: '#a78bfa',
        background_color: '#eef2ff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: `/${REPO}/`,
        scope: `/${REPO}/`,
        icons: [
          {
            src: 'pwa-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
})
