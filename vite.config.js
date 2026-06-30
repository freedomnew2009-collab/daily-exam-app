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
      workbox: {
        // ไม่ precache ก้อน 3D (three.js ~860KB) — โหลดตอนเข้าหน้าสวนแล้วค่อยแคชเอง
        // ทำให้ติดตั้งแอปครั้งแรกเบา ไม่ต้องดาวน์โหลดก้อนใหญ่ทันที
        globIgnores: ['**/Tree3D-*.js'],
        runtimeCaching: [
          {
            urlPattern: /\/assets\/Tree3D-.*\.js$/,
            handler: 'CacheFirst',
            options: { cacheName: 'tree3d-chunk', expiration: { maxEntries: 3 } },
          },
        ],
      },
      manifest: {
        name: 'Audi Exam — ติวข้อสอบ Audiology',
        short_name: 'Audi Exam',
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
