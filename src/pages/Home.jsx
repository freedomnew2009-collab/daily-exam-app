import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { supabase, isConfigured } from '../lib/supabase'
import { getLastSeen, setLastSeen, getLastSeenArticles } from '../lib/notify'
import { Spinner, Button, Card, Badge, Empty } from '../components/ui'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'เช้า'
  if (h < 17) return 'บ่าย'
  return 'เย็น'
}

export default function Home({ onSeen }) {
  const { user, logoutUser, adminSignOut, isAdmin } = useStore()
  const navigate = useNavigate()

  const logoutAll = async () => {
    if (isAdmin) await adminSignOut()
    logoutUser()
  }
  const [loading, setLoading] = useState(true)
  const [sets, setSets] = useState([])
  const [attempts, setAttempts] = useState({}) // setId -> { count, best }
  const [lastSeenAtLoad] = useState(getLastSeen())
  const [newArticles, setNewArticles] = useState(0) // จำนวนบทความใหม่ที่ยังไม่ได้อ่าน

  const load = useCallback(async () => {
    if (!isConfigured) {
      setLoading(false)
      return
    }
    setLoading(true)
    const lastSeenArticles = getLastSeenArticles()
    const [{ data: setsData }, { data: attemptData }, { count: newArticleCount }] = await Promise.all([
      supabase
        .from('exam_sets')
        .select('id, day_number, title, created_at, question_count')
        .eq('published', true)
        .order('day_number', { ascending: true }),
      supabase
        .from('attempts')
        .select('exam_set_id, score, total, completed')
        .eq('user_id', user.id)
        .eq('completed', true),
      supabase
        .from('articles')
        .select('id', { count: 'exact', head: true })
        .eq('published', true)
        .gt('created_at', lastSeenArticles),
    ])
    setNewArticles(newArticleCount || 0)

    const map = {}
    for (const a of attemptData || []) {
      const cur = map[a.exam_set_id] || { count: 0, best: 0, total: a.total }
      cur.count += 1
      cur.best = Math.max(cur.best, a.score || 0)
      cur.total = a.total
      map[a.exam_set_id] = cur
    }
    setSets(setsData || [])
    setAttempts(map)
    setLoading(false)

    // มาถึงหน้านี้ = เห็นข้อสอบใหม่แล้ว
    setLastSeen(new Date().toISOString())
    onSeen?.()
  }, [user.id, onSeen])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <Spinner />

  return (
    <div className="px-4 pt-4">
      {/* หัวข้อ + ผู้ใช้ */}
      <header className="animate-rise mb-5 flex items-center justify-between rounded-3xl bg-gradient-to-r from-violet-500 to-indigo-500 p-4 text-white shadow-lg shadow-violet-300/50">
        <div className="min-w-0">
          <p className="text-xs text-white/80">สวัสดีตอน{greeting()} 👋</p>
          <p className="flex items-center gap-2 truncate text-lg font-bold">
            {user.username} {isAdmin && <Badge color="amber">แอดมิน</Badge>}
          </p>
        </div>
        <button
          onClick={logoutAll}
          className="flex-shrink-0 rounded-xl bg-white/20 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/30"
        >
          ↩ ออก
        </button>
      </header>

      {/* แจ้งเตือนบทความใหม่ */}
      {newArticles > 0 && (
        <button
          onClick={() => navigate('/articles')}
          className="animate-rise mb-4 flex w-full items-center gap-3 rounded-2xl border-2 border-amber-200 bg-amber-50 p-3 text-left shadow-sm active:bg-amber-100"
        >
          <span className="text-2xl">📰</span>
          <span className="min-w-0 flex-1">
            <span className="block font-bold text-amber-800">มีบทความใหม่ {newArticles} รายการ</span>
            <span className="block text-xs text-amber-600">แตะเพื่ออ่านความรู้ใหม่ ๆ กันเลย</span>
          </span>
          <span className="flex-shrink-0 text-amber-400">›</span>
        </button>
      )}

      <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-700">
        <span className="text-xl">🗂️</span> ชุดข้อสอบของวันนี้
      </h2>

      {sets.length === 0 ? (
        <Empty
          icon="🗂️"
          title="ยังไม่มีข้อสอบ"
          hint={isAdmin ? 'ไปที่แท็บแอดมินเพื่อเพิ่มชุดข้อสอบ' : 'รอแอดมินส่งข้อสอบเข้ามา'}
        />
      ) : (
        <div className="space-y-3">
          {sets.map((s) => {
            const a = attempts[s.id]
            const done = a && a.count > 0
            const isNew = new Date(s.created_at) > new Date(lastSeenAtLoad)
            return (
              <Card key={s.id} className="animate-rise overflow-hidden">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 text-2xl text-violet-600">
                    📝
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {isNew && <Badge color="red">✨ ใหม่</Badge>}
                      {done && (
                        <Badge color="green">
                          🏆 สูงสุด {a.best}/{a.total ?? s.question_count}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 truncate font-bold text-slate-800">{s.title || 'ชุดข้อสอบ'}</p>
                    <p className="text-xs text-slate-400">{s.question_count ?? 5} ข้อ · ลุยกันเลย!</p>
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <Button className="flex-1" onClick={() => navigate(`/quiz/${s.id}`)}>
                    {done ? '🔁 ทำใหม่' : '🚀 เริ่มทำข้อสอบ'}
                  </Button>
                  <Button
                    variant={done ? 'outline' : 'ghost'}
                    className="flex-1"
                    disabled={!done}
                    onClick={() => done && navigate(`/review/${s.id}`)}
                    title={done ? '' : 'ต้องทำข้อสอบก่อนถึงดูเฉลยได้'}
                  >
                    {done ? '📖 ดูเฉลย' : '🔒 ดูเฉลย'}
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <p className="mt-6 text-center text-xs text-slate-400">
        🔒 ดูเฉลยได้หลังจากทำข้อสอบชุดนั้นแล้วอย่างน้อย 1 ครั้ง
      </p>
    </div>
  )
}
