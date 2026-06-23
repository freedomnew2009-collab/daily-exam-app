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
  const [cats, setCats] = useState([]) // [{ category, count }]
  const [progress, setProgress] = useState({}) // category -> { best_score, attempts, last_attempt_id, last_total }
  const [catOrder, setCatOrder] = useState([]) // ลำดับหมวดที่แอดมินสร้างไว้

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
    const [{ data: catsData }, { data: prog }, { data: catSetting }] = await Promise.all([
      supabase.rpc('get_practice_categories'),
      supabase.rpc('get_category_progress', { p_user_id: user.id }),
      supabase.from('app_settings').select('value').eq('key', 'categories').maybeSingle(),
    ])

    let order
    try {
      order = catSetting?.value ? JSON.parse(catSetting.value) : []
    } catch {
      order = []
    }
    setCatOrder(Array.isArray(order) ? order : [])
    setCats(Array.isArray(catsData) ? catsData : [])
    setProgress(prog && typeof prog === 'object' ? prog : {})
    setLoading(false)
  }, [user.id])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <Spinner />

  // เรียงหมวดตามลำดับที่แอดมินตั้งไว้ก่อน, หมวดที่ไม่อยู่ในลิสต์ต่อท้าย, "อื่น ๆ" ล่างสุด
  const rank = (c) => {
    if (c === UNCATEGORIZED) return Number.MAX_SAFE_INTEGER
    const i = catOrder.indexOf(c)
    return i === -1 ? Number.MAX_SAFE_INTEGER - 1 : i
  }
  const sortedCats = [...cats].sort((a, b) => {
    const ra = rank(a.category)
    const rb = rank(b.category)
    return ra !== rb ? ra - rb : a.category.localeCompare(b.category, 'th')
  })

  return (
    <div className="px-4 pt-4">
      <header className="animate-rise mb-5 flex items-center justify-between rounded-3xl bg-gradient-to-r from-fuchsia-500 to-violet-500 p-4 text-white shadow-lg shadow-fuchsia-300/50">
        <div className="min-w-0">
          <p className="text-xs text-white/80">ทำข้อสอบแยกตามหมวด รวมข้อจากทุกชุด</p>
          <h1 className="text-lg font-extrabold">📚 คลังข้อสอบ</h1>
        </div>
        <button
          onClick={logoutAll}
          className="flex-shrink-0 rounded-xl bg-white/20 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/30"
        >
          ↩ ออก
        </button>
      </header>

      {sortedCats.length === 0 ? (
        <Empty
          icon="🗂️"
          title="ยังไม่มีข้อสอบในคลัง"
          hint={isAdmin ? 'ไปที่แท็บแอดมินเพื่อเพิ่มชุดข้อสอบ' : 'รอแอดมินส่งข้อสอบเข้ามา'}
        />
      ) : (
        <div className="space-y-3 pb-4">
          {sortedCats.map(({ category, count }) => {
            const p = progress[category]
            const done = p && p.attempts > 0
            return (
              <Card key={category} className="animate-rise">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 text-2xl text-violet-600">
                    🗂️
                  </div>
                  <div className="min-w-0 flex-1">
                    {done && (
                      <Badge color="green">
                        🏆 สูงสุด {p.best_score}/{p.last_total ?? count}
                      </Badge>
                    )}
                    <p className="mt-0.5 truncate font-bold text-slate-800">{category}</p>
                    <p className="text-xs text-slate-400">{count} ข้อ (รวมทุกชุด)</p>
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => navigate(`/category-quiz/${encodeURIComponent(category)}`)}
                  >
                    {done ? '🔁 ทำใหม่' : '🚀 เริ่มทำข้อสอบ'}
                  </Button>
                  <Button
                    variant={done ? 'outline' : 'ghost'}
                    className="flex-1"
                    disabled={!done}
                    onClick={() => done && navigate(`/category-review/${p.last_attempt_id}`)}
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
    </div>
  )
}
