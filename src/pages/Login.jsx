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
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-600 text-4xl shadow-lg shadow-indigo-900/50">
          📝
        </div>
        <h1 className="text-2xl font-bold text-white">ข้อสอบรายวัน</h1>
        <p className="mt-1 text-sm text-slate-400">ทำข้อสอบวันละ 5 ข้อ พร้อมเฉลยและถาม-ตอบ</p>
      </div>

      <div className="mb-4 flex rounded-xl bg-slate-800 p-1">
        <button
          onClick={() => { setTab('user'); setErr('') }}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
            tab === 'user' ? 'bg-indigo-600 text-white' : 'text-slate-300'
          }`}
        >
          ผู้ใช้
        </button>
        <button
          onClick={() => { setTab('admin'); setErr('') }}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
            tab === 'admin' ? 'bg-indigo-600 text-white' : 'text-slate-300'
          }`}
        >
          แอดมิน
        </button>
      </div>

      {tab === 'user' ? (
        <form onSubmit={submitUser} className="space-y-3">
          <label className="block text-sm text-slate-300">
            ชื่อของคุณ (ไม่ต้องสมัคร — ใช้ชื่อเดิมเข้าได้เลย)
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="เช่น หมอเอ, นักเรียน01"
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-indigo-500"
            autoFocus
          />
          {err && <p className="text-sm text-rose-400">{err}</p>}
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
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-indigo-500"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="รหัสผ่าน"
            type="password"
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-indigo-500"
          />
          {err && <p className="text-sm text-rose-400">{err}</p>}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'กำลังเข้า…' : 'เข้าสู่ระบบแอดมิน'}
          </Button>
          <p className="text-center text-xs text-slate-500">
            * บัญชีแอดมินสร้างใน Supabase → Authentication → Add user
          </p>
        </form>
      )}
    </div>
  )
}
