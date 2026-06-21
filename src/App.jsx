import { useEffect, useState, useCallback } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from './store'
import { supabase, isConfigured } from './lib/supabase'
import { getLastSeen, showNotification, ensureNotifyPermission } from './lib/notify'
import BottomNav from './components/BottomNav'
import InstallButton from './components/InstallButton'
import Login from './pages/Login'
import Home from './pages/Home'
import Library from './pages/Library'
import Quiz from './pages/Quiz'
import Review from './pages/Review'
import QA from './pages/QA'
import Admin from './pages/Admin'

function ConfigWarning() {
  return (
    <div className="mx-3 mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
      ⚠️ ยังไม่ได้ตั้งค่า Supabase — เปิดไฟล์ <code className="rounded bg-amber-100 px-1">.env</code> แล้วใส่{' '}
      <code className="rounded bg-amber-100 px-1">VITE_SUPABASE_URL</code> และ{' '}
      <code className="rounded bg-amber-100 px-1">VITE_SUPABASE_ANON_KEY</code> (ดู README)
    </div>
  )
}

function Suspended() {
  const { user, logoutUser, adminSignOut, isAdmin } = useStore()
  const logout = async () => {
    if (isAdmin) await adminSignOut()
    logoutUser()
  }
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="animate-float mb-4 text-6xl">🙈</div>
      <h1 className="mb-2 text-xl font-bold text-slate-800">บัญชีถูกพักไว้ชั่วคราว</h1>
      <p className="mb-1 text-slate-600">
        บัญชี “{user?.username}” ถูกแอดมินพักการใช้งาน จึงเข้าใช้แอปไม่ได้ตอนนี้
      </p>
      <p className="mb-6 text-sm text-slate-400">หากคิดว่าผิดพลาด ทักหาแอดมินได้เลยนะ 💛</p>
      <button
        onClick={logout}
        className="rounded-2xl border-2 border-violet-200 px-5 py-3 font-bold text-violet-700 hover:bg-violet-50"
      >
        ↩ ออกจากระบบ
      </button>
    </div>
  )
}

export default function App() {
  const { user, ready, suspended, isAdmin } = useStore()
  const [newCount, setNewCount] = useState(0)

  // นับข้อสอบใหม่ที่ยังไม่เห็น
  const refreshNewCount = useCallback(async () => {
    if (!isConfigured) return
    const lastSeen = getLastSeen()
    const { count } = await supabase
      .from('exam_sets')
      .select('id', { count: 'exact', head: true })
      .eq('published', true)
      .gt('created_at', lastSeen)
    setNewCount(count || 0)
  }, [])

  // realtime: เด้งแจ้งเตือนเมื่อมีข้อสอบใหม่
  useEffect(() => {
    if (!user || !isConfigured) return
    refreshNewCount()
    ensureNotifyPermission()

    const channel = supabase
      .channel('exam_sets_changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'exam_sets' },
        (payload) => {
          if (payload.new?.published) {
            showNotification('มีข้อสอบใหม่! 📝', payload.new.title || 'แตะเพื่อเริ่มทำข้อสอบ')
          }
          refreshNewCount()
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'exam_sets' },
        () => refreshNewCount()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, refreshNewCount])

  if (!ready) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-slate-400">
        <div className="animate-float text-5xl">📝</div>
        <span>กำลังเริ่มต้น…</span>
      </div>
    )
  }

  if (!user) {
    return (
      <>
        {!isConfigured && <ConfigWarning />}
        <Login />
        <InstallButton />
      </>
    )
  }

  // ถูกระงับ -> ใช้แอปไม่ได้ (ยกเว้นแอดมินไม่โดนล็อก)
  if (suspended && !isAdmin) return <Suspended />

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col">
      {!isConfigured && <ConfigWarning />}
      <main className="flex-1 pb-2">
        <Routes>
          <Route path="/" element={<Home onSeen={refreshNewCount} />} />
          <Route path="/library" element={<Library />} />
          <Route path="/quiz/:setId" element={<Quiz />} />
          <Route path="/review/:setId" element={<Review />} />
          <Route path="/qa" element={<QA />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <InstallButton />
      <BottomNav newCount={newCount} />
    </div>
  )
}
