import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { supabase, isConfigured } from '../lib/supabase'
import { getLastSeen, setLastSeen } from '../lib/notify'
import { Spinner, Button, Card, Badge, Empty } from '../components/ui'

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

  const load = useCallback(async () => {
    if (!isConfigured) {
      setLoading(false)
      return
    }
    setLoading(true)
    const [{ data: setsData }, { data: attemptData }] = await Promise.all([
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
    ])

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
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-400">สวัสดี</p>
          <p className="text-lg font-bold text-white">
            {user.username} {isAdmin && <Badge color="amber">แอดมิน</Badge>}
          </p>
        </div>
        <button
          onClick={logoutAll}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
        >
          ↩ ออกจากระบบ
        </button>
      </header>

      <h2 className="mb-3 text-base font-semibold text-slate-200">ชุดข้อสอบ</h2>

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
              <Card key={s.id}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-indigo-300">วันที่ {s.day_number}</span>
                      {isNew && <Badge color="red">ใหม่</Badge>}
                      {done && (
                        <Badge color="green">
                          คะแนนสูงสุด {a.best}/{a.total ?? s.question_count}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 truncate font-medium text-white">{s.title || 'ชุดข้อสอบ'}</p>
                    <p className="text-xs text-slate-400">{s.question_count ?? 5} ข้อ</p>
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <Button className="flex-1" onClick={() => navigate(`/quiz/${s.id}`)}>
                    {done ? 'ทำใหม่' : 'เริ่มทำข้อสอบ'}
                  </Button>
                  <Button
                    variant={done ? 'outline' : 'ghost'}
                    className="flex-1"
                    disabled={!done}
                    onClick={() => done && navigate(`/review/${s.id}`)}
                    title={done ? '' : 'ต้องทำข้อสอบก่อนถึงดูเฉลยได้'}
                  >
                    {done ? 'ดูเฉลย' : '🔒 ดูเฉลย'}
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <p className="mt-6 text-center text-xs text-slate-500">
        🔒 ดูเฉลยได้หลังจากทำข้อสอบชุดนั้นแล้วอย่างน้อย 1 ครั้ง
      </p>
    </div>
  )
}
