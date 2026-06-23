import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { supabase } from '../lib/supabase'
import { Spinner, Badge, Empty, formatDuration } from '../components/ui'
import { ReviewAnswer } from '../components/AnswerInput'

export default function CategoryReview() {
  const { attemptId } = useParams()
  const { user } = useStore()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [scoreMsgs, setScoreMsgs] = useState([])

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      setErr('')
      const [{ data: res, error }, { data: settings }] = await Promise.all([
        supabase.rpc('get_category_review', { p_user_id: user.id, p_attempt_id: attemptId }),
        supabase.from('app_settings').select('key, value').in('key', ['score_messages']),
      ])
      if (error) setErr(error.message)
      else setData(res)
      const sm = {}
      for (const r of settings || []) sm[r.key] = r.value
      let parsed
      try {
        parsed = sm['score_messages'] ? JSON.parse(sm['score_messages']) : []
      } catch {
        parsed = []
      }
      setScoreMsgs(Array.isArray(parsed) ? parsed : [])
      setLoading(false)
    })()
  }, [attemptId, user.id])

  if (loading) return <Spinner />
  if (err || !data || !data.items?.length)
    return (
      <div className="px-4 pt-4">
        <Empty icon="🔒" title="ยังดูเฉลยไม่ได้" hint="ต้องทำข้อสอบหมวดนี้ให้เสร็จก่อน" />
      </div>
    )

  const { score, total, items, duration_seconds, category } = data
  const pct = total ? score / total : 0
  const pctNum = Math.round(pct * 100)
  const scoreMsg =
    [...scoreMsgs]
      .filter((r) => r && r.t)
      .sort((a, b) => Number(b.p) - Number(a.p))
      .find((r) => pctNum >= Number(r.p))?.t || ''
  const cheer =
    pct === 1
      ? { emoji: '🏆', text: 'เพอร์เฟกต์! เก่งมาก ๆ เลย' }
      : pct >= 0.8
        ? { emoji: '🎉', text: 'ยอดเยี่ยมมาก!' }
        : pct >= 0.5
          ? { emoji: '💪', text: 'ทำได้ดี ลองอีกครั้งได้นะ' }
          : { emoji: '🌱', text: 'ไม่เป็นไร ค่อย ๆ เก่งขึ้นได้!' }

  return (
    <div className="px-4 pt-4">
      <button
        onClick={() => navigate('/library')}
        className="mb-3 rounded-lg bg-white/70 px-3 py-1.5 text-sm font-semibold text-violet-600 shadow-sm"
      >
        ← กลับคลังข้อสอบ
      </button>

      {/* สรุปคะแนน */}
      <div className="animate-pop mb-4 rounded-3xl bg-gradient-to-br from-fuchsia-500 to-violet-500 p-6 text-center text-white shadow-xl shadow-fuchsia-300/50">
        <div className="animate-float text-5xl">{cheer.emoji}</div>
        <p className="mt-2 text-sm text-white/80">ข้อสอบหมวด “{category}”</p>
        <p className="mt-1 text-5xl font-extrabold">
          {score}
          <span className="text-2xl text-white/70">/{total}</span>
        </p>
        <p className="mt-1 text-sm font-semibold text-white/90">{scoreMsg || cheer.text}</p>
        {duration_seconds > 0 && (
          <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-sm font-bold tabular-nums">
            ⏱ ใช้เวลา {formatDuration(duration_seconds)} นาที
          </p>
        )}
        <div className="mt-4 flex justify-center gap-2">
          <button
            onClick={() => navigate(`/category-quiz/${encodeURIComponent(category)}`)}
            className="rounded-2xl bg-white/20 px-5 py-2.5 font-bold text-white hover:bg-white/30"
          >
            🔁 ทำใหม่อีกครั้ง
          </button>
        </div>
      </div>

      <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-700">
        <span className="text-xl">📖</span> เฉลยและคำอธิบาย
      </h2>

      <div className="space-y-3">
        {items.map((it, i) => {
          const correct = it.is_correct
          return (
            <div
              key={it.question_id}
              className={`rounded-3xl border-2 bg-white/80 p-4 shadow-lg shadow-violet-200/40 backdrop-blur ${
                correct ? 'border-emerald-200' : 'border-rose-200'
              }`}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-500">ข้อ {i + 1}</span>
                {correct ? <Badge color="green">✅ ตอบถูก</Badge> : <Badge color="red">❌ ตอบผิด</Badge>}
              </div>
              <p className="mb-3 whitespace-pre-wrap break-words font-bold leading-relaxed text-slate-800">
                {it.question_text}
              </p>

              {it.image_url && (
                <img
                  src={it.image_url}
                  alt="รูปประกอบคำถาม"
                  className="mb-3 max-h-64 w-full rounded-2xl border border-violet-100 object-contain"
                  loading="lazy"
                />
              )}

              <ReviewAnswer it={it} />

              {(it.explanation || (it.explanation_images || []).length > 0) && (
                <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50 p-3 text-sm">
                  <p className="mb-0.5 text-xs font-bold text-violet-600">💡 คำอธิบาย / เฉลย</p>
                  {it.explanation && (
                    <p className="whitespace-pre-wrap leading-relaxed text-slate-700">{it.explanation}</p>
                  )}
                  {(it.explanation_images || []).length > 0 && (
                    <div className="mt-2 space-y-2">
                      {it.explanation_images.map((url) => (
                        <a key={url} href={url} target="_blank" rel="noreferrer" className="block">
                          <img
                            src={url}
                            alt="รูปประกอบคำอธิบาย"
                            className="block max-h-80 w-full rounded-xl border border-violet-100 object-contain"
                            loading="lazy"
                          />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
