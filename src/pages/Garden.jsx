import { lazy, Suspense, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { supabase, isConfigured } from '../lib/supabase'
import { Spinner, Button } from '../components/ui'
import { playFinishSound } from '../lib/sound'

const Tree3D = lazy(() => import('../components/Tree3D'))

const LEVEL_NAMES = [
  'เมล็ดพันธุ์', 'ต้นกล้า', 'ต้นอ่อน', 'ต้นเล็ก', 'ต้นโต',
  'ต้นแข็งแรง', 'เริ่มผลิดอก', 'ออกผลแล้ว', 'ต้นไม้ใหญ่', 'ต้นไม้มหัศจรรย์',
]
const levelName = (lv) => LEVEL_NAMES[Math.min(lv - 1, LEVEL_NAMES.length - 1)]

export default function Garden() {
  const { user } = useStore()
  const navigate = useNavigate()
  const [g, setG] = useState(null)
  const [loading, setLoading] = useState(true)
  const [watering, setWatering] = useState(false)
  const [celebrate, setCelebrate] = useState(null) // { level }

  useEffect(() => {
    ;(async () => {
      if (!isConfigured) {
        setLoading(false)
        return
      }
      const { data } = await supabase.rpc('get_garden', { p_user_id: user.id })
      setG(data)
      setLoading(false)
    })()
  }, [user.id])

  const water = async (count) => {
    if (watering || !g || g.drops <= 0) return
    setWatering(true)
    const { data, error } = await supabase.rpc('water_tree', { p_user_id: user.id, p_count: count })
    setWatering(false)
    if (error || !data) return
    setG(data)
    if ((data.leveled_up || 0) > 0) {
      setCelebrate({ level: data.level })
      playFinishSound(1)
    }
  }

  if (loading) return <Spinner />

  const lv = g?.level ?? 1
  const inLv = g?.in_level ?? 0
  const per = g?.per_level ?? 5
  const drops = g?.drops ?? 0
  const pct = Math.round((inLv / per) * 100)

  return (
    <div className="px-4 pt-4 pb-6">
      <header className="animate-rise mb-4 flex items-center justify-between rounded-3xl bg-gradient-to-r from-emerald-500 to-teal-500 p-4 text-white shadow-lg shadow-emerald-300/50">
        <div className="min-w-0">
          <p className="text-xs text-white/80">สวนของฉัน · เลี้ยงต้นไม้ด้วยการทำข้อสอบ</p>
          <h1 className="text-lg font-extrabold">🌳 สวนต้นไม้</h1>
        </div>
        <div className="flex-shrink-0 rounded-2xl bg-white/20 px-3 py-1.5 text-center">
          <p className="text-[10px] text-white/80">เลเวล</p>
          <p className="text-xl font-extrabold leading-none">{lv}</p>
        </div>
      </header>

      {/* เวที 3D */}
      <div className="animate-pop relative h-72 overflow-hidden rounded-3xl border border-emerald-100 bg-gradient-to-b from-sky-200 via-sky-100 to-emerald-50 shadow-inner">
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center text-6xl">🌳</div>
          }
        >
          <Tree3D level={lv} />
        </Suspense>
        <span className="absolute left-3 top-3 rounded-full bg-white/70 px-3 py-1 text-xs font-bold text-emerald-700 shadow">
          {levelName(lv)}
        </span>
        <span className="absolute bottom-3 right-3 rounded-full bg-white/70 px-2 py-1 text-[10px] font-semibold text-slate-500 shadow">
          🔄 ต้นไม้หมุนได้
        </span>
      </div>

      {/* ความคืบหน้าสู่เลเวลถัดไป */}
      <div className="mt-4 rounded-2xl bg-white/80 p-4 shadow-sm">
        <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-500">
          <span>โตอีก {per - inLv} หยดจะถึงเลเวล {lv + 1}</span>
          <span className="tabular-nums">{inLv}/{per}</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-emerald-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* หยดน้ำ + ปุ่มรดน้ำ */}
      <div className="mt-4 rounded-3xl bg-gradient-to-br from-sky-50 to-blue-50 p-4 text-center shadow-sm">
        <p className="text-sm text-slate-500">หยดน้ำที่มี</p>
        <p className="text-4xl font-extrabold text-sky-600">💧 {drops}</p>
        {drops > 0 ? (
          <div className="mt-3 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => water(1)} disabled={watering}>
              💧 รด 1 หยด
            </Button>
            <Button className="flex-1" onClick={() => water(drops)} disabled={watering}>
              🌊 รดทั้งหมด ({drops})
            </Button>
          </div>
        ) : (
          <div className="mt-3">
            <p className="mb-2 text-sm font-semibold text-slate-500">
              หยดน้ำหมดแล้ว — ไปทำข้อสอบเก็บเพิ่มกันเถอะ!
            </p>
            <Button className="w-full" onClick={() => navigate('/')}>
              📝 ไปทำข้อสอบ
            </Button>
          </div>
        )}
      </div>

      {/* วิธีได้หยดน้ำ */}
      <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3 text-sm text-emerald-800">
        <p className="font-bold">🌱 วิธีเลี้ยงต้นไม้</p>
        <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs leading-relaxed text-emerald-700">
          <li>ตอบข้อสอบ <b>ถูก 1 ข้อ = ได้ 1 หยดน้ำ 💧</b> (ทั้งข้อสอบรายวันและรายหมวด)</li>
          <li>รดน้ำครบ <b>{per} หยด = อัป 1 เลเวล</b> ต้นไม้จะโตขึ้นเรื่อย ๆ</li>
          <li>ยิ่งเลเวลสูง ต้นไม้ยิ่งใหญ่ และจะ <b>ผลิดอกออกผล</b> 🌸🍎</li>
        </ul>
      </div>

      {/* ฉลองอัปเลเวล */}
      {celebrate && (
        <div
          onClick={() => setCelebrate(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6 backdrop-blur-sm"
        >
          <div className="animate-pop max-w-xs rounded-3xl bg-white p-7 text-center shadow-2xl">
            <div className="animate-float text-6xl">🌳</div>
            <h2 className="mt-2 text-xl font-extrabold text-emerald-600">เลเวลอัป! 🎉</h2>
            <p className="mt-1 text-sm text-slate-500">
              ต้นไม้โตขึ้นเป็น <b className="text-emerald-600">เลเวล {celebrate.level}</b>
              <br />
              {levelName(celebrate.level)}
            </p>
            <button
              onClick={() => setCelebrate(null)}
              className="mt-4 rounded-2xl bg-emerald-500 px-6 py-2.5 font-bold text-white hover:bg-emerald-600"
            >
              เย้! 🙌
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
