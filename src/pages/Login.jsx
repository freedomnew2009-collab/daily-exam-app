import { useState } from 'react'
import { useStore } from '../store'
import { Button } from '../components/ui'

export default function Login() {
  const { loginUser, adminSignIn } = useStore()
  const [tab, setTab] = useState('user') // 'user' | 'admin'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submitUser = async (e) => {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      await loginUser(name)
    } catch (e2) {
      setErr(e2.message || 'เข้าระบบไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  const submitAdmin = async (e) => {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      await adminSignIn(email.trim(), password)
      // ล็อกอินแอดมินสำเร็จ แต่ยังต้องมีชื่อผู้ใช้เพื่อใช้แอพ — ใช้ชื่อ admin
      await loginUser(email.trim().split('@')[0] || 'admin')
    } catch (e2) {
      setErr(e2.message || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="mb-8 text-center">
        <div className="animate-float mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-[28px] bg-gradient-to-br from-violet-500 to-indigo-500 text-5xl shadow-xl shadow-violet-300/60">
          🎧
        </div>
        <h1 className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-3xl font-extrabold text-transparent">
          Audi Exam
        </h1>
        <p className="mt-2 text-sm text-slate-500">เพื่อนซ้อมข้อสอบของชาว Audiology 🎧 ทำข้อสอบ + เฉลย + ถาม-ตอบ</p>
      </div>

      <div className="mb-4 flex rounded-2xl bg-white/70 p-1 shadow-md shadow-violet-200/40">
        <button
          onClick={() => { setTab('user'); setErr('') }}
          className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition ${
            tab === 'user'
              ? 'bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-md shadow-violet-300/50'
              : 'text-slate-500'
          }`}
        >
          🙂 ผู้ใช้
        </button>
        <button
          onClick={() => { setTab('admin'); setErr('') }}
          className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition ${
            tab === 'admin'
              ? 'bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-md shadow-violet-300/50'
              : 'text-slate-500'
          }`}
        >
          🛠️ แอดมิน
        </button>
      </div>

      {tab === 'user' ? (
        <form onSubmit={submitUser} className="space-y-3">
          <label className="block text-sm font-medium text-slate-600">
            ชื่อของคุณ (ไม่ต้องสมัคร — ใช้ชื่อเดิมเข้าได้เลย)
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="เช่น หมอเอ, นักเรียน01"
            className="w-full rounded-2xl border-2 border-violet-100 bg-white px-4 py-3 text-slate-800 outline-none transition focus:border-violet-400"
            autoFocus
          />
          {err && <p className="text-sm font-medium text-rose-500">{err}</p>}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'กำลังเข้า…' : 'เข้าใช้งาน'}
          </Button>
        </form>
      ) : (
        <form onSubmit={submitAdmin} className="space-y-3">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="อีเมลแอดมิน"
            type="email"
            className="w-full rounded-2xl border-2 border-violet-100 bg-white px-4 py-3 text-slate-800 outline-none transition focus:border-violet-400"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="รหัสผ่าน"
            type="password"
            className="w-full rounded-2xl border-2 border-violet-100 bg-white px-4 py-3 text-slate-800 outline-none transition focus:border-violet-400"
          />
          {err && <p className="text-sm font-medium text-rose-500">{err}</p>}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'กำลังเข้า…' : 'เข้าสู่ระบบแอดมิน'}
          </Button>
          <p className="text-center text-xs text-slate-400">
            * บัญชีแอดมินสร้างใน Supabase → Authentication → Add user
          </p>
        </form>
      )}
    </div>
  )
}
