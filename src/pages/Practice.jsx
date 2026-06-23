import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { supabase, isConfigured } from '../lib/supabase'
import { Spinner, Button, Badge, Card, Empty } from '../components/ui'

function pct(correct, answered) {
  if (!answered) return 0
  return Math.round((correct / answered) * 100)
}

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
  } catch {
    return ''
  }
}

export default function Practice() {
  const { user, isAdmin, logoutUser, adminSignOut } = useStore()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)
  const [cats, setCats] = useState([])
  const [wrongCount, setWrongCount] = useState(0)

  const logoutAll = async () => {
    if (isAdmin) await adminSignOut()
    logoutUser()
  }

  const load = useCallback(async () => {
    if (!isConfigured) {
      setLoading(false)
      return
    }
    setLoading(true)
    const [{ data: st }, { data: cs }, { data: wq }] = await Promise.all([
      supabase.rpc('get_user_stats', { p_user_id: user.id }),
      supabase.rpc('get_practice_categories'),
      supabase.rpc('get_wrong_questions', { p_user_id: user.id }),
    ])
    setStats(st || null)
    setCats(Array.isArray(cs) ? cs : [])
    setWrongCount(Array.isArray(wq) ? wq.length : 0)
    setLoading(false)
  }, [user.id])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <Spinner />

  const answered = stats?.answered || 0
  const acc = pct(stats?.correct || 0, answered)
  const byCat = stats?.by_category || []
  const recent = stats?.recent || []
  const streak = stats?.streak || 0

  return (
    <div className="px-4 pt-4">
      <header className="animate-rise mb-5 flex items-center justify-between rounded-3xl bg-gradient-to-r from-emerald-500 to-teal-500 p-4 text-white shadow-lg shadow-emerald-300/50">
        <div className="min-w-0">
          <p className="text-xs text-white/80">ฝึกให้แม่น เก็บจุดอ่อนให้อยู่หมัด</p>
          <h1 className="text-lg font-extrabold">🎯 ฝึกซ้อม</h1>
        </div>
        <button
          onClick={logoutAll}
          className="flex-shrink-0 rounded-xl bg-white/20 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/30"
        >
          ↩ ออก
        </button>
      </header>

      {answered === 0 ? (
        <Empty
          icon="🌱"
          title="ยังไม่มีข้อมูลฝึกซ้อม"
          hint="ลองทำข้อสอบสักชุดก่อน แล้วกลับมาดูสถิติ จุดอ่อน และทบทวนข้อที่ผิดได้ที่นี่"
        />
      ) : (
        <div className="space-y-5 pb-4">
          {/* streak + ความแม่น */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="flex flex-col items-center justify-center py-4 text-center">
              <span className="text-3xl">🔥</span>
              <span className="mt-1 text-2xl font-extrabold text-orange-500">{streak}</span>
              <span className="text-xs text-slate-500">วันติดต่อกัน</span>
            </Card>
            <Card className="flex flex-col items-center justify-center py-4 text-center">
              <span className="text-3xl">🎯</span>
              <span className="mt-1 text-2xl font-extrabold text-emerald-600">{acc}%</span>
              <span className="text-xs text-slate-500">
                แม่น {stats.correct}/{answered} ข้อ
              </span>
            </Card>
          </div>

          {/* ทบทวนข้อผิด */}
          <Button
            className="w-full"
            variant={wrongCount ? 'primary' : 'outline'}
            disabled={!wrongCount}
            onClick={() => navigate('/practice/wrong')}
          >
            {wrongCount ? `🔁 ทบทวนข้อที่ตอบผิด (${wrongCount} ข้อ)` : '🎉 ไม่มีข้อผิดให้ทบทวน เก่งมาก!'}
          </Button>

          {/* จุดอ่อนรายหมวด */}
          {byCat.length > 0 && (
            <section>
              <h2 className="mb-2 text-base font-bold text-slate-700">📉 ความแม่นรายหมวด</h2>
              <Card className="space-y-3">
                {byCat.map((c) => {
                  const p = pct(c.correct, c.answered)
                  const color = p >= 80 ? 'bg-emerald-500' : p >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                  return (
                    <button
                      key={c.category}
                      onClick={() => navigate(`/practice/category/${encodeURIComponent(c.category)}`)}
                      className="block w-full text-left"
                    >
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-semibold text-slate-700">{c.category}</span>
                        <span className="text-slate-400">
                          {p}% · {c.correct}/{c.answered}
                        </span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div className={`h-full rounded-full ${color}`} style={{ width: `${p}%` }} />
                      </div>
                    </button>
                  )
                })}
              </Card>
            </section>
          )}

          {/* ติวแยกหมวด */}
          {cats.length > 0 && (
            <section>
              <h2 className="mb-2 text-base font-bold text-slate-700">🧩 ติวแยกหมวด (สุ่มข้ามชุด)</h2>
              <div className="grid grid-cols-2 gap-3">
                {cats.map((c) => (
                  <button
                    key={c.category}
                    onClick={() => navigate(`/practice/category/${encodeURIComponent(c.category)}`)}
                    className="flex items-center justify-between gap-2 rounded-2xl border-2 border-violet-100 bg-white p-3 text-left transition active:bg-violet-50"
                  >
                    <span className="min-w-0 truncate text-sm font-semibold text-slate-700">
                      {c.category}
                    </span>
                    <Badge color="indigo">{c.count}</Badge>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* คะแนนล่าสุด */}
          {recent.length > 0 && (
            <section>
              <h2 className="mb-2 text-base font-bold text-slate-700">🕘 คะแนนล่าสุด</h2>
              <Card className="divide-y divide-slate-100">
                {recent.map((r, i) => (
                  <div key={i} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-700">
                        {r.title || 'ชุดข้อสอบ'}
                      </p>
                      <p className="text-xs text-slate-400">{fmtDate(r.created_at)}</p>
                    </div>
                    <Badge color={pct(r.score, r.total) >= 50 ? 'green' : 'red'}>
                      {r.score}/{r.total}
                    </Badge>
                  </div>
                ))}
              </Card>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
