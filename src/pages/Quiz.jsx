import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { supabase } from '../lib/supabase'
import { Spinner, Button, Empty, Badge, AutoTextarea, formatDuration } from '../components/ui'
import { AnswerInput } from '../components/AnswerInput'
import { encodeAnswer, hasAnswer } from '../lib/questions'

export default function Quiz() {
  const { setId } = useParams()
  const { user } = useStore()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [questions, setQuestions] = useState([])
  const [idx, setIdx] = useState(0)
  const [responses, setResponses] = useState({}) // qid -> { selected, reason }
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')
  const [totalSeconds, setTotalSeconds] = useState(15 * 60) // เวลาทั้งหมด (แอดมินตั้งได้)
  const [remaining, setRemaining] = useState(null) // วินาทีที่เหลือ (นับถอยหลัง)
  const startRef = useRef(null)
  const submitRef = useRef(null)
  const submittedRef = useRef(false)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const [{ data: qs }, { data: setting }] = await Promise.all([
        supabase.rpc('get_set_quiz', { p_exam_set_id: setId }),
        supabase.from('app_settings').select('value').eq('key', 'quiz_minutes').maybeSingle(),
      ])
      const mins = Math.max(1, Number(setting?.value) || 15)
      setTotalSeconds(mins * 60)
      setRemaining(mins * 60)
      setQuestions(qs || [])
      setLoading(false)
    })()
  }, [setId])

  // นับถอยหลังเมื่อโหลดคำถามเสร็จ — หมดเวลาแล้วส่งอัตโนมัติ
  useEffect(() => {
    if (loading || !questions.length) return
    startRef.current = Date.now()
    setRemaining(totalSeconds)
    const t = setInterval(() => {
      const left = totalSeconds - Math.floor((Date.now() - startRef.current) / 1000)
      if (left <= 0) {
        clearInterval(t)
        setRemaining(0)
        submitRef.current?.()
      } else {
        setRemaining(left)
      }
    }, 1000)
    return () => clearInterval(t)
  }, [loading, questions.length, totalSeconds])

  const submit = async () => {
    if (submittedRef.current) return // กันส่งซ้ำ (เช่น หมดเวลา + กดส่งพร้อมกัน)
    submittedRef.current = true
    setErr('')
    setSubmitting(true)
    try {
      const payload = questions.map((qq) => ({
        question_id: qq.id,
        selected_choice: encodeAnswer(qq.q_type, responses[qq.id]?.selected),
        reason: responses[qq.id]?.reason?.trim() || null,
      }))
      const duration = startRef.current
        ? Math.min(totalSeconds, Math.floor((Date.now() - startRef.current) / 1000))
        : 0
      const { data, error } = await supabase.rpc('submit_attempt', {
        p_user_id: user.id,
        p_exam_set_id: setId,
        p_answers: payload,
        p_duration: duration,
      })
      if (error) throw error
      // data = { attempt_id, score, total }
      navigate(`/review/${setId}`, { replace: true, state: { justFinished: data } })
    } catch (e) {
      submittedRef.current = false
      setErr(e.message || 'ส่งคำตอบไม่สำเร็จ')
      setSubmitting(false)
    }
  }
  // เก็บ submit ล่าสุดไว้ใน ref เพื่อให้ตัวจับเวลาเรียกได้ตอนหมดเวลา
  useEffect(() => {
    submitRef.current = submit
  })

  if (loading) return <Spinner />
  if (!questions.length)
    return <Empty icon="❓" title="ชุดนี้ยังไม่มีคำถาม" hint="กลับไปเลือกชุดอื่น" />

  const q = questions[idx]
  const resp = responses[q.id] || { selected: '', reason: '' }
  const answeredCount = questions.filter((qq) => hasAnswer(qq.q_type, responses[qq.id]?.selected)).length
  const isLast = idx === questions.length - 1

  const setResp = (patch) =>
    setResponses((prev) => ({ ...prev, [q.id]: { ...resp, ...patch } }))

  return (
    <div className="flex min-h-[calc(100vh-60px)] flex-col px-4 pt-3">
      {/* นาฬิกานับถอยหลัง — ตัวเลขใหญ่เห็นชัด */}
      {(() => {
        const left = remaining ?? totalSeconds
        const low = left <= 60
        return (
          <div
            className={`mb-3 flex flex-col items-center rounded-2xl border-2 py-2.5 ${
              low
                ? 'animate-pop border-rose-200 bg-rose-50'
                : 'border-violet-100 bg-white/80'
            }`}
          >
            <span className={`text-xs font-bold ${low ? 'text-rose-500' : 'text-slate-400'}`}>
              {low ? '⏰ ใกล้หมดเวลาแล้ว!' : '⏱ เวลาที่เหลือ'}
            </span>
            <span
              className={`text-5xl font-extrabold tabular-nums leading-tight ${
                low ? 'text-rose-600' : 'text-violet-700'
              }`}
            >
              {formatDuration(left)}
            </span>
          </div>
        )
      })()}

      {/* แถบความคืบหน้า */}
      <div className="mb-4">
        <div className="mb-1.5 flex items-center justify-between gap-2 text-xs font-semibold text-slate-500">
          <button
            onClick={() => navigate('/')}
            className="flex-shrink-0 rounded-lg bg-white/70 px-2 py-1 text-violet-600 shadow-sm"
          >
            ← ออก
          </button>
          <span className="flex-shrink-0">
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
        {q.category && (
          <div className="flex items-center gap-2">
            <Badge color="indigo">🏷️ {q.category}</Badge>
          </div>
        )}
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

        <AnswerInput q={q} value={resp.selected} onChange={(v) => setResp({ selected: v })} />

        {/* ช่องเหตุผล */}
        <label className="mt-5 block text-sm font-bold text-slate-600">
          💭 ทำไมถึงเลือกข้อนี้? (เหตุผลของคุณ)
        </label>
        <AutoTextarea
          value={resp.reason}
          onChange={(e) => setResp({ reason: e.target.value })}
          placeholder="อธิบายเหตุผลที่เลือกคำตอบนี้…"
          minRows={3}
          className="mt-1.5 w-full resize-none rounded-2xl border-2 border-violet-100 bg-white p-3 text-sm text-slate-800 outline-none transition focus:border-violet-400"
        />
      </div>

      {err && <p className="mt-2 text-sm font-medium text-rose-500">{err}</p>}

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
