import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { supabase } from '../lib/supabase'
import { Spinner, Button, Badge, Empty } from '../components/ui'

export default function PracticeQuiz({ mode }) {
  const { user } = useStore()
  const params = useParams()
  const navigate = useNavigate()
  const category = params.category || null

  const [loading, setLoading] = useState(true)
  const [questions, setQuestions] = useState([])
  const [idx, setIdx] = useState(0)
  const [selected, setSelected] = useState(null)
  const [revealed, setRevealed] = useState(false)
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res =
      mode === 'wrong'
        ? await supabase.rpc('get_wrong_questions', { p_user_id: user.id })
        : await supabase.rpc('get_category_questions', { p_category: category, p_limit: 10 })
    setQuestions(Array.isArray(res.data) ? res.data : [])
    setLoading(false)
  }, [mode, category, user.id])

  useEffect(() => {
    load()
  }, [load])

  const restart = () => {
    setIdx(0)
    setSelected(null)
    setRevealed(false)
    setScore(0)
    setDone(false)
    load()
  }

  const title = mode === 'wrong' ? '🔁 ทบทวนข้อที่ตอบผิด' : `🎯 ${category || 'ติวแยกหมวด'}`

  if (loading) return <Spinner label="กำลังเตรียมข้อสอบ…" />

  if (!questions.length) {
    return (
      <div className="px-4 pt-4">
        <Empty
          icon={mode === 'wrong' ? '🎉' : '🗂️'}
          title={mode === 'wrong' ? 'ไม่มีข้อผิดให้ทบทวนแล้ว!' : 'หมวดนี้ยังไม่มีข้อสอบ'}
          hint={mode === 'wrong' ? 'เก่งมาก ตอบถูกหมดเลย 👏' : 'ลองเลือกหมวดอื่น หรือรอแอดมินเพิ่มข้อสอบ'}
        />
        <Button variant="outline" className="mt-4 w-full" onClick={() => navigate('/practice')}>
          ↩ กลับศูนย์ฝึกซ้อม
        </Button>
      </div>
    )
  }

  if (done) {
    const p = Math.round((score / questions.length) * 100)
    return (
      <div className="mx-auto flex min-h-[80vh] max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="animate-float mb-3 text-6xl">{p >= 80 ? '🏆' : p >= 50 ? '💪' : '📚'}</div>
        <h1 className="text-2xl font-extrabold text-slate-800">ฝึกซ้อมเสร็จแล้ว!</h1>
        <p className="mt-2 text-slate-500">{title}</p>
        <div className="my-4 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-500 px-8 py-5 text-white shadow-lg shadow-emerald-300/50">
          <p className="text-4xl font-extrabold">
            {score}/{questions.length}
          </p>
          <p className="text-sm text-white/80">ตอบถูก {p}%</p>
        </div>
        <div className="flex w-full gap-2">
          <Button className="flex-1" onClick={restart}>
            🔁 ฝึกอีกครั้ง
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => navigate('/practice')}>
            ↩ กลับ
          </Button>
        </div>
      </div>
    )
  }

  const q = questions[idx]
  const choose = (key) => {
    if (revealed) return
    setSelected(key)
    setRevealed(true)
    if (key === q.correct_choice) setScore((s) => s + 1)
  }
  const next = () => {
    if (idx + 1 >= questions.length) {
      setDone(true)
      return
    }
    setIdx((i) => i + 1)
    setSelected(null)
    setRevealed(false)
  }

  const explImgs = Array.isArray(q.explanation_images) ? q.explanation_images : []

  return (
    <div className="flex min-h-screen flex-col px-4 pt-4">
      {/* แถบบน */}
      <div className="mb-3 flex items-center gap-3">
        <button
          onClick={() => navigate('/practice')}
          className="flex-shrink-0 rounded-xl bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-600"
        >
          ↩
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-700">{title}</p>
        </div>
        <Badge color="indigo">
          {idx + 1}/{questions.length}
        </Badge>
      </div>

      {/* progress */}
      <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all"
          style={{ width: `${((idx + (revealed ? 1 : 0)) / questions.length) * 100}%` }}
        />
      </div>

      <div key={q.question_id} className="animate-pop flex-1">
        {q.category && (
          <Badge color="indigo">🏷️ {q.category}</Badge>
        )}
        <h2 className="mb-3 mt-1 text-lg font-bold leading-relaxed text-slate-800">{q.question_text}</h2>

        {q.image_url && (
          <img
            src={q.image_url}
            alt="รูปประกอบคำถาม"
            className="mb-4 max-h-72 w-full rounded-2xl border border-violet-100 object-contain shadow-sm"
            loading="eager"
            decoding="async"
          />
        )}

        <div className="space-y-2.5">
          {(q.choices || []).map((c) => {
            const isCorrect = c.key === q.correct_choice
            const isPicked = c.key === selected
            let cls = 'border-violet-100 bg-white active:bg-violet-50'
            if (revealed) {
              if (isCorrect) cls = 'border-emerald-300 bg-emerald-50'
              else if (isPicked) cls = 'border-rose-300 bg-rose-50'
              else cls = 'border-slate-100 bg-white opacity-70'
            }
            return (
              <button
                key={c.key}
                onClick={() => choose(c.key)}
                disabled={revealed}
                className={`flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left transition ${cls}`}
              >
                <span
                  className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${
                    revealed && isCorrect
                      ? 'bg-emerald-500 text-white'
                      : revealed && isPicked
                        ? 'bg-rose-500 text-white'
                        : 'bg-violet-100 text-violet-500'
                  }`}
                >
                  {c.key}
                </span>
                <span className="text-sm text-slate-700">{c.text}</span>
                {revealed && isCorrect && <span className="ml-auto text-emerald-600">✓</span>}
                {revealed && isPicked && !isCorrect && <span className="ml-auto text-rose-500">✗</span>}
              </button>
            )
          })}
        </div>

        {/* เฉลย */}
        {revealed && (q.explanation || explImgs.length > 0) && (
          <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-3 text-sm">
            <p className="mb-0.5 text-xs font-bold text-violet-600">💡 คำอธิบาย / เฉลย</p>
            {q.explanation && (
              <p className="whitespace-pre-wrap leading-relaxed text-slate-700">{q.explanation}</p>
            )}
            {explImgs.length > 0 && (
              <div className="mt-2 space-y-2">
                {explImgs.map((url) => (
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

      {/* ปุ่มถัดไป */}
      <div className="sticky bottom-0 -mx-4 mt-3 border-t border-slate-100 bg-white/90 px-4 py-3 backdrop-blur">
        <Button className="w-full" disabled={!revealed} onClick={next}>
          {!revealed
            ? 'เลือกคำตอบก่อน'
            : idx + 1 >= questions.length
              ? '🎉 ดูผลฝึกซ้อม'
              : 'ถัดไป →'}
        </Button>
      </div>
    </div>
  )
}
