// ตัวช่วยแจ้งเตือน (Notification API ของเบราว์เซอร์/PWA)

export async function ensureNotifyPermission() {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const res = await Notification.requestPermission()
  return res === 'granted'
}

export function showNotification(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  try {
    new Notification(title, {
      body,
      icon: import.meta.env.BASE_URL + 'pwa-icon.svg',
      badge: import.meta.env.BASE_URL + 'pwa-icon.svg',
    })
  } catch {
    // เงียบไว้ถ้าเบราว์เซอร์ไม่รองรับ
  }
}

// เก็บ "เห็นข้อสอบล่าสุดถึงเวลาไหนแล้ว" ใน localStorage
const SEEN_KEY = 'exam_last_seen'

export function getLastSeen() {
  return localStorage.getItem(SEEN_KEY) || '1970-01-01T00:00:00Z'
}

export function setLastSeen(iso) {
  localStorage.setItem(SEEN_KEY, iso || new Date().toISOString())
}
