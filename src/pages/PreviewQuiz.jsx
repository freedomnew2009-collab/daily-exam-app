import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { useStore } from '../store'
import { supabase } from '../lib/supabase'
import { Spinner, Button, Empty, Badge, AutoTextarea, formatDuration } from '../components/ui'
import { AnswerInput, ReviewAnswer } from '../components/AnswerInput'
import { encodeAnswer, hasAnswer } from '../lib/questions'
import { playFinishSound } from '../lib/sound'
import { preloadImages } from '../lib/image'

export default function PreviewQuiz() {
  const { setId } = useParams()
  const { isAdmin } = useStore()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [questions, setQuestions] = useState([])
  const [idx, setIdx] = useState(0)
  const [responses, setResponses] = useState({}) // qid -> { selected, reason }
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')
  const [result, setResult] = useState(null) // { score, total, items }
  const [totalSeconds, setTotalSeconds] = useState(15 * 60)
  const [remaining, setRemaining] = useState(null)
  const startRef = useRef(null)
  const submitRef = useRef(null)
  const submittedRef = useRef(false)

  useEffect(() => {
    if (!isAdmin) return
    ;(async () => {
      setLoading(true)
      const [{ data: qs }, { data: setting }] = await Promise.all([
        supabase.rpc('get_set_quiz', { p_exam_set_id: setId }),
        supabase.from('app_settings').select('value').eq('key', 'quiz_minutes').maybeSingle(),
      ])
      const mins = Math.max(1, Number(setting?.value) || 15)
      setTotalSeconds(mins * 60)
      setRemaining(mins * 60)
      const list = Array.isArray(qs) ? qs : []
      setQuestions(list)
      preloadImages(list.map((q) => q.image_url))
      setLoading(false)
    })()
  }, [setId, isAdmin])

  // นับถอยหลังเหมือนข้อสอบจริง — หมดเวลาแล้วส่งอัตโนมัติ
  useEffect(() => {
    if (loading || result || !questions.length) return
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
  }, [loading, result, questions.length, totalSeconds])

  const submit = async () => {
    if (submittedRef.current) return
    submittedRef.current = true
    setErr('')
    setSubmitting(true)
    try {
      const payload = questions.map((qq) => ({
        question_id: qq.id,
        selected_choice: encodeAnswer(qq.q_type, responses[qq.id]?.selected),
      }))
      const { data, error } = await supabase.rpc('preview_attempt', {
        p_exam_set_id: setId,
        p_answers: payload,
      })
      if (error) throw error
      setResult(data)
      playFinishSound(data.total ? data.score / data.total : 0)
      window.scrollTo({ top: 0 })
    } catch (e) {
      submittedRef.current = false
      setErr(e.message || 'ตรวจคำตอบไม่สำเร็จ')
      setSubmitting(false)
    }
  }
  useEffect(() => {
    submitRef.current = submit
  })

  const restart = () => {
    submittedRef.current = false
    setResult(null)
    setResponses({})
    setIdx(0)
    setSubmitting(false)
    setRemaining(totalSeconds)
  }

  if (!isAdmin) return <Navigate to="/" replace />
  if (loading) return <Spinner />
  if (!questions.length)
    return (
      <div className="px-4 pt-4">
        <Empty icon="❓" title="ชุดนี้ยังไม่มีคำถาม" hint="กลับไปเพิ่มคำถามก่อนนะ" />
        <Button variant="outline" className="mt-4 w-full" onClick={() => navigate('/admin')}>
          ↩ กลับหน้าแอดมิน
        </Button>
      </div>
    )

  // ---------- หน้าสรุปผล (พรีวิว) ----------
  if (result) {
    const { score, total, items } = result
    const pct = total ? score / total : 0
    const cheer =
      pct === 1
        ? { emoji: '🏆', text: 'เพอร์เฟกต์!' }
        : pct >= 0.8
          ? { emoji: '🎉', text: 'ยอดเยี่ยมมาก!' }
          : pct >= 0.5
            ? { emoji: '💪', text: 'ทำได้ดี' }
            : { emoji: '🌱', text: 'ค่อย ๆ เก่งขึ้นได้!' }
    return (
      <div className="px-4 pt-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <button
            onClick={() => navigate('/admin')}
            className="rounded-lg bg-white/70 px-3 py-1.5 text-sm font-semibold text-violet-600 shadow-sm"
          >
            ↩ กลับแอดมิน
          </button>
          <Badge color="amber">👁️ โหมดพรีวิว · ไม่บันทึกคะแนน</Badge>
        </div>

        <div className="animate-pop mb-4 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-500 p-6 text-center text-white shadow-xl shadow-emerald-300/50">
          <div className="animate-float text-5xl">{cheer.emoji}</div>
          <p className="mt-2 text-sm text-white/80">คะแนนที่ได้ (ตัวอย่าง)</p>
          <p className="mt-1 text-5xl font-extrabold">
            {score}
            <span className="text-2xl text-white/70">/{total}</span>
          </p>
          <p className="mt-2 text-xl font-extrabold leading-snug text-white">
            {cheer.emoji} {cheer.text} {cheer.emoji}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <button
              onClick={restart}
              className="rounded-xl bg-white/20 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-white/30"
            >
              🔁 ลองทำใหม่
            </button>
          </div>
        </div>

        <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-700">
          <span className="text-xl">📖</span> เฉลยและคำอธิบาย
        </h2>
        <div className="space-y-3">
          {(items || []).map((it, i) => (
            <div
              key={it.question_id}
              className={`rounded-3xl border-2 bg-white/80 p-4 shadow-lg shadow-violet-200/40 backdrop-blur ${
                it.is_correct ? 'border-emerald-200' : 'border-rose-200'
              }`}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-xs font-bold text-slate-500">
                  ข้อ {i + 1}
                  {it.category && <Badge color="indigo">🏷️ {it.category}</Badge>}
                </span>
                {it.is_correct ? <Badge color="green">✅ ตอบถูก</Badge> : <Badge color="red">❌ ตอบผิด</Badge>}
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
          ))}
        </div>
      </div>
    )
  }

  // ---------- หน้าทำข้อสอบ (เหมือนนักเรียนเห็น) ----------
  const q = questions[idx]
  const resp = responses[q.id] || { selected: '', reason: '' }
  const answeredCount = questions.filter((qq) => hasAnswer(qq.q_type, responses[qq.id]?.selected)).length
  const isLast = idx === questions.length - 1
  const setResp = (patch) => setResponses((prev) => ({ ...prev, [q.id]: { ...resp, ...patch } }))
  const left = remaining ?? totalSeconds
  const low = left <= 60

  return (
    <div className="flex min-h-[calc(100vh-60px)] flex-col px-4 pt-3">
      {/* แถบพรีวิว */}
      <div className="mb-2 flex items-center justify-center gap-2 rounded-xl bg-amber-50 py-1.5 text-xs font-bold text-amber-700">
        👁️ โหมดพรีวิวแอดมิน · ไม่บันทึกคะแนน
      </div>

      {/* นาฬิกานับถอยหลัง */}
      <div
        className={`mb-3 flex flex-col items-center rounded-2xl border-2 py-2.5 ${
          low ? 'animate-pop border-rose-200 bg-rose-50' : 'border-violet-100 bg-white/80'
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

      {/* แถบความคืบหน้า */}
      <div className="mb-4">
        <div className="mb-1.5 flex items-center justify-between gap-2 text-xs font-semibold text-slate-500">
          <button
            onClick={() => navigate('/admin')}
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

        {/* ช่องเหตุผล (เหมือนข้อสอบจริง) */}
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
        <Button variant="ghost" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}>
          ก่อนหน้า
        </Button>
        {isLast ? (
          <Button className="flex-1" onClick={submit} disabled={submitting}>
            {submitting ? 'กำลังตรวจ…' : '🎯 ส่งคำตอบ (พรีวิว)'}
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
