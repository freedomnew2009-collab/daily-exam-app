import { lazy, Suspense, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { supabase, isConfigured } from '../lib/supabase'
import { Spinner, Button } from '../components/ui'
import { playFinishSound } from '../lib/sound'

const Tree3D = lazy(() => import('../components/Tree3D'))

const LEVEL_NAMES = [
  'เมล็ดพันธุ์', 'ต้นกล้า', 'ต้นอ่อน', 'ต้นเล็ก', 'ต้นโต',
  'ต้นแข็งแรง', 'เริ่มผลิดอก', 'ดอกบานสะพรั่ง', 'เริ่มออกผล', 'ออกผลดก',
  'ต้นไม้ใหญ่', 'ร่มรื่น', 'ผลิดอกออกผล', 'อุดมสมบูรณ์', 'ต้นไม้มหัศจรรย์',
  'ต้นไม้ทองคำ', 'ต้นไม้พิเศษ', 'ต้นไม้ในตำนาน', 'ต้นไม้ศักดิ์สิทธิ์', 'ต้นไม้แห่งปัญญา',
]
const levelName = (lv) => LEVEL_NAMES[Math.min(lv - 1, LEVEL_NAMES.length - 1)]

const MAX_TREE_LEVEL = 20 // จำนวนฟอร์มต้นไม้ในคอลเลกชัน
const levelEmoji = (lv) =>
  lv <= 2 ? '🌱' : lv <= 4 ? '🌿' : lv <= 6 ? '🪴' : lv <= 9 ? '🌸' : lv <= 12 ? '🍎' : lv <= 16 ? '🌳' : '🌟'

// แคตตาล็อก Achievement — คำนวณจาก get_game_stats
const ACHIEVEMENTS = [
  { icon: '🌱', title: 'ก้าวแรก', desc: 'ทำข้อสอบครั้งแรก', need: 1, get: (s) => s.exams_done },
  { icon: '📚', title: 'ขยันทำ', desc: 'ทำข้อสอบ 10 ครั้ง', need: 10, get: (s) => s.exams_done },
  { icon: '🎯', title: 'แม่นยำ', desc: 'ตอบถูกสะสม 30 ข้อ', need: 30, get: (s) => s.total_correct },
  { icon: '🏹', title: 'มือฉมัง', desc: 'ตอบถูกสะสม 50 ข้อ', need: 50, get: (s) => s.total_correct },
  { icon: '🔥', title: 'ไฟลุก', desc: 'ทำติดกัน 3 วัน', need: 3, get: (s) => Math.max(s.streak, s.longest_streak) },
  { icon: '🔥', title: 'ไฟแรง', desc: 'ทำติดกัน 7 วัน', need: 7, get: (s) => Math.max(s.streak, s.longest_streak) },
  { icon: '⚡', title: 'ไฟไม่มอด', desc: 'ทำติดกัน 30 วัน', need: 30, get: (s) => Math.max(s.streak, s.longest_streak) },
  { icon: '🌳', title: 'คนสวนมือใหม่', desc: 'ต้นไม้เลเวล 5', need: 5, get: (s) => s.tree_level },
  { icon: '🌲', title: 'นักปลูกต้นไม้', desc: 'ต้นไม้เลเวล 10', need: 10, get: (s) => s.tree_level },
  { icon: '💯', title: 'เพอร์เฟกต์', desc: 'ได้คะแนนเต็ม 1 ชุด', need: 1, get: (s) => s.perfect_count },
  { icon: '📖', title: 'หนอนหนังสือ', desc: 'อ่านบทความจบ 5 เรื่อง', need: 5, get: (s) => s.articles_read },
]

export default function Garden() {
  const { user } = useStore()
  const navigate = useNavigate()
  const [g, setG] = useState(null)
  const [stats, setStats] = useState(null) // game stats: streak, goal, achievements
  const [loading, setLoading] = useState(true)
  const [watering, setWatering] = useState(false)
  const [celebrate, setCelebrate] = useState(null) // { level }
  const [preview, setPreview] = useState(null) // ดูฟอร์มเลเวลอื่นที่ปลดล็อกแล้ว

  useEffect(() => {
    ;(async () => {
      if (!isConfigured) {
        setLoading(false)
        return
      }
      const [{ data }, { data: gs }] = await Promise.all([
        supabase.rpc('get_garden', { p_user_id: user.id }),
        supabase.rpc('get_game_stats', { p_user_id: user.id }),
      ])
      setG(data)
      setStats(gs)
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
    setPreview(null)
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
  const displayLevel = preview ?? lv // ฟอร์มที่กำลังโชว์ในเวที 3D

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
          <Tree3D level={displayLevel} />
        </Suspense>
        <span className="absolute left-3 top-3 rounded-full bg-white/70 px-3 py-1 text-xs font-bold text-emerald-700 shadow">
          {levelName(displayLevel)}
          {preview && preview !== lv && <span className="text-slate-400"> · พรีวิว Lv{preview}</span>}
        </span>
        <span className="absolute bottom-3 right-3 rounded-full bg-white/70 px-2 py-1 text-[10px] font-semibold text-slate-500 shadow">
          🔄 ต้นไม้หมุนได้
        </span>
        {preview && preview !== lv && (
          <button
            onClick={() => setPreview(null)}
            className="absolute bottom-3 left-3 rounded-full bg-emerald-500 px-3 py-1 text-[10px] font-bold text-white shadow"
          >
            ↩ ดูต้นปัจจุบัน
          </button>
        )}
      </div>

      {/* คอลเลกชันฟอร์มต้นไม้ (ปลดล็อกตามเลเวล · ที่ยังไม่ถึงเป็นเงาดำ) */}
      <div className="mt-4">
        <h2 className="mb-2 flex items-center gap-2 text-base font-bold text-slate-700">
          <span className="text-xl">🪴</span> คอลเลกชันต้นไม้
          <span className="text-xs font-normal text-slate-400">
            (ปลดล็อก {Math.min(lv, MAX_TREE_LEVEL)}/{MAX_TREE_LEVEL})
          </span>
        </h2>
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: MAX_TREE_LEVEL }, (_, i) => i + 1).map((tl) => {
            const unlocked = tl <= lv
            const active = displayLevel === tl
            return (
              <button
                key={tl}
                onClick={() => unlocked && setPreview(tl)}
                disabled={!unlocked}
                className={`relative flex aspect-square flex-col items-center justify-center rounded-2xl border-2 transition ${
                  active
                    ? 'border-emerald-400 bg-emerald-50'
                    : unlocked
                      ? 'border-emerald-100 bg-white active:bg-emerald-50'
                      : 'border-slate-200 bg-slate-800/90'
                }`}
                title={unlocked ? `ฟอร์มเลเวล ${tl}` : 'ยังไม่ปลดล็อก — รดน้ำต้นไม้ให้ถึงเลเวลนี้'}
              >
                {unlocked ? (
                  <>
                    <span className="text-2xl">{levelEmoji(tl)}</span>
                    <span className="mt-0.5 text-[10px] font-bold text-emerald-600">Lv {tl}</span>
                  </>
                ) : (
                  <>
                    <span className="text-xl text-white/70">🔒</span>
                    <span className="mt-0.5 text-[10px] font-bold text-white/40">Lv {tl}</span>
                  </>
                )}
              </button>
            )
          })}
        </div>
        <p className="mt-1.5 text-center text-xs text-slate-400">
          แตะดูฟอร์มที่ปลดล็อกแล้ว · ช่องดำคือฟอร์มลับ ปลดล็อกด้วยการรดน้ำให้ถึงเลเวลนั้น ✨
        </p>
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

      {/* 🔥 Streak + 🎯 เป้าหมายรายวัน */}
      {stats && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-gradient-to-br from-orange-400 to-rose-500 p-4 text-center text-white shadow-md shadow-orange-300/40">
            <p className="text-3xl font-extrabold leading-none">
              🔥 {stats.streak}
            </p>
            <p className="mt-1 text-xs font-semibold text-white/90">วันติดต่อกัน</p>
            <p className="mt-1 text-[10px] text-white/70">สถิติสูงสุด {stats.longest_streak} วัน</p>
          </div>
          {(() => {
            const gc = Math.min(stats.goal_correct, stats.daily_goal)
            const pct = stats.daily_goal ? Math.round((gc / stats.daily_goal) * 100) : 0
            const done = stats.goal_correct >= stats.daily_goal
            return (
              <div className="rounded-2xl bg-white/80 p-4 text-center shadow-sm">
                <p className="text-xs font-semibold text-slate-500">🎯 เป้าหมายวันนี้</p>
                <p className="mt-0.5 text-2xl font-extrabold text-violet-600">
                  {stats.goal_correct}
                  <span className="text-sm text-slate-400">/{stats.daily_goal}</span>
                </p>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-violet-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="mt-1 text-[10px] font-semibold text-emerald-600">
                  {done ? '✅ สำเร็จแล้ว! +5 หยด' : `ตอบถูกอีก ${stats.daily_goal - stats.goal_correct} ข้อ`}
                </p>
              </div>
            )
          })()}
        </div>
      )}

      {/* 🏅 Achievement */}
      {stats && (
        <div className="mt-4">
          <h2 className="mb-2 flex items-center gap-2 text-base font-bold text-slate-700">
            <span className="text-xl">🏅</span> เหรียญรางวัล
            <span className="text-xs font-normal text-slate-400">
              ({ACHIEVEMENTS.filter((a) => a.get(stats) >= a.need).length}/{ACHIEVEMENTS.length})
            </span>
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {ACHIEVEMENTS.map((a, i) => {
              const cur = a.get(stats)
              const got = cur >= a.need
              return (
                <div
                  key={i}
                  className={`rounded-2xl border-2 p-2.5 text-center ${
                    got ? 'border-amber-200 bg-amber-50' : 'border-slate-100 bg-slate-50'
                  }`}
                >
                  <div className={`text-3xl ${got ? '' : 'opacity-30 grayscale'}`}>{a.icon}</div>
                  <p className={`mt-1 text-[11px] font-bold leading-tight ${got ? 'text-amber-700' : 'text-slate-400'}`}>
                    {a.title}
                  </p>
                  <p className="mt-0.5 text-[9px] leading-tight text-slate-400">{a.desc}</p>
                  {got ? (
                    <p className="mt-0.5 text-[10px] font-bold text-emerald-500">✓ สำเร็จ</p>
                  ) : (
                    <p className="mt-0.5 text-[10px] font-semibold text-slate-400">
                      {Math.min(cur, a.need)}/{a.need}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* วิธีได้หยดน้ำ */}
      <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3 text-sm text-emerald-800">
        <p className="font-bold">🌱 วิธีเลี้ยงต้นไม้</p>
        <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs leading-relaxed text-emerald-700">
          <li>ตอบข้อสอบ <b>ถูก 1 ข้อ = ได้ 1 หยดน้ำ 💧</b> (ทั้งข้อสอบรายวันและรายหมวด)</li>
          <li>รดน้ำครบ <b>{per} หยด = อัป 1 เลเวล</b> ต้นไม้จะโตขึ้นเรื่อย ๆ</li>
          <li>🔥 <b>ทำติดกันทุกวัน</b> ได้โบนัสหยดน้ำ (3 วัน +3 · 7 วัน +10 · 30 วัน +30)</li>
          <li>🎯 ทำ <b>เป้าหมายรายวันสำเร็จ +5 หยด</b></li>
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
