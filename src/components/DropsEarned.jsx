// แบนเนอร์สรุปรางวัลหลังทำข้อสอบ: หยดน้ำ + โบนัส streak/เป้าหมาย -> ลิงก์ไปสวน
export default function DropsEarned({ justFinished, onGarden }) {
  if (!justFinished) return null
  const game = justFinished.game
  const total = game ? (game.base_drops || 0) + (game.bonus_drops || 0) : justFinished.score || 0
  if (total <= 0 && !game?.goal_done) return null

  return (
    <div className="animate-rise mb-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 p-3 text-white shadow-lg shadow-emerald-300/40">
      <div className="flex items-center gap-2">
        <span className="text-2xl">💧</span>
        <p className="min-w-0 flex-1 text-sm font-bold">
          ได้รับ {total} หยดน้ำ!
          {game?.bonus_drops > 0 && (
            <span className="font-semibold text-white/85"> (รวมโบนัส +{game.bonus_drops})</span>
          )}
        </p>
      </div>
      {game && (game.new_day || game.goal_done) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {game.new_day && (
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold">
              🔥 {game.streak} วันติดต่อกัน
            </span>
          )}
          {game.goal_done && (
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold">
              🎯 เป้าหมายวันนี้สำเร็จ! +5
            </span>
          )}
        </div>
      )}
      <button
        onClick={onGarden}
        className="mt-2 w-full rounded-xl bg-white/20 py-2 text-sm font-bold hover:bg-white/30"
      >
        🌳 ไปรดน้ำต้นไม้
      </button>
    </div>
  )
}
