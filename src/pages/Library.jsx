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
  const [catCount, setCatCount] = useState({}) // setId -> { หมวด -> จำนวนข้อในหมวดนั้น }
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

    // นับจำนวนข้อในแต่ละหมวดของแต่ละชุด (ข้อที่ไม่มีหมวด -> "อื่น ๆ")
    const counts = {}
    for (const q of qData || []) {
      const cat = (q.category && q.category.trim()) || UNCATEGORIZED
      ;(counts[q.exam_set_id] ||= {})[cat] = (counts[q.exam_set_id]?.[cat] || 0) + 1
    }

    setSets(setsData || [])
    setAttempts(map)
    setCatCount(counts)
    setLoading(false)
  }, [user.id])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <Spinner />

  // จัดกลุ่มตามหมวดของคำถาม — ชุดเดียวอาจอยู่ได้หลายหมวด, เก็บจำนวนข้อในหมวดนั้นด้วย
  const groups = {}
  for (const s of sets) {
    const counts = catCount[s.id]
    if (counts && Object.keys(counts).length) {
      for (const [cat, n] of Object.entries(counts)) {
        ;(groups[cat] ||= []).push({ set: s, count: n })
      }
    } else {
      // ชุดที่ยังไม่มีข้อมูลคำถาม -> ไปอยู่หมวด "อื่น ๆ"
      ;(groups[UNCATEGORIZED] ||= []).push({ set: s, count: s.question_count || 0 })
    }
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
            const totalQ = list.reduce((sum, item) => sum + (item.count || 0), 0)
            return (
              <section key={cat}>
                <button
                  onClick={() => setCollapsed((c) => ({ ...c, [cat]: !c[cat] }))}
                  className="mb-2 flex w-full items-center gap-2"
                >
                  <span className="text-base font-bold text-slate-700">📁 {cat}</span>
                  <Badge color="indigo">{totalQ} ข้อ</Badge>
                  <span className="ml-auto text-xs text-slate-400">{isCollapsed ? '▼ แสดง' : '▲ ซ่อน'}</span>
                </button>

                {!isCollapsed && (
                  <div className="space-y-3">
                    {list.map(({ set: s, count }) => {
                      const done = attempts[s.id]?.count > 0
                      return (
                        <Card key={s.id} className="animate-rise">
                          <div className="flex items-start gap-3">
                            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 text-2xl text-violet-600">
                              📝
                            </div>
                            <div className="min-w-0 flex-1">
                              {done && <Badge color="green">✓ เคยทำชุดนี้แล้ว</Badge>}
                              <p className="mt-0.5 truncate font-bold text-slate-800">
                                {s.title || 'ชุดข้อสอบ'}
                              </p>
                              <p className="text-xs text-slate-400">
                                {count} ข้อในหมวด “{cat}”
                              </p>
                            </div>
                          </div>

                          <div className="mt-3">
                            <Button
                              className="w-full"
                              onClick={() =>
                                navigate(`/practice/set/${s.id}/${encodeURIComponent(cat)}`)
                              }
                            >
                              🎯 ทำเฉพาะข้อในหมวดนี้ ({count} ข้อ)
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
