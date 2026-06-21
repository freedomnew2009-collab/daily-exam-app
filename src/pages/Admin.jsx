import { useEffect, useState, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store'
import { supabase } from '../lib/supabase'
import { Button, Card, Badge, Spinner } from '../components/ui'

const LETTERS = ['A', 'B', 'C', 'D', 'E']

function blankQuestion() {
  return {
    question_text: '',
    choices: LETTERS.map((k) => ({ key: k, text: '' })),
    correct_choice: 'A',
    explanation: '',
  }
}

function AdminLogin() {
  const { adminSignIn } = useStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      await adminSignIn(email.trim(), password)
    } catch (e2) {
      setErr(e2.message || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="px-4 pt-8">
      <div className="mx-auto max-w-sm">
        <div className="mb-4 text-center text-5xl">🛠️</div>
        <h1 className="mb-1 text-center text-lg font-bold text-white">เข้าสู่ระบบแอดมิน</h1>
        <p className="mb-5 text-center text-sm text-slate-400">
          สำหรับเพิ่ม/แก้ไขข้อสอบ และตอบคำถามส่วนตัว
        </p>
        <form onSubmit={submit} className="space-y-3">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="อีเมลแอดมิน"
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-indigo-500"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="รหัสผ่าน"
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-indigo-500"
          />
          {err && <p className="text-sm text-rose-400">{err}</p>}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'กำลังเข้า…' : 'เข้าสู่ระบบ'}
          </Button>
        </form>
        <p className="mt-4 text-center text-xs text-slate-500">
          * สร้างบัญชีแอดมินที่ Supabase → Authentication → Add user
        </p>
      </div>
    </div>
  )
}

function QuestionEditor({ q, index, onChange, onRemove }) {
  const setField = (patch) => onChange({ ...q, ...patch })
  const setChoice = (i, text) => {
    const choices = q.choices.map((c, ci) => (ci === i ? { ...c, text } : c))
    setField({ choices })
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-indigo-300">ข้อ {index + 1}</span>
        <button onClick={onRemove} className="text-xs text-rose-400 hover:underline">
          ลบข้อนี้
        </button>
      </div>
      <textarea
        value={q.question_text}
        onChange={(e) => setField({ question_text: e.target.value })}
        rows={2}
        placeholder="โจทย์คำถาม…"
        className="w-full resize-none rounded-lg border border-slate-700 bg-slate-900 p-2 text-sm text-white outline-none focus:border-indigo-500"
      />
      <div className="space-y-2">
        {q.choices.map((c, i) => (
          <div key={c.key} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setField({ correct_choice: c.key })}
              className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold transition ${
                q.correct_choice === c.key
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-700 text-slate-300'
              }`}
              title="แตะเพื่อตั้งเป็นคำตอบที่ถูก"
            >
              {c.key}
            </button>
            <input
              value={c.text}
              onChange={(e) => setChoice(i, e.target.value)}
              placeholder={`ตัวเลือก ${c.key}`}
              className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
            />
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500">
        ✅ คำตอบที่ถูก: <b className="text-emerald-400">{q.correct_choice}</b> (แตะวงกลมตัวอักษรเพื่อเปลี่ยน)
      </p>
      <textarea
        value={q.explanation}
        onChange={(e) => setField({ explanation: e.target.value })}
        rows={2}
        placeholder="คำอธิบาย/เฉลย (แสดงหลังผู้ใช้ทำเสร็จ)…"
        className="w-full resize-none rounded-lg border border-slate-700 bg-slate-900 p-2 text-sm text-white outline-none focus:border-indigo-500"
      />
    </Card>
  )
}

export default function Admin() {
  const { isAdmin, adminEmail, adminSignOut } = useStore()
  const [sets, setSets] = useState([])
  const [privateCount, setPrivateCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const [targetSetId, setTargetSetId] = useState('') // '' = สร้างชุดใหม่, ไม่งั้น = id ชุดเดิม
  const [dayNumber, setDayNumber] = useState(1)
  const [title, setTitle] = useState('')
  const [publish, setPublish] = useState(true)
  const [questions, setQuestions] = useState(() =>
    Array.from({ length: 5 }, blankQuestion)
  )
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const formRef = useRef(null)

  const isNewSet = targetSetId === ''

  // เลือกเพิ่มเข้าชุดเดิม -> เตรียมฟอร์มแบบ "ทีละข้อ" แล้วเลื่อนขึ้นไปที่ฟอร์ม
  const pickTarget = (setId) => {
    setTargetSetId(setId)
    setMsg('')
    if (setId !== '') setQuestions([blankQuestion()])
    else setQuestions(Array.from({ length: 5 }, blankQuestion))
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: setsData }, { count }] = await Promise.all([
      supabase
        .from('exam_sets')
        .select('id, day_number, title, published, question_count, created_at')
        .order('day_number', { ascending: true }),
      supabase
        .from('qa_threads')
        .select('id', { count: 'exact', head: true })
        .eq('is_public', false),
    ])
    setSets(setsData || [])
    setPrivateCount(count || 0)
    setDayNumber(((setsData || []).reduce((m, s) => Math.max(m, s.day_number), 0) || 0) + 1)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (isAdmin) load()
  }, [isAdmin, load])

  if (!isAdmin) return <AdminLogin />
  if (loading) return <Spinner />

  const updateQ = (i, val) => setQuestions((qs) => qs.map((q, qi) => (qi === i ? val : q)))
  const removeQ = (i) => setQuestions((qs) => qs.filter((_, qi) => qi !== i))
  const addQ = () => setQuestions((qs) => [...qs, blankQuestion()])

  const validate = () => {
    if (questions.length === 0) return 'ต้องมีอย่างน้อย 1 ข้อ'
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      if (!q.question_text.trim()) return `ข้อ ${i + 1}: ยังไม่ได้ใส่โจทย์`
      const filled = q.choices.filter((c) => c.text.trim()).length
      if (filled < 2) return `ข้อ ${i + 1}: ต้องมีตัวเลือกอย่างน้อย 2 ข้อ`
      if (!q.choices.find((c) => c.key === q.correct_choice)?.text.trim())
        return `ข้อ ${i + 1}: ตัวเลือกที่ตั้งเป็นคำตอบถูกยังว่าง`
    }
    return null
  }

  const save = async () => {
    setMsg('')
    const v = validate()
    if (v) {
      setMsg('⚠️ ' + v)
      return
    }
    setSaving(true)
    try {
      const payload = questions.map((q) => ({
        question_text: q.question_text.trim(),
        choices: q.choices.filter((c) => c.text.trim()),
        correct_choice: q.correct_choice,
        explanation: q.explanation.trim(),
      }))

      if (isNewSet) {
        const { error } = await supabase.rpc('create_exam_set', {
          p_day: Number(dayNumber),
          p_title: title.trim() || `ชุดข้อสอบวันที่ ${dayNumber}`,
          p_published: publish,
          p_questions: payload,
        })
        if (error) throw error
        setMsg('✅ บันทึกชุดข้อสอบใหม่เรียบร้อย' + (publish ? ' และเผยแพร่แล้ว' : ' (ฉบับร่าง)'))
        setTitle('')
        setQuestions(Array.from({ length: 5 }, blankQuestion))
      } else {
        // เพิ่มทีละข้อเข้าไปในชุดเดิม (ทีละข้อใน payload)
        for (const q of payload) {
          const { error } = await supabase.rpc('add_question', {
            p_exam_set_id: targetSetId,
            p_question: q,
          })
          if (error) throw error
        }
        const tgt = sets.find((s) => s.id === targetSetId)
        setMsg(
          `✅ เพิ่ม ${payload.length} ข้อเข้า "วันที่ ${tgt?.day_number} · ${tgt?.title || ''}" แล้ว`
        )
        setQuestions([blankQuestion()]) // พร้อมพิมพ์ข้อถัดไปทันที
      }
      await load()
    } catch (e) {
      setMsg('❌ ' + (e.message || 'บันทึกไม่สำเร็จ'))
    } finally {
      setSaving(false)
    }
  }

  const togglePublish = async (s) => {
    await supabase.from('exam_sets').update({ published: !s.published }).eq('id', s.id)
    load()
  }

  const removeSet = async (s) => {
    if (!confirm(`ลบชุด "วันที่ ${s.day_number}" และคำถามทั้งหมด?`)) return
    await supabase.from('exam_sets').delete().eq('id', s.id)
    load()
  }

  return (
    <div className="px-4 pt-4 pb-6">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">แผงแอดมิน</h1>
          <p className="text-xs text-slate-400">{adminEmail}</p>
        </div>
        <button onClick={adminSignOut} className="text-sm text-slate-400 underline">
          ออกจากแอดมิน
        </button>
      </header>

      {/* คำถามส่วนตัว */}
      <Link to="/qa" className="mb-4 block">
        <Card className="flex items-center justify-between">
          <div>
            <p className="font-medium text-white">📨 คำถามส่วนตัวถึงแอดมิน</p>
            <p className="text-xs text-slate-400">แตะเพื่อไปตอบในแท็บถาม-ตอบ → ส่วนตัว</p>
          </div>
          <Badge color={privateCount ? 'red' : 'slate'}>{privateCount}</Badge>
        </Card>
      </Link>

      {/* เพิ่มข้อสอบ */}
      <h2 ref={formRef} className="mb-2 scroll-mt-4 text-base font-semibold text-slate-200">
        {isNewSet ? '➕ เพิ่มชุดข้อสอบ' : '➕ เพิ่มคำถามเข้าชุดเดิม'}
      </h2>
      <Card className="mb-3 space-y-3">
        {/* เลือกปลายทาง: ชุดใหม่ หรือชุดเดิม */}
        <div>
          <label className="text-xs text-slate-400">เพิ่มคำถามไปไว้ที่</label>
          <select
            value={targetSetId}
            onChange={(e) => pickTarget(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-indigo-500"
          >
            <option value="">➕ สร้างชุดใหม่</option>
            {sets.map((s) => (
              <option key={s.id} value={s.id}>
                วันที่ {s.day_number} · {s.title || 'ชุดข้อสอบ'} ({s.question_count} ข้อ)
              </option>
            ))}
          </select>
        </div>

        {/* ฟิลด์ของชุดใหม่ (โชว์เฉพาะตอนสร้างชุดใหม่) */}
        {isNewSet && (
          <>
            <div className="flex gap-2">
              <div className="w-24">
                <label className="text-xs text-slate-400">วันที่</label>
                <input
                  type="number"
                  min={1}
                  value={dayNumber}
                  onChange={(e) => setDayNumber(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-slate-400">ชื่อชุด</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={`ชุดข้อสอบวันที่ ${dayNumber}`}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-indigo-500"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={publish}
                onChange={(e) => setPublish(e.target.checked)}
                className="h-4 w-4 accent-indigo-500"
              />
              เผยแพร่ทันที (ผู้ใช้เห็น + แจ้งเตือนข้อสอบใหม่)
            </label>
          </>
        )}
        {!isNewSet && (
          <p className="rounded-lg bg-slate-800/60 p-2 text-xs text-slate-300">
            กำลังเพิ่มคำถามต่อท้ายชุดที่เลือก — เพิ่มทีละข้อ หรือหลายข้อก็ได้ บันทึกแล้วฟอร์มจะพร้อมให้พิมพ์ข้อถัดไปทันที
          </p>
        )}
      </Card>

      <div className="space-y-3">
        {questions.map((q, i) => (
          <QuestionEditor
            key={i}
            q={q}
            index={i}
            onChange={(val) => updateQ(i, val)}
            onRemove={() => removeQ(i)}
          />
        ))}
      </div>

      <button
        onClick={addQ}
        className="mt-3 w-full rounded-xl border border-dashed border-slate-700 py-3 text-sm text-slate-400 hover:bg-slate-800"
      >
        + เพิ่มคำถาม
      </button>

      {msg && (
        <p
          className={`mt-3 text-sm ${
            msg.startsWith('✅') ? 'text-emerald-400' : 'text-rose-400'
          }`}
        >
          {msg}
        </p>
      )}

      <Button onClick={save} disabled={saving} className="mt-3 w-full">
        {saving
          ? 'กำลังบันทึก…'
          : isNewSet
            ? '💾 บันทึกชุดข้อสอบใหม่'
            : `💾 เพิ่ม ${questions.length} ข้อเข้าชุดนี้`}
      </Button>

      {/* ชุดที่มีอยู่ */}
      <h2 className="mb-2 mt-6 text-base font-semibold text-slate-200">📚 ชุดข้อสอบที่มีอยู่</h2>
      {sets.length === 0 ? (
        <p className="text-sm text-slate-500">ยังไม่มีชุดข้อสอบ</p>
      ) : (
        <div className="space-y-2">
          {sets.map((s) => (
            <Card key={s.id} className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="truncate font-medium text-white">
                  วันที่ {s.day_number} · {s.title}
                </p>
                <p className="text-xs text-slate-400">
                  {s.question_count} ข้อ ·{' '}
                  {s.published ? (
                    <span className="text-emerald-400">เผยแพร่แล้ว</span>
                  ) : (
                    <span className="text-amber-400">ฉบับร่าง</span>
                  )}
                </p>
              </div>
              <div className="flex flex-shrink-0 gap-1">
                <button
                  onClick={() => pickTarget(s.id)}
                  className="rounded-lg bg-indigo-600/30 px-2 py-1 text-xs text-indigo-200"
                  title="เพิ่มคำถามเข้าชุดนี้"
                >
                  + เพิ่มข้อ
                </button>
                <button
                  onClick={() => togglePublish(s)}
                  className="rounded-lg bg-slate-800 px-2 py-1 text-xs text-slate-200"
                >
                  {s.published ? 'ซ่อน' : 'เผยแพร่'}
                </button>
                <button
                  onClick={() => removeSet(s)}
                  className="rounded-lg bg-rose-900/40 px-2 py-1 text-xs text-rose-300"
                >
                  ลบ
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
