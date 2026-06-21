import { useEffect, useState } from 'react'

// เช็กว่าเปิดในโหมดที่ติดตั้งแล้ว (standalone) หรือยัง
const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  window.navigator.standalone === true

// iOS Safari ไม่รองรับ beforeinstallprompt ต้องแนะนำวิธีเพิ่มเอง
const isIOS = () =>
  /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !window.MSStream

export default function InstallButton() {
  const [deferred, setDeferred] = useState(null)
  const [visible, setVisible] = useState(false)
  const [iosHelp, setIosHelp] = useState(false)

  useEffect(() => {
    if (isStandalone()) return // ติดตั้งแล้ว ไม่ต้องโชว์
    if (sessionStorage.getItem('pwa_install_dismissed')) return

    const onBeforeInstall = (e) => {
      e.preventDefault() // กันไม่ให้ Chrome เด้ง prompt เอง เก็บไว้ให้ปุ่มเราเรียก
      setDeferred(e)
      setVisible(true)
    }
    const onInstalled = () => setVisible(false)

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)

    // iOS: โชว์ปุ่มไว้เลย แล้วค่อยแนะนำวิธีตอนแตะ
    if (isIOS()) setVisible(true)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const dismiss = () => {
    setVisible(false)
    setIosHelp(false)
    sessionStorage.setItem('pwa_install_dismissed', '1')
  }

  const install = async () => {
    if (deferred) {
      deferred.prompt()
      const { outcome } = await deferred.userChoice
      setDeferred(null)
      if (outcome === 'accepted') setVisible(false)
      return
    }
    if (isIOS()) setIosHelp(true)
  }

  if (!visible) return null

  return (
    <div className="fixed inset-x-0 bottom-20 z-30 px-4">
      <div className="animate-rise mx-auto max-w-md">
        <div className="flex items-center gap-3 rounded-2xl border border-white bg-white/90 p-3 shadow-xl shadow-violet-300/40 backdrop-blur">
          <div className="animate-float flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-500 text-2xl">
            📲
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-800">ติดตั้งแอปข้อสอบรายวัน</p>
            <p className="truncate text-xs text-slate-500">เพิ่มไว้ที่หน้าจอ เปิดง่ายเหมือนแอปจริง</p>
          </div>
          <button
            onClick={install}
            className="flex-shrink-0 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 px-4 py-2 text-sm font-bold text-white shadow-md shadow-violet-300/50 active:scale-95"
          >
            ติดตั้ง
          </button>
          <button
            onClick={dismiss}
            className="flex-shrink-0 px-1 text-lg leading-none text-slate-300 hover:text-slate-500"
            aria-label="ปิด"
          >
            ✕
          </button>
        </div>

        {/* คำแนะนำสำหรับ iOS */}
        {iosHelp && (
          <div className="animate-pop mt-2 rounded-2xl border border-violet-200 bg-white/95 p-3 text-sm text-slate-700 shadow-lg shadow-violet-200/40 backdrop-blur">
            <p className="font-bold text-violet-600">วิธีติดตั้งบน iPhone / iPad 🍎</p>
            <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-xs text-slate-600">
              <li>
                แตะปุ่ม <b>แชร์</b> <span className="text-base">⬆️</span> ด้านล่างของ Safari
              </li>
              <li>
                เลื่อนหา <b>“เพิ่มไปยังหน้าจอโฮม”</b> (Add to Home Screen)
              </li>
              <li>แตะ <b>“เพิ่ม”</b> มุมขวาบน เสร็จเลย!</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  )
}
