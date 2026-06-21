import { useEffect, useState, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store'
import { supabase } from '../lib/supabase'
import { Button, Card, Badge, Spinner, formatDuration } from '../components/ui'

const LETTERS = ['A', 'B', 'C', 'D', 'E']

function blankQuestion() {
  return {
    question_text: '',
    image_url: '',
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
        <div className="animate-float mb-4 text-center text-5xl">🛠️</div>
        <h1 className="mb-1 text-center text-lg font-bold text-slate-800">เข้าสู่ระบบแอดมิน</h1>
        <p className="mb-5 text-center text-sm text-slate-500">
          สำหรับเพิ่ม/แก้ไขข้อสอบ และตอบคำถามส่วนตัว
        </p>
        <form onSubmit={submit} className="space-y-3">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="อีเมลแอดมิน"
            className="w-full rounded-2xl border-2 border-violet-100 bg-white px-4 py-3 text-slate-800 outline-none transition focus:border-violet-400"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="รหัสผ่าน"
            className="w-full rounded-2xl border-2 border-violet-100 bg-white px-4 py-3 text-slate-800 outline-none transition focus:border-violet-400"
          />
          {err && <p className="text-sm font-medium text-rose-500">{err}</p>}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'กำลังเข้า…' : 'เข้าสู่ระบบ'}
          </Button>
        </form>
        <p className="mt-4 text-center text-xs text-slate-400">
          * สร้างบัญชีแอดมินที่ Supabase → Authentication → Add user
        </p>
      </div>
    </div>
  )
}

function QuestionEditor({ q, index, onChange, onRemove }) {
  const [uploading, setUploading] = useState(false)
  const [imgErr, setImgErr] = useState('')
  const setField = (patch) => onChange({ ...q, ...patch })
  const setChoice = (i, text) => {
    const choices = q.choices.map((c, ci) => (ci === i ? { ...c, text } : c))
    setField({ choices })
  }

  const onPickImage = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // ให้เลือกไฟล์เดิมซ้ำได้
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setImgErr('ไฟล์ต้องเป็นรูปภาพ')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setImgErr('รูปต้องไม่เกิน 5MB')
      return
    }
    setImgErr('')
    setUploading(true)
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const path = `q/${crypto.randomUUID()}.${ext}`
      const { error } = await supabase.storage
        .from('question-images')
        .upload(path, file, { contentType: file.type, upsert: false })
      if (error) throw error
      const { data } = supabase.storage.from('question-images').getPublicUrl(path)
      setField({ image_url: data.publicUrl })
    } catch (err) {
      setImgErr('อัปโหลดไม่สำเร็จ: ' + (err.message || 'ลองใหม่อีกครั้ง'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-violet-600">ข้อ {index + 1}</span>
        <button onClick={onRemove} className="text-xs font-semibold text-rose-500 hover:underline">
          ลบข้อนี้
        </button>
      </div>
      <textarea
        value={q.question_text}
        onChange={(e) => setField({ question_text: e.target.value })}
        rows={2}
        placeholder="โจทย์คำถาม…"
        className="w-full resize-none rounded-xl border-2 border-violet-100 bg-white p-2.5 text-sm text-slate-800 outline-none transition focus:border-violet-400"
      />

      {/* รูปประกอบคำถาม (ไม่บังคับ) */}
      {q.image_url ? (
        <div className="relative">
          <img
            src={q.image_url}
            alt="รูปประกอบคำถาม"
            className="max-h-56 w-full rounded-xl border border-violet-100 object-contain"
          />
          <button
            type="button"
            onClick={() => setField({ image_url: '' })}
            className="absolute right-2 top-2 rounded-full bg-rose-500 px-2.5 py-1 text-xs font-bold text-white shadow-md"
          >
            ✕ ลบรูป
          </button>
        </div>
      ) : (
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-violet-200 py-3 text-sm font-semibold text-violet-500 hover:bg-violet-50">
          {uploading ? '⏳ กำลังอัปโหลด…' : '🖼️ เพิ่มรูปประกอบ (ไม่บังคับ)'}
          <input
            type="file"
            accept="image/*"
            onChange={onPickImage}
            disabled={uploading}
            className="hidden"
          />
        </label>
      )}
      {imgErr && <p className="text-xs font-medium text-rose-500">{imgErr}</p>}
      <div className="space-y-2">
        {q.choices.map((c, i) => (
          <div key={c.key} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setField({ correct_choice: c.key })}
              className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold transition ${
                q.correct_choice === c.key
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200'
                  : 'bg-violet-100 text-violet-500'
              }`}
              title="แตะเพื่อตั้งเป็นคำตอบที่ถูก"
            >
              {c.key}
            </button>
            <input
              value={c.text}
              onChange={(e) => setChoice(i, e.target.value)}
              placeholder={`ตัวเลือก ${c.key}`}
              className="flex-1 rounded-xl border-2 border-violet-100 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-violet-400"
            />
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500">
        ✅ คำตอบที่ถูก: <b className="text-emerald-600">{q.correct_choice}</b> (แตะวงกลมตัวอักษรเพื่อเปลี่ยน)
      </p>
      <textarea
        value={q.explanation}
        onChange={(e) => setField({ explanation: e.target.value })}
        rows={2}
        placeholder="คำอธิบาย/เฉลย (แสดงหลังผู้ใช้ทำเสร็จ)…"
        className="w-full resize-none rounded-xl border-2 border-violet-100 bg-white p-2.5 text-sm text-slate-800 outline-none transition focus:border-violet-400"
      />
    </Card>
  )
}

// ตั้งค่าข้อความให้กำลังใจที่แสดงหลังผู้ใช้ทำข้อสอบเสร็จ
const ENCOURAGE_KEY = 'finish_message'
const ENCOURAGE_PLACEHOLDER =
  'เช่น: เก่งมากที่ตั้งใจทำจนจบ! ทุกข้อที่ลองคือก้าวที่โตขึ้น ✨ พรุ่งนี้ลุยต่อกันนะ 💪'

function EncourageSetting() {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', ENCOURAGE_KEY)
        .maybeSingle()
      setText(data?.value ?? '')
      setLoading(false)
    })()
  }, [])

  const save = async () => {
    setSaving(true)
    setMsg('')
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: ENCOURAGE_KEY, value: text.trim(), updated_at: new Date().toISOString() })
    setMsg(error ? '❌ ' + error.message : '✅ บันทึกข้อความแล้ว')
    setSaving(false)
  }

  if (loading)
    return (
      <Card>
        <Spinner label="กำลังโหลด…" />
      </Card>
    )

  return (
    <Card className="space-y-2">
      <p className="text-xs text-slate-500">
        ข้อความนี้จะแสดงให้กำลังใจหลังผู้ใช้ทำข้อสอบเสร็จและเห็นคะแนน (ทุกชุด) — เว้นว่างไว้ถ้าไม่ต้องการ
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder={ENCOURAGE_PLACEHOLDER}
        className="w-full resize-none rounded-xl border-2 border-violet-100 bg-white p-2.5 text-sm text-slate-800 outline-none transition focus:border-violet-400"
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={saving} className="px-4 py-2 text-sm">
          {saving ? 'กำลังบันทึก…' : '💾 บันทึกข้อความ'}
        </Button>
        {msg && (
          <span className={`text-xs font-semibold ${msg.startsWith('✅') ? 'text-emerald-600' : 'text-rose-500'}`}>
            {msg}
          </span>
        )}
      </div>
    </Card>
  )
}

// ผลตรวจสำหรับแอดมิน — เลือกชุด แล้วดูคำตอบ + เหตุผลของผู้ใช้ทุกคน
function ExamResults({ sets }) {
  const [setId, setSetId] = useState('')
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [items, setItems] = useState([])
  const [openId, setOpenId] = useState(null)

  const load = async (id) => {
    setSetId(id)
    setItems([])
    setOpenId(null)
    setLoaded(false)
    if (!id) return
    setLoading(true)
    const { data } = await supabase.rpc('get_exam_results', { p_exam_set_id: id })
    setItems(data?.items || [])
    setLoading(false)
    setLoaded(true)
  }

  return (
    <Card className="space-y-3">
      <select
        value={setId}
        onChange={(e) => load(e.target.value)}
        className="w-full rounded-xl border-2 border-violet-100 bg-white px-3 py-2 text-slate-800 outline-none transition focus:border-violet-400"
      >
        <option value="">— เลือกชุดเพื่อดูผลตรวจ —</option>
        {sets.map((s) => (
          <option key={s.id} value={s.id}>
            วันที่ {s.day_number} · {s.title || 'ชุดข้อสอบ'} ({s.question_count} ข้อ)
          </option>
        ))}
      </select>

      {loading && <Spinner label="กำลังโหลดผลตรวจ…" />}
      {loaded && !loading && items.length === 0 && (
        <p className="py-4 text-center text-sm text-slate-400">ยังไม่มีใครทำชุดนี้</p>
      )}

      {items.length > 0 && (
        <p className="text-xs text-slate-400">มีผู้ทำทั้งหมด {items.length} ครั้ง — แตะชื่อเพื่อดูคำตอบและเหตุผล</p>
      )}

      <div className="space-y-2">
        {items.map((a) => {
          const open = openId === a.attempt_id
          return (
            <div key={a.attempt_id} className="overflow-hidden rounded-xl border border-violet-100 bg-white">
              <button
                onClick={() => setOpenId(open ? null : a.attempt_id)}
                className="flex w-full items-center justify-between gap-2 p-3 text-left"
              >
                <div className="min-w-0">
                  <p className="truncate font-bold text-slate-800">{a.username}</p>
                  <p className="text-xs text-slate-400">
                    {new Date(a.created_at).toLocaleString('th-TH')}
                  </p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  {a.duration_seconds > 0 && (
                    <span className="text-xs text-slate-400 tabular-nums">
                      ⏱ {formatDuration(a.duration_seconds)}
                    </span>
                  )}
                  <Badge color={a.score === a.total ? 'green' : 'amber'}>
                    {a.score}/{a.total}
                  </Badge>
                  <span className="text-xs text-slate-300">{open ? '▲' : '▼'}</span>
                </div>
              </button>

              {open && (
                <div className="space-y-2 border-t border-violet-100 bg-violet-50/40 p-3">
                  {(a.answers || []).map((ans) => (
                    <div key={ans.order_index} className="rounded-lg bg-white p-2.5 text-sm shadow-sm">
                      <p className="font-semibold text-slate-700">
                        ข้อ {ans.order_index + 1}. {ans.question_text}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        ตอบ:{' '}
                        <b className={ans.is_correct ? 'text-emerald-600' : 'text-rose-600'}>
                          {ans.selected_choice || '—'}
                        </b>{' '}
                        · เฉลย: <b className="text-emerald-600">{ans.correct_choice}</b>{' '}
                        {ans.is_correct ? '✅' : '❌'}
                      </p>
                      {ans.reason ? (
                        <p className="mt-1.5 rounded-md bg-violet-50 p-2 text-xs leading-relaxed text-slate-600">
                          <b className="text-violet-600">💭 เหตุผล:</b> {ans.reason}
                        </p>
                      ) : (
                        <p className="mt-1.5 text-xs italic text-slate-400">— ไม่ได้ให้เหตุผล —</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}

export default function Admin() {
  const { isAdmin, adminEmail, adminSignOut } = useStore()
  const [sets, setSets] = useState([])
  const [users, setUsers] = useState([])
  const [privateCount, setPrivateCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const [targetSetId, setTargetSetId] = useState('') // '' = สร้างชุดใหม่, ไม่งั้น = id ชุดเดิม
  const [dayNumber, setDayNumber] = useState(1)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
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
    const [{ data: setsData }, { count }, { data: usersData }] = await Promise.all([
      supabase
        .from('exam_sets')
        .select('id, day_number, title, category, published, question_count, created_at')
        .order('day_number', { ascending: true }),
      supabase
        .from('qa_threads')
        .select('id', { count: 'exact', head: true })
        .eq('is_public', false),
      supabase
        .from('profiles')
        .select('id, username, suspended, created_at')
        .order('created_at', { ascending: true }),
    ])
    setSets(setsData || [])
    setPrivateCount(count || 0)
    setUsers(usersData || [])
    setDayNumber(((setsData || []).reduce((m, s) => Math.max(m, s.day_number), 0) || 0) + 1)
    setLoading(false)
  }, [])

  const toggleSuspend = async (u) => {
    const action = u.suspended ? 'ปลดระงับ' : 'ระงับ'
    if (!confirm(`${action}ผู้ใช้ "${u.username}"?`)) return
    await supabase.from('profiles').update({ suspended: !u.suspended }).eq('id', u.id)
    load()
  }

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
        image_url: q.image_url || '',
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
          p_category: category.trim(),
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
      <header className="mb-4 flex items-center justify-between rounded-3xl bg-gradient-to-r from-violet-500 to-indigo-500 p-4 text-white shadow-lg shadow-violet-300/50">
        <div className="min-w-0">
          <h1 className="text-lg font-extrabold">🛠️ แผงแอดมิน</h1>
          <p className="truncate text-xs text-white/80">{adminEmail}</p>
        </div>
        <button
          onClick={adminSignOut}
          className="flex-shrink-0 rounded-xl bg-white/20 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/30"
        >
          ออกจากแอดมิน
        </button>
      </header>

      {/* คำถามส่วนตัว */}
      <Link to="/qa" className="mb-4 block">
        <Card className="flex items-center justify-between">
          <div>
            <p className="font-bold text-slate-800">📨 คำถามส่วนตัวถึงแอดมิน</p>
            <p className="text-xs text-slate-400">แตะเพื่อไปตอบในแท็บถาม-ตอบ → ส่วนตัว</p>
          </div>
          <Badge color={privateCount ? 'red' : 'slate'}>{privateCount}</Badge>
        </Card>
      </Link>

      {/* ข้อความให้กำลังใจหลังทำข้อสอบ */}
      <h2 className="mb-2 text-base font-bold text-slate-700">💛 ข้อความให้กำลังใจหลังทำข้อสอบ</h2>
      <div className="mb-4">
        <EncourageSetting />
      </div>

      {/* เพิ่มข้อสอบ */}
      <h2 ref={formRef} className="mb-2 scroll-mt-4 text-base font-bold text-slate-700">
        {isNewSet ? '➕ เพิ่มชุดข้อสอบ' : '➕ เพิ่มคำถามเข้าชุดเดิม'}
      </h2>
      <Card className="mb-3 space-y-3">
        {/* เลือกปลายทาง: ชุดใหม่ หรือชุดเดิม */}
        <div>
          <label className="text-xs font-medium text-slate-500">เพิ่มคำถามไปไว้ที่</label>
          <select
            value={targetSetId}
            onChange={(e) => pickTarget(e.target.value)}
            className="w-full rounded-xl border-2 border-violet-100 bg-white px-3 py-2 text-slate-800 outline-none transition focus:border-violet-400"
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
                <label className="text-xs font-medium text-slate-500">วันที่</label>
                <input
                  type="number"
                  min={1}
                  value={dayNumber}
                  onChange={(e) => setDayNumber(e.target.value)}
                  className="w-full rounded-xl border-2 border-violet-100 bg-white px-3 py-2 text-slate-800 outline-none transition focus:border-violet-400"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium text-slate-500">ชื่อชุด</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={`ชุดข้อสอบวันที่ ${dayNumber}`}
                  className="w-full rounded-xl border-2 border-violet-100 bg-white px-3 py-2 text-slate-800 outline-none transition focus:border-violet-400"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">
                หมวด (สำหรับจัดกลุ่มในคลังข้อสอบ)
              </label>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                list="category-list"
                placeholder="เช่น คณิตศาสตร์, กายวิภาค, ทั่วไป…"
                className="w-full rounded-xl border-2 border-violet-100 bg-white px-3 py-2 text-slate-800 outline-none transition focus:border-violet-400"
              />
              <datalist id="category-list">
                {[...new Set(sets.map((s) => s.category).filter(Boolean))].map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <input
                type="checkbox"
                checked={publish}
                onChange={(e) => setPublish(e.target.checked)}
                className="h-4 w-4 accent-violet-500"
              />
              เผยแพร่ทันที (ผู้ใช้เห็น + แจ้งเตือนข้อสอบใหม่)
            </label>
          </>
        )}
        {!isNewSet && (
          <p className="rounded-xl bg-violet-50 p-2.5 text-xs text-violet-700">
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
        className="mt-3 w-full rounded-2xl border-2 border-dashed border-violet-200 py-3 text-sm font-semibold text-violet-500 hover:bg-violet-50"
      >
        + เพิ่มคำถาม
      </button>

      {msg && (
        <p
          className={`mt-3 text-sm font-semibold ${
            msg.startsWith('✅') ? 'text-emerald-600' : 'text-rose-500'
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
      <h2 className="mb-2 mt-6 text-base font-bold text-slate-700">📚 ชุดข้อสอบที่มีอยู่</h2>
      {sets.length === 0 ? (
        <p className="text-sm text-slate-400">ยังไม่มีชุดข้อสอบ</p>
      ) : (
        <div className="space-y-2">
          {sets.map((s) => (
            <Card key={s.id} className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="truncate font-bold text-slate-800">
                  วันที่ {s.day_number} · {s.title}
                </p>
                <p className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                  {s.category && <Badge color="indigo">{s.category}</Badge>}
                  <span>
                    {s.question_count} ข้อ ·{' '}
                    {s.published ? (
                      <span className="font-semibold text-emerald-600">เผยแพร่แล้ว</span>
                    ) : (
                      <span className="font-semibold text-amber-600">ฉบับร่าง</span>
                    )}
                  </span>
                </p>
              </div>
              <div className="flex flex-shrink-0 gap-1">
                <button
                  onClick={() => pickTarget(s.id)}
                  className="rounded-lg bg-violet-100 px-2 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-200"
                  title="เพิ่มคำถามเข้าชุดนี้"
                >
                  + เพิ่มข้อ
                </button>
                <button
                  onClick={() => togglePublish(s)}
                  className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200"
                >
                  {s.published ? 'ซ่อน' : 'เผยแพร่'}
                </button>
                <button
                  onClick={() => removeSet(s)}
                  className="rounded-lg bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-200"
                >
                  ลบ
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ผลตรวจ + เหตุผลผู้ตอบ */}
      <h2 className="mb-2 mt-6 text-base font-bold text-slate-700">📊 ผลตรวจ &amp; เหตุผลผู้ตอบ</h2>
      <ExamResults sets={sets} />

      {/* จัดการผู้ใช้ */}
      <h2 className="mb-2 mt-6 text-base font-bold text-slate-700">
        👥 ผู้ใช้ ({users.length})
      </h2>
      {users.length === 0 ? (
        <p className="text-sm text-slate-400">ยังไม่มีผู้ใช้</p>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <Card key={u.id} className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="truncate font-bold text-slate-800">
                  {u.username}{' '}
                  {u.suspended && <Badge color="red">ถูกระงับ</Badge>}
                </p>
                <p className="text-xs text-slate-400">
                  เข้าร่วม {new Date(u.created_at).toLocaleDateString('th-TH')}
                </p>
              </div>
              <button
                onClick={() => toggleSuspend(u)}
                className={`flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  u.suspended
                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                    : 'bg-rose-100 text-rose-600 hover:bg-rose-200'
                }`}
              >
                {u.suspended ? 'ปลดระงับ' : '🚫 ระงับ'}
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
