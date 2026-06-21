import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { supabase } from '../lib/supabase'
import { Spinner, Button, Empty } from '../components/ui'

export default function Quiz() {
  const { setId } = useParams()
  const { user } = useStore()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [examSet, setExamSet] = useState(null)
  const [questions, setQuestions] = useState([])
  const [idx, setIdx] = useState(0)
  const [responses, setResponses] = useState({}) // qid -> { selected, reason }
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const [{ data: set }, { data: qs }] = await Promise.all([
        supabase.from('exam_sets').select('id, day_number, title').eq('id', setId).single(),
        supabase
          .from('questions')
          .select('id, order_index, question_text, choices')
          .eq('exam_set_id', setId)
          .order('order_index', { ascending: true }),
      ])
      setExamSet(set)
      setQuestions(qs || [])
      setLoading(false)
    })()
  }, [setId])

  if (loading) return <Spinner />
  if (!questions.length)
    return <Empty icon="❓" title="ชุดนี้ยังไม่มีคำถาม" hint="กลับไปเลือกชุดอื่น" />

  const q = questions[idx]
  const resp = responses[q.id] || { selected: '', reason: '' }
  const answeredCount = Object.values(responses).filter((r) => r.selected).length
  const isLast = idx === questions.length - 1

  const setResp = (patch) =>
    setResponses((prev) => ({ ...prev, [q.id]: { ...resp, ...patch } }))

  const submit = async () => {
    setErr('')
    setSubmitting(true)
    try {
      const payload = questions.map((qq) => ({
        question_id: qq.id,
        selected_choice: responses[qq.id]?.selected || null,
        reason: responses[qq.id]?.reason?.trim() || null,
      }))
      const { data, error } = await supabase.rpc('submit_attempt', {
        p_user_id: user.id,
        p_exam_set_id: setId,
        p_answers: payload,
      })
      if (error) throw error
      // data = { attempt_id, score, total }
      navigate(`/review/${setId}`, { replace: true, state: { justFinished: data } })
    } catch (e) {
      setErr(e.message || 'ส่งคำตอบไม่สำเร็จ')
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-60px)] flex-col px-4 pt-3">
      {/* แถบความคืบหน้า */}
      <div className="mb-3">
        <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
          <button onClick={() => navigate('/')} className="underline">
            ← ออก
          </button>
          <span>
            ข้อ {idx + 1} / {questions.length} · ตอบแล้ว {answeredCount}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-indigo-500 transition-all"
            style={{ width: `${((idx + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* คำถาม */}
      <div key={q.id} className="animate-pop flex-1">
        <p className="text-xs text-slate-500">วันที่ {examSet?.day_number}</p>
        <h2 className="mb-4 mt-1 text-lg font-semibold leading-relaxed text-white">
          {q.question_text}
        </h2>

        <div className="space-y-2">
          {(q.choices || []).map((c) => {
            const active = resp.selected === c.key
            return (
              <button
                key={c.key}
                onClick={() => setResp({ selected: c.key })}
                className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                  active
                    ? 'border-indigo-500 bg-indigo-600/20'
                    : 'border-slate-700 bg-slate-900 active:bg-slate-800'
                }`}
              >
                <span
                  className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    active ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {c.key}
                </span>
                <span className="text-sm text-slate-100">{c.text}</span>
              </button>
            )
          })}
        </div>

        {/* ช่องเหตุผล */}
        <label className="mt-4 block text-sm font-medium text-slate-300">
          ทำไมถึงเลือกข้อนี้? (เหตุผลของคุณ)
        </label>
        <textarea
          value={resp.reason}
          onChange={(e) => setResp({ reason: e.target.value })}
          placeholder="อธิบายเหตุผลที่เลือกคำตอบนี้…"
          rows={3}
          className="mt-1 w-full resize-none rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm text-white outline-none focus:border-indigo-500"
        />
      </div>

      {err && <p className="mt-2 text-sm text-rose-400">{err}</p>}

      {/* ปุ่มเลื่อน */}
      <div className="sticky bottom-2 mt-4 flex gap-2 pb-2">
        <Button
          variant="ghost"
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={idx === 0}
        >
          ก่อนหน้า
        </Button>
        {isLast ? (
          <Button className="flex-1" onClick={submit} disabled={submitting}>
            {submitting ? 'กำลังส่ง…' : 'ส่งคำตอบ'}
          </Button>
        ) : (
          <Button className="flex-1" onClick={() => setIdx((i) => i + 1)}>
            ถัดไป
          </Button>
        )}
      </div>
    </div>
  )
}
