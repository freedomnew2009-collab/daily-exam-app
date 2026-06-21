import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { supabase } from '../lib/supabase'
import { Spinner, Button, Badge, Empty } from '../components/ui'

export default function Review() {
  const { setId } = useParams()
  const { user } = useStore()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      setErr('')
      const { data: res, error } = await supabase.rpc('get_review', {
        p_user_id: user.id,
        p_exam_set_id: setId,
      })
      if (error) setErr(error.message)
      else setData(res)
      setLoading(false)
    })()
  }, [setId, user.id])

  if (loading) return <Spinner />
  if (err)
    return (
      <Empty
        icon="🔒"
        title="ยังดูเฉลยไม่ได้"
        hint="ต้องทำข้อสอบชุดนี้ให้เสร็จก่อนอย่างน้อย 1 ครั้ง"
      />
    )
  if (!data || !data.items?.length)
    return <Empty icon="🔒" title="ยังไม่มีเฉลย" hint="ทำข้อสอบก่อนนะ" />

  const { score, total, items } = data

  return (
    <div className="px-4 pt-4">
      <button onClick={() => navigate('/')} className="mb-2 text-sm text-slate-400 underline">
        ← กลับหน้าหลัก
      </button>

      {/* สรุปคะแนน */}
      <div className="mb-4 rounded-2xl border border-slate-800 bg-gradient-to-br from-indigo-700/30 to-slate-900 p-5 text-center">
        <p className="text-sm text-slate-300">คะแนนล่าสุดของคุณ</p>
        <p className="mt-1 text-4xl font-extrabold text-white">
          {score}
          <span className="text-xl text-slate-400">/{total}</span>
        </p>
        <div className="mt-2 flex justify-center gap-2">
          <Button variant="outline" onClick={() => navigate(`/quiz/${setId}`)}>
            ทำใหม่อีกครั้ง
          </Button>
        </div>
      </div>

      <h2 className="mb-3 text-base font-semibold text-slate-200">เฉลยและคำอธิบาย</h2>

      <div className="space-y-3">
        {items.map((it, i) => {
          const correct = it.is_correct
          return (
            <div key={it.question_id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">ข้อ {i + 1}</span>
                {correct ? <Badge color="green">ตอบถูก</Badge> : <Badge color="red">ตอบผิด</Badge>}
              </div>
              <p className="mb-3 font-medium leading-relaxed text-white">{it.question_text}</p>

              <div className="space-y-1.5">
                {(it.choices || []).map((c) => {
                  const isCorrect = c.key === it.correct_choice
                  const isYours = c.key === it.your_choice
                  return (
                    <div
                      key={c.key}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                        isCorrect
                          ? 'border-emerald-600/50 bg-emerald-600/15 text-emerald-200'
                          : isYours
                            ? 'border-rose-600/50 bg-rose-600/10 text-rose-200'
                            : 'border-slate-800 text-slate-300'
                      }`}
                    >
                      <span className="font-bold">{c.key}</span>
                      <span className="flex-1">{c.text}</span>
                      {isCorrect && <span>✅</span>}
                      {isYours && !isCorrect && <span>← คุณเลือก</span>}
                    </div>
                  )
                })}
              </div>

              {it.your_reason && (
                <div className="mt-3 rounded-lg bg-slate-800/60 p-3 text-sm">
                  <p className="mb-0.5 text-xs font-semibold text-slate-400">เหตุผลที่คุณตอบ</p>
                  <p className="text-slate-200">{it.your_reason}</p>
                </div>
              )}

              {it.explanation && (
                <div className="mt-3 rounded-lg border border-indigo-700/40 bg-indigo-600/10 p-3 text-sm">
                  <p className="mb-0.5 text-xs font-semibold text-indigo-300">💡 คำอธิบาย / เฉลย</p>
                  <p className="leading-relaxed text-slate-100">{it.explanation}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
