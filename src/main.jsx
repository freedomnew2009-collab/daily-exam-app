import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { StoreProvider } from './store.jsx'

// อัปเดตอัตโนมัติ: พอมี service worker ตัวใหม่เข้ามาคุมแล้ว ให้รีโหลดเองทันที
// (ไม่ต้องปิด-เปิดแอปเอง) + เช็กเวอร์ชันใหม่ทุกครั้งที่กลับมาเปิดแอป
if ('serviceWorker' in navigator) {
  if (navigator.serviceWorker.controller) {
    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    })
  }
  const checkUpdate = () =>
    navigator.serviceWorker
      .getRegistration()
      .then((r) => r && r.update())
      .catch(() => {})
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkUpdate()
  })
  window.addEventListener('focus', checkUpdate)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
      <StoreProvider>
        <App />
      </StoreProvider>
    </HashRouter>
  </StrictMode>,
)
