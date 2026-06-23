import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { supabase } from '../lib/supabase'
import { Spinner, Button, Empty, formatDuration } from '../components/ui'
import { AnswerInput } from '../components/AnswerInput'
import { encodeAnswer, hasAnswer } from '../lib/questions'

export default function CategoryQuiz() {
  const { category } = useParams()
  const { user } = useStore()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [questions, setQuestions] = useState([])
  const [idx, setIdx] = useState(0)
  const [responses, setResponses] = useState({}) // qid -> selectedKey
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef(null)
  const submittedRef = useRef(false)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const { data } = await supabase.rpc('get_category_quiz', { p_category: category })
      setQuestions(Array.isArray(data) ? data : [])
      setLoading(false)
    })()
  }, [category])

  // จับเวลาที่ใช้ทำ (นับขึ้น) — เริ่มเมื่อโหลดคำถามเสร็จ
  useEffect(() => {
    if (loading || !questions.length) return
    startRef.current = Date.now()
    const t = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
    }, 1000)
    return () => clearInterval(t)
  }, [loading, questions.length])

  const submit = async () => {
    if (submittedRef.current) return
    submittedRef.current = true
    setErr('')
    setSubmitting(true)
    try {
      const payload = questions.map((qq) => ({
        question_id: qq.id,
        selected_choice: encodeAnswer(qq.q_type, responses[qq.id]),
      }))
      const duration = startRef.current
        ? Math.floor((Date.now() - startRef.current) / 1000)
        : 0
      const { data, error } = await supabase.rpc('submit_category_attempt', {
        p_user_id: user.id,
        p_category: category,
        p_answers: payload,
        p_duration: duration,
      })
      if (error) throw error
      navigate(`/category-review/${data.attempt_id}`, {
        replace: true,
        state: { justFinished: data },
      })
    } catch (e) {
      submittedRef.current = false
      setErr(e.message || 'ส่งคำตอบไม่สำเร็จ')
      setSubmitting(false)
    }
  }

  if (loading) return <Spinner />
  if (!questions.length)
    return (
      <div className="px-4 pt-4">
        <Empty icon="🗂️" title="หมวดนี้ยังไม่มีข้อสอบ" hint="ลองเลือกหมวดอื่นในคลังข้อสอบ" />
        <Button variant="outline" className="mt-4 w-full" onClick={() => navigate('/library')}>
          ↩ กลับคลังข้อสอบ
        </Button>
      </div>
    )

  const q = questions[idx]
  const selected = responses[q.id]
  const answeredCount = questions.filter((qq) => hasAnswer(qq.q_type, responses[qq.id])).length
  const isLast = idx === questions.length - 1
  const setResp = (val) => setResponses((prev) => ({ ...prev, [q.id]: val }))

  return (
    <div className="flex min-h-[calc(100vh-60px)] flex-col px-4 pt-3">
      {/* แถบหัว: หมวด + เวลา */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          onClick={() => navigate('/library')}
          className="flex-shrink-0 rounded-lg bg-white/70 px-2 py-1 text-sm font-semibold text-violet-600 shadow-sm"
        >
          ← ออก
        </button>
        <span className="min-w-0 truncate text-sm font-bold text-slate-700">🗂️ {category}</span>
        <span className="flex-shrink-0 rounded-lg bg-white/70 px-2 py-1 text-xs font-bold tabular-nums text-slate-500 shadow-sm">
          ⏱ {formatDuration(elapsed)}
        </span>
      </div>

      {/* แถบความคืบหน้า */}
      <div className="mb-4">
        <div className="mb-1.5 flex items-center justify-end text-xs font-semibold text-slate-500">
          <span>
            ข้อ {idx + 1}/{questions.length} · ตอบ {answeredCount} ✅
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-violet-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-300"
            style={{ width: `${((idx + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* คำถาม */}
      <div key={q.id} className="animate-pop flex-1">
        <h2 className="mb-3 mt-1 whitespace-pre-wrap break-words text-lg font-bold leading-relaxed text-slate-800">
          {q.question_text}
        </h2>

        {q.image_url && (
          <img
            src={q.image_url}
            alt="รูปประกอบคำถาม"
            className="mb-4 max-h-72 w-full rounded-2xl border border-violet-100 object-contain shadow-sm"
            loading="eager"
            decoding="async"
          />
        )}

        <AnswerInput q={q} value={selected} onChange={setResp} />
      </div>

      {err && <p className="mt-2 text-sm font-medium text-rose-500">{err}</p>}

      {/* ปุ่มเลื่อน */}
      <div className="sticky bottom-2 mt-4 flex gap-2 pb-2">
        <Button variant="ghost" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}>
          ก่อนหน้า
        </Button>
        {isLast ? (
          <Button className="flex-1" onClick={submit} disabled={submitting}>
            {submitting ? 'กำลังส่ง…' : '🎯 ส่งคำตอบ'}
          </Button>
        ) : (
          <Button className="flex-1" onClick={() => setIdx((i) => i + 1)}>
            ถัดไป →
          </Button>
        )}
      </div>
    </div>
  )
}
