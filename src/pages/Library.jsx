import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { supabase, isConfigured } from '../lib/supabase'
import { Spinner, Button, Badge, Empty, Card } from '../components/ui'

const UNCATEGORIZED = 'อื่น ๆ'

export default function Library() {
  const { user, isAdmin, logoutUser, adminSignOut } = useStore()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [sets, setSets] = useState([])
  const [attempts, setAttempts] = useState({})
  const [catBySet, setCatBySet] = useState({}) // setId -> [หมวดที่มีในชุดนั้น]
  const [catOrder, setCatOrder] = useState([]) // ลำดับหมวดที่แอดมินสร้างไว้
  const [collapsed, setCollapsed] = useState({}) // category -> ซ่อนอยู่ไหม

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
    const [{ data: setsData }, { data: attemptData }, { data: qData }, { data: catSetting }] =
      await Promise.all([
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
        supabase.from('questions').select('exam_set_id, category'),
        supabase.from('app_settings').select('value').eq('key', 'categories').maybeSingle(),
      ])

    let order
    try {
      order = catSetting?.value ? JSON.parse(catSetting.value) : []
    } catch {
      order = []
    }
    setCatOrder(Array.isArray(order) ? order : [])

    const map = {}
    for (const a of attemptData || []) {
      const cur = map[a.exam_set_id] || { count: 0, best: 0, total: a.total }
      cur.count += 1
      cur.best = Math.max(cur.best, a.score || 0)
      cur.total = a.total
      map[a.exam_set_id] = cur
    }

    // รวมหมวดที่ปรากฏในแต่ละชุด (เฉพาะข้อที่มีหมวด)
    const cats = {}
    for (const q of qData || []) {
      if (!q.category) continue
      ;(cats[q.exam_set_id] ||= new Set()).add(q.category)
    }
    const catMap = {}
    for (const k of Object.keys(cats)) catMap[k] = [...cats[k]]

    setSets(setsData || [])
    setAttempts(map)
    setCatBySet(catMap)
    setLoading(false)
  }, [user.id])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <Spinner />

  // จัดกลุ่มตามหมวดของคำถาม — ชุดเดียวอาจอยู่ได้หลายหมวด
  const groups = {}
  for (const s of sets) {
    const setCats = catBySet[s.id]?.length ? catBySet[s.id] : [UNCATEGORIZED]
    for (const cat of setCats) (groups[cat] ||= []).push(s)
  }
  // เรียงหมวดตามลำดับที่แอดมินสร้างไว้ก่อน, หมวดอื่น ๆ ที่ไม่อยู่ในลิสต์ต่อท้าย, "อื่น ๆ" ล่างสุด
  const rank = (c) => {
    if (c === UNCATEGORIZED) return Number.MAX_SAFE_INTEGER
    const i = catOrder.indexOf(c)
    return i === -1 ? Number.MAX_SAFE_INTEGER - 1 : i
  }
  const cats = Object.keys(groups).sort((a, b) => {
    const ra = rank(a)
    const rb = rank(b)
    return ra !== rb ? ra - rb : a.localeCompare(b, 'th')
  })

  return (
    <div className="px-4 pt-4">
      <header className="animate-rise mb-5 flex items-center justify-between rounded-3xl bg-gradient-to-r from-fuchsia-500 to-violet-500 p-4 text-white shadow-lg shadow-fuchsia-300/50">
        <div className="min-w-0">
          <p className="text-xs text-white/80">รวมข้อสอบทั้งหมด แยกตามหมวด</p>
          <h1 className="text-lg font-extrabold">📚 คลังข้อสอบ</h1>
        </div>
        <button
          onClick={logoutAll}
          className="flex-shrink-0 rounded-xl bg-white/20 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/30"
        >
          ↩ ออก
        </button>
      </header>

      {sets.length === 0 ? (
        <Empty
          icon="🗂️"
          title="ยังไม่มีข้อสอบในคลัง"
          hint={isAdmin ? 'ไปที่แท็บแอดมินเพื่อเพิ่มชุดข้อสอบ' : 'รอแอดมินส่งข้อสอบเข้ามา'}
        />
      ) : (
        <div className="space-y-5 pb-4">
          {cats.map((cat) => {
            const list = groups[cat]
            const isCollapsed = collapsed[cat]
            return (
              <section key={cat}>
                <button
                  onClick={() => setCollapsed((c) => ({ ...c, [cat]: !c[cat] }))}
                  className="mb-2 flex w-full items-center gap-2"
                >
                  <span className="text-base font-bold text-slate-700">📁 {cat}</span>
                  <Badge color="indigo">{list.length}</Badge>
                  <span className="ml-auto text-xs text-slate-400">{isCollapsed ? '▼ แสดง' : '▲ ซ่อน'}</span>
                </button>

                {!isCollapsed && (
                  <div className="space-y-3">
                    {list.map((s) => {
                      const a = attempts[s.id]
                      const done = a && a.count > 0
                      return (
                        <Card key={s.id} className="animate-rise">
                          <div className="flex items-start gap-3">
                            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 text-2xl text-violet-600">
                              📝
                            </div>
                            <div className="min-w-0 flex-1">
                              {done && (
                                <Badge color="green">
                                  🏆 สูงสุด {a.best}/{a.total ?? s.question_count}
                                </Badge>
                              )}
                              <p className="mt-0.5 truncate font-bold text-slate-800">
                                {s.title || 'ชุดข้อสอบ'}
                              </p>
                              <p className="text-xs text-slate-400">{s.question_count ?? 5} ข้อ</p>
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
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
