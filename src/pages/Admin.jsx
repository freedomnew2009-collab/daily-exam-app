import { useEffect, useState, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store'
import { supabase } from '../lib/supabase'
import { compressImage } from '../lib/image'
import { Button, Card, Badge, Spinner, AutoTextarea, BigTextField, formatDuration } from '../components/ui'
import { Q_TYPES, fillAccepts } from '../lib/questions'

const LETTERS = ['A', 'B', 'C', 'D', 'E']

function blankQuestion() {
  return {
    question_text: '',
    image_url: '',
    category: '',
    q_type: 'mc',
    choices: LETTERS.map((k) => ({ key: k, text: '' })),
    correct_choice: 'A',
    accepts: [''], // เติมคำ: คำตอบที่ยอมรับได้ (หลายคำได้)
    pairs: [
      { left: '', right: '' },
      { left: '', right: '' },
      { left: '', right: '' },
    ], // จับคู่: คู่ซ้าย-ขวา
    explanation: '',
    explanation_images: [],
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

function QuestionEditor({ q, index, onChange, onRemove, categories = [] }) {
  const [uploading, setUploading] = useState(false)
  const [explUploading, setExplUploading] = useState(false)
  const [imgErr, setImgErr] = useState('')
  const setField = (patch) => onChange({ ...q, ...patch })
  const setChoice = (i, text) => {
    const choices = q.choices.map((c, ci) => (ci === i ? { ...c, text } : c))
    setField({ choices })
  }
  const qType = q.q_type || 'mc'
  // เติมคำ
  const accepts = Array.isArray(q.accepts) && q.accepts.length ? q.accepts : ['']
  const setAccept = (i, text) => setField({ accepts: accepts.map((a, ai) => (ai === i ? text : a)) })
  const addAccept = () => setField({ accepts: [...accepts, ''] })
  const removeAccept = (i) => setField({ accepts: accepts.filter((_, ai) => ai !== i) })
  // จับคู่
  const pairs = Array.isArray(q.pairs) && q.pairs.length ? q.pairs : [{ left: '', right: '' }]
  const setPair = (i, patch) => setField({ pairs: pairs.map((p, pi) => (pi === i ? { ...p, ...patch } : p)) })
  const addPair = () => setField({ pairs: [...pairs, { left: '', right: '' }] })
  const removePair = (i) => setField({ pairs: pairs.filter((_, pi) => pi !== i) })

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
      const up = await compressImage(file)
      const ext = (up.name.split('.').pop() || 'jpg').toLowerCase()
      const path = `q/${crypto.randomUUID()}.${ext}`
      const { error } = await supabase.storage
        .from('question-images')
        .upload(path, up, { contentType: up.type, upsert: false })
      if (error) throw error
      const { data } = supabase.storage.from('question-images').getPublicUrl(path)
      setField({ image_url: data.publicUrl })
    } catch (err) {
      setImgErr('อัปโหลดไม่สำเร็จ: ' + (err.message || 'ลองใหม่อีกครั้ง'))
    } finally {
      setUploading(false)
    }
  }

  // รูปประกอบคำอธิบาย/เฉลย (ใส่ได้หลายรูป)
  const explImages = Array.isArray(q.explanation_images) ? q.explanation_images : []
  const onPickExplImages = async (e) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (!files.length) return
    setImgErr('')
    setExplUploading(true)
    try {
      const urls = []
      for (const file of files) {
        if (!file.type.startsWith('image/')) continue
        if (file.size > 5 * 1024 * 1024) {
          setImgErr('ข้ามรูปที่ใหญ่เกิน 5MB บางรูป')
          continue
        }
        const up = await compressImage(file)
        const ext = (up.name.split('.').pop() || 'jpg').toLowerCase()
        const path = `expl/${crypto.randomUUID()}.${ext}`
        const { error } = await supabase.storage
          .from('question-images')
          .upload(path, up, { contentType: up.type, upsert: false })
        if (error) throw error
        const { data } = supabase.storage.from('question-images').getPublicUrl(path)
        urls.push(data.publicUrl)
      }
      setField({ explanation_images: [...explImages, ...urls] })
    } catch (err) {
      setImgErr('อัปโหลดไม่สำเร็จ: ' + (err.message || 'ลองใหม่อีกครั้ง'))
    } finally {
      setExplUploading(false)
    }
  }
  const removeExplImage = (url) =>
    setField({ explanation_images: explImages.filter((u) => u !== url) })

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-violet-600">ข้อ {index + 1}</span>
        <button onClick={onRemove} className="text-xs font-semibold text-rose-500 hover:underline">
          ลบข้อนี้
        </button>
      </div>

      {/* ชนิดข้อสอบ */}
      <div className="flex flex-wrap gap-1.5">
        {Q_TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setField({ q_type: t.value })}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              qType === t.value
                ? 'bg-violet-500 text-white shadow-sm'
                : 'bg-violet-50 text-violet-500 hover:bg-violet-100'
            }`}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      <AutoTextarea
        value={q.question_text}
        onChange={(e) => setField({ question_text: e.target.value })}
        minRows={2}
        placeholder="โจทย์คำถาม…"
        className="w-full resize-none rounded-xl border-2 border-violet-100 bg-white p-2.5 text-sm text-slate-800 outline-none transition focus:border-violet-400"
      />

      {/* หมวดของข้อนี้ (เลือกจากที่ตั้งไว้) */}
      <div className="flex items-center gap-2">
        <span className="flex-shrink-0 text-xs font-medium text-slate-500">🏷️ หมวด</span>
        <select
          value={q.category || ''}
          onChange={(e) => setField({ category: e.target.value })}
          className="min-w-0 flex-1 rounded-xl border-2 border-violet-100 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-violet-400"
        >
          <option value="">— ไม่ระบุหมวด —</option>
          {q.category && !categories.includes(q.category) && (
            <option value={q.category}>{q.category}</option>
          )}
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

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

      {/* ===== ปรนัย ===== */}
      {qType === 'mc' && (
        <>
          <div className="space-y-2">
            {q.choices.map((c, i) => (
              <div key={c.key} className="flex items-start gap-2">
                <button
                  type="button"
                  onClick={() => setField({ correct_choice: c.key })}
                  className={`mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold transition ${
                    q.correct_choice === c.key
                      ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200'
                      : 'bg-violet-100 text-violet-500'
                  }`}
                  title="แตะเพื่อตั้งเป็นคำตอบที่ถูก"
                >
                  {c.key}
                </button>
                <AutoTextarea
                  value={c.text}
                  minRows={1}
                  onChange={(e) => setChoice(i, e.target.value)}
                  placeholder={`ตัวเลือก ${c.key}`}
                  className="flex-1 resize-none rounded-xl border-2 border-violet-100 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-violet-400"
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            ✅ คำตอบที่ถูก: <b className="text-emerald-600">{q.correct_choice}</b> (แตะวงกลมตัวอักษรเพื่อเปลี่ยน)
          </p>
        </>
      )}

      {/* ===== เติมคำ ===== */}
      {qType === 'fill' && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500">
            ✏️ คำตอบที่ยอมรับได้ (ใส่ได้หลายแบบ เช่น "2" และ "สอง" — ตรวจแบบไม่สนตัวพิมพ์เล็ก/ช่องว่าง)
          </p>
          {accepts.map((a, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-emerald-500">✓</span>
              <input
                type="text"
                value={a}
                onChange={(e) => setAccept(i, e.target.value)}
                placeholder={`คำตอบที่ยอมรับ #${i + 1}`}
                className="min-w-0 flex-1 rounded-xl border-2 border-violet-100 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-violet-400"
              />
              {accepts.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeAccept(i)}
                  className="flex-shrink-0 rounded-lg bg-rose-50 px-2 py-1 text-xs font-bold text-rose-500"
                >
                  ลบ
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addAccept}
            className="rounded-xl border-2 border-dashed border-violet-200 px-3 py-1.5 text-xs font-bold text-violet-500 hover:bg-violet-50"
          >
            ➕ เพิ่มคำตอบที่ยอมรับ
          </button>
        </div>
      )}

      {/* ===== จับคู่ ===== */}
      {qType === 'match' && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500">
            🔗 ใส่คู่ที่ถูกต้อง (ซ้าย ↔ ขวา) — เวลาให้ผู้เรียนทำ ระบบจะสลับฝั่งขวาให้อัตโนมัติ · ได้คะแนนเป็นรายคู่
          </p>
          {pairs.map((p, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input
                type="text"
                value={p.left}
                onChange={(e) => setPair(i, { left: e.target.value })}
                placeholder={`ซ้าย #${i + 1}`}
                className="min-w-0 flex-1 rounded-xl border-2 border-violet-100 bg-white px-2.5 py-2 text-sm text-slate-800 outline-none transition focus:border-violet-400"
              />
              <span className="flex-shrink-0 text-violet-300">↔</span>
              <input
                type="text"
                value={p.right}
                onChange={(e) => setPair(i, { right: e.target.value })}
                placeholder={`ขวา #${i + 1}`}
                className="min-w-0 flex-1 rounded-xl border-2 border-emerald-100 bg-white px-2.5 py-2 text-sm text-slate-800 outline-none transition focus:border-emerald-400"
              />
              {pairs.length > 1 && (
                <button
                  type="button"
                  onClick={() => removePair(i)}
                  className="flex-shrink-0 rounded-lg bg-rose-50 px-2 py-1 text-xs font-bold text-rose-500"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addPair}
            className="rounded-xl border-2 border-dashed border-violet-200 px-3 py-1.5 text-xs font-bold text-violet-500 hover:bg-violet-50"
          >
            ➕ เพิ่มคู่
          </button>
        </div>
      )}

      <BigTextField
        label="คำอธิบาย / เฉลย"
        value={q.explanation}
        onChange={(v) => setField({ explanation: v })}
        placeholder="คำอธิบาย/เฉลย (แสดงหลังผู้ใช้ทำเสร็จ) — แตะเพื่อเปิดช่องใหญ่"
      />

      {/* รูปประกอบคำอธิบาย/เฉลย (ใส่ได้หลายรูป) */}
      {explImages.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {explImages.map((url) => (
            <div key={url} className="relative">
              <img src={url} alt="" className="h-24 w-full rounded-lg border border-violet-100 object-cover" />
              <button
                type="button"
                onClick={() => removeExplImage(url)}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-xs font-bold text-white shadow"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-violet-200 py-2.5 text-sm font-semibold text-violet-500 hover:bg-violet-50">
        {explUploading
          ? '⏳ กำลังอัปโหลด…'
          : explImages.length
            ? '➕ เพิ่มรูปคำอธิบายอีก'
            : '🖼️ เพิ่มรูปในคำอธิบาย/เฉลย (ไม่บังคับ)'}
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={onPickExplImages}
          disabled={explUploading}
          className="hidden"
        />
      </label>
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

// จัดการรายการหมวด (เก็บใน app_settings key='categories')
function CategorySetting({ onSaved }) {
  const [list, setList] = useState([])
  const [newCat, setNewCat] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'categories')
        .maybeSingle()
      let arr
      try {
        arr = data?.value ? JSON.parse(data.value) : []
      } catch {
        arr = []
      }
      setList(Array.isArray(arr) ? arr : [])
      setLoading(false)
    })()
  }, [])

  const add = () => {
    const v = newCat.trim()
    setNewCat('')
    if (!v || list.includes(v)) return
    setList((l) => [...l, v])
  }
  const remove = (c) => setList((l) => l.filter((x) => x !== c))

  const save = async () => {
    setSaving(true)
    setMsg('')
    // รวมข้อความที่พิมพ์ค้างไว้ในช่อง (เผื่อยังไม่ได้กด "เพิ่ม")
    const clean = [...new Set([...list, newCat].map((s) => s.trim()).filter(Boolean))]
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: 'categories', value: JSON.stringify(clean), updated_at: new Date().toISOString() })
    setSaving(false)
    if (error) {
      setMsg('❌ ' + error.message)
      return
    }
    setList(clean)
    setNewCat('')
    setMsg(`✅ บันทึกแล้ว ${clean.length} หมวด`)
    onSaved?.(clean)
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
        ตั้งหมวดไว้ล่วงหน้า เวลาเพิ่มข้อสอบแต่ละข้อจะมีให้เลือกจาก dropdown — อย่าลืมกดบันทึก
      </p>
      {list.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {list.map((c) => (
            <span
              key={c}
              className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1 text-sm font-semibold text-violet-700"
            >
              {c}
              <button onClick={() => remove(c)} className="text-violet-400 hover:text-rose-500" title="ลบหมวด">
                ✕
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-400">ยังไม่มีหมวด</p>
      )}
      <div className="flex gap-2">
        <input
          value={newCat}
          onChange={(e) => setNewCat(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="เพิ่มหมวดใหม่ เช่น คณิตศาสตร์"
          className="min-w-0 flex-1 rounded-xl border-2 border-violet-100 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-violet-400"
        />
        <Button variant="ghost" onClick={add} className="px-4 py-2 text-sm">
          เพิ่ม
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Button onClick={save} disabled={saving} className="px-4 py-2 text-sm">
          {saving ? 'กำลังบันทึก…' : '💾 บันทึกหมวด'}
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

// ตั้งค่าเวลาทำข้อสอบ (นาที) — ใช้เป็นเวลานับถอยหลัง
function QuizTimeSetting() {
  const [mins, setMins] = useState('15')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'quiz_minutes')
        .maybeSingle()
      setMins(data?.value || '15')
      setLoading(false)
    })()
  }, [])

  const save = async () => {
    setSaving(true)
    setMsg('')
    const v = String(Math.max(1, Math.min(180, Number(mins) || 15)))
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: 'quiz_minutes', value: v, updated_at: new Date().toISOString() })
    setMins(v)
    setMsg(error ? '❌ ' + error.message : '✅ บันทึกแล้ว')
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
        เวลานับถอยหลังสำหรับทำข้อสอบทั้งชุด เมื่อหมดเวลาระบบจะส่งคำตอบให้อัตโนมัติ
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={180}
            value={mins}
            onChange={(e) => setMins(e.target.value)}
            className="w-24 rounded-xl border-2 border-violet-100 bg-white px-3 py-2 text-center text-lg font-bold text-slate-800 outline-none focus:border-violet-400"
          />
          <span className="text-sm font-semibold text-slate-500">นาที</span>
        </div>
        <Button onClick={save} disabled={saving} className="px-4 py-2 text-sm">
          {saving ? 'กำลังบันทึก…' : '💾 บันทึกเวลา'}
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

// ตั้งค่าข้อความตามคะแนนที่ได้ (เป็น % ของคะแนนเต็ม)
const SCORE_MSG_KEY = 'score_messages'
const DEFAULT_SCORE_MSGS = [
  { p: 100, t: '🏆 เพอร์เฟกต์! เก่งมาก ๆ ทำได้เต็มทุกข้อเลย!' },
  { p: 80, t: '🎉 ยอดเยี่ยมมาก! เกือบเต็มแล้วนะ' },
  { p: 60, t: '😊 ดีมาก! ทำได้เกินครึ่งแล้ว ลุยต่อเลย!' },
  { p: 40, t: '💪 พยายามได้ดีมาก ลองทบทวนอีกนิดนะ' },
  { p: 0, t: '🌱 ไม่เป็นไรนะ ทุกครั้งที่ลองคือการเรียนรู้ สู้ ๆ!' },
]

function ScoreMessageSetting() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', SCORE_MSG_KEY)
        .maybeSingle()
      let parsed
      try {
        parsed = data?.value ? JSON.parse(data.value) : null
      } catch {
        parsed = null
      }
      setRows(Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_SCORE_MSGS)
      setLoading(false)
    })()
  }, [])

  const setRow = (i, patch) => setRows((rs) => rs.map((r, ri) => (ri === i ? { ...r, ...patch } : r)))
  const addRow = () => setRows((rs) => [...rs, { p: 0, t: '' }])
  const removeRow = (i) => setRows((rs) => rs.filter((_, ri) => ri !== i))

  const save = async () => {
    setSaving(true)
    setMsg('')
    const clean = rows
      .map((r) => ({ p: Math.max(0, Math.min(100, Number(r.p) || 0)), t: (r.t || '').trim() }))
      .filter((r) => r.t)
      .sort((a, b) => b.p - a.p)
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: SCORE_MSG_KEY, value: JSON.stringify(clean), updated_at: new Date().toISOString() })
    setMsg(error ? '❌ ' + error.message : '✅ บันทึกแล้ว')
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
        ตั้งข้อความตามคะแนนที่ได้ (คิดเป็น % ของคะแนนเต็ม) — ระบบจะเลือกข้อความของเกณฑ์สูงสุดที่ผ่าน
        เช่น ได้ 4/5 = 80%, ได้ 3/5 = 60%
      </p>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="flex flex-shrink-0 items-center gap-1">
              <span className="text-xs font-bold text-slate-400">≥</span>
              <input
                type="number"
                min={0}
                max={100}
                value={r.p}
                onChange={(e) => setRow(i, { p: e.target.value })}
                className="w-14 rounded-lg border-2 border-violet-100 bg-white px-2 py-2 text-sm text-slate-800 outline-none focus:border-violet-400"
              />
              <span className="text-xs text-slate-400">%</span>
            </div>
            <input
              value={r.t}
              onChange={(e) => setRow(i, { t: e.target.value })}
              placeholder="ข้อความให้กำลังใจ…"
              className="min-w-0 flex-1 rounded-lg border-2 border-violet-100 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-violet-400"
            />
            <button
              onClick={() => removeRow(i)}
              className="flex-shrink-0 px-1 text-lg text-rose-400 hover:text-rose-600"
              title="ลบเกณฑ์นี้"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={addRow}
        className="w-full rounded-xl border-2 border-dashed border-violet-200 py-2 text-sm font-semibold text-violet-500 hover:bg-violet-50"
      >
        + เพิ่มเกณฑ์คะแนน
      </button>
      <div className="flex flex-wrap items-center gap-3 pt-1">
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

// ตั้งค่าข้อความตัวอย่าง (placeholder) ในช่องพิมพ์คำถามหน้าถาม-ตอบ
const QA_PUBLIC_KEY = 'qa_public_placeholder'
const QA_PRIVATE_KEY = 'qa_private_placeholder'

function QaPlaceholderSetting() {
  const [pub, setPub] = useState('')
  const [priv, setPriv] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', [QA_PUBLIC_KEY, QA_PRIVATE_KEY])
      const m = {}
      for (const r of data || []) m[r.key] = r.value
      setPub(m[QA_PUBLIC_KEY] ?? '')
      setPriv(m[QA_PRIVATE_KEY] ?? '')
      setLoading(false)
    })()
  }, [])

  const save = async () => {
    setSaving(true)
    setMsg('')
    const now = new Date().toISOString()
    const { error } = await supabase.from('app_settings').upsert([
      { key: QA_PUBLIC_KEY, value: pub.trim(), updated_at: now },
      { key: QA_PRIVATE_KEY, value: priv.trim(), updated_at: now },
    ])
    setMsg(error ? '❌ ' + error.message : '✅ บันทึกแล้ว')
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
        ข้อความตัวอย่าง (placeholder) ที่จะแสดงจาง ๆ ในช่องพิมพ์คำถามหน้าถาม-ตอบ — เว้นว่างไว้เพื่อใช้ค่าเริ่มต้น
      </p>
      <label className="text-xs font-medium text-slate-500">ช่องถามสาธารณะ 🌐</label>
      <input
        value={pub}
        onChange={(e) => setPub(e.target.value)}
        placeholder="เช่น พิมพ์คำถามของคุณที่นี่ (ไม่ระบุชื่อ)…"
        className="w-full rounded-xl border-2 border-violet-100 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-violet-400"
      />
      <label className="text-xs font-medium text-slate-500">ช่องถามแอดมิน (ส่วนตัว) 🔒</label>
      <input
        value={priv}
        onChange={(e) => setPriv(e.target.value)}
        placeholder="เช่น ส่งข้อความถึงแอดมินแบบส่วนตัว…"
        className="w-full rounded-xl border-2 border-violet-100 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-violet-400"
      />
      <div className="flex flex-wrap items-center gap-3 pt-1">
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

  const removeAttempt = async (a) => {
    if (!confirm(`ลบผลของ "${a.username}" (${a.score}/${a.total}) ครั้งนี้?`)) return
    const { error } = await supabase.rpc('delete_attempt', { p_attempt_id: a.attempt_id })
    if (error) {
      alert('ลบไม่สำเร็จ: ' + error.message)
      return
    }
    setItems((prev) => prev.filter((x) => x.attempt_id !== a.attempt_id))
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
            {s.title || 'ชุดข้อสอบ'} ({s.question_count} ข้อ)
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
              <div className="flex items-center">
                <button
                  onClick={() => setOpenId(open ? null : a.attempt_id)}
                  className="flex min-w-0 flex-1 items-center justify-between gap-2 p-3 text-left"
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
                <button
                  onClick={() => removeAttempt(a)}
                  className="flex-shrink-0 px-3 py-3 text-rose-400 hover:text-rose-600"
                  title="ลบผลครั้งนี้"
                >
                  🗑
                </button>
              </div>

              {open && (
                <div className="space-y-2 border-t border-violet-100 bg-violet-50/40 p-3">
                  {(a.answers || []).map((ans) => (
                    <div key={ans.order_index} className="rounded-lg bg-white p-2.5 text-sm shadow-sm">
                      <p className="whitespace-pre-wrap break-words font-semibold text-slate-700">
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

// สีตามเปอร์เซ็นต์คะแนน (แดง 0% -> เหลือง -> เขียว 100%)
const pctText = (pct) => `hsl(${Math.round((pct / 100) * 120)}, 65%, 38%)`
const pctBg = (pct) => `hsl(${Math.round((pct / 100) * 120)}, 70%, 92%)`

// 📈 สรุป & กราฟ (เฉพาะแอดมิน)
function StatsPanel({ sets }) {
  const [matrix, setMatrix] = useState(null) // { users, sets, cells }
  const [loading, setLoading] = useState(true)
  const [personId, setPersonId] = useState('')
  const [qSetId, setQSetId] = useState('')
  const [qStats, setQStats] = useState(null)
  const [qLoading, setQLoading] = useState(false)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const { data } = await supabase.rpc('get_score_matrix')
      setMatrix(data || { users: [], sets: [], cells: [] })
      setLoading(false)
    })()
  }, [])

  const loadQStats = async (id) => {
    setQSetId(id)
    setQStats(null)
    if (!id) return
    setQLoading(true)
    const { data } = await supabase.rpc('get_question_stats', { p_exam_set_id: id })
    setQStats(data?.items || [])
    setQLoading(false)
  }

  if (loading)
    return (
      <Card>
        <Spinner label="กำลังโหลดสถิติ…" />
      </Card>
    )

  const { users = [], sets: aSets = [], cells = [] } = matrix || {}
  const cellMap = {}
  for (const c of cells) cellMap[`${c.user_id}|${c.exam_set_id}`] = c
  const cellPct = (c, s) => {
    const total = c.best_total || s.total || 0
    return total ? Math.round((100 * c.best) / total) : 0
  }

  const person = users.find((u) => u.id === personId)
  const personRows = person
    ? aSets.map((s) => ({ s, c: cellMap[`${person.id}|${s.id}`] })).filter((r) => r.c)
    : []
  const answeredStats = (qStats || []).filter((q) => q.answered > 0)

  return (
    <div className="space-y-5">
      {/* ===== Heatmap: คน x ชุด ===== */}
      <Card className="space-y-2">
        <h3 className="text-sm font-bold text-slate-700">🗺️ ตารางคะแนน (ทุกคน × ทุกชุด)</h3>
        {users.length === 0 ? (
          <p className="py-3 text-center text-sm text-slate-400">ยังไม่มีใครทำข้อสอบ</p>
        ) : (
          <>
            <p className="text-xs text-slate-400">
              แถว = ชุดข้อสอบ · คอลัมน์ = ผู้ทำ · ตัวเลข = คะแนนสูงสุด (เลื่อนซ้าย-ขวาได้)
            </p>
            <div className="overflow-x-auto pb-1">
              <table className="border-separate" style={{ borderSpacing: '4px' }}>
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-white px-1 text-left text-[11px] font-bold text-slate-400">
                      ชุด \ คน
                    </th>
                    {users.map((u) => (
                      <th
                        key={u.id}
                        className="max-w-[72px] truncate px-1 text-[11px] font-bold text-slate-500"
                        title={u.username}
                      >
                        {u.username}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {aSets.map((s) => (
                    <tr key={s.id}>
                      <td
                        className="sticky left-0 z-10 max-w-[120px] truncate bg-white px-1 text-[11px] font-semibold text-slate-600"
                        title={s.title}
                      >
                        {s.title || 'ชุด'}
                      </td>
                      {users.map((u) => {
                        const c = cellMap[`${u.id}|${s.id}`]
                        if (!c)
                          return (
                            <td key={u.id} className="text-center text-xs text-slate-300">
                              –
                            </td>
                          )
                        const total = c.best_total || s.total || 0
                        const pct = cellPct(c, s)
                        return (
                          <td
                            key={u.id}
                            className="rounded-md px-2 py-1 text-center text-[11px] font-bold tabular-nums"
                            style={{ background: pctBg(pct), color: pctText(pct) }}
                            title={`${u.username} · ${s.title}: ${c.best}/${total} (${pct}%) · ${c.attempts} ครั้ง`}
                          >
                            {c.best}/{total}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      {/* ===== กราฟรายคน ===== */}
      <Card className="space-y-3">
        <h3 className="text-sm font-bold text-slate-700">👤 คะแนนรายคน (แต่ละชุด)</h3>
        <select
          value={personId}
          onChange={(e) => setPersonId(e.target.value)}
          className="w-full rounded-xl border-2 border-violet-100 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-violet-400"
        >
          <option value="">— เลือกผู้ใช้ —</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.username}
            </option>
          ))}
        </select>
        {person && personRows.length === 0 && (
          <p className="py-2 text-center text-sm text-slate-400">ยังไม่เคยทำข้อสอบ</p>
        )}
        {personRows.length > 0 && (
          <div className="space-y-2.5">
            {personRows.map(({ s, c }) => {
              const total = c.best_total || s.total || 0
              const pct = cellPct(c, s)
              return (
                <div key={s.id}>
                  <div className="mb-0.5 flex items-center justify-between gap-2 text-xs">
                    <span className="min-w-0 truncate font-semibold text-slate-600">{s.title || 'ชุด'}</span>
                    <span className="flex-shrink-0 font-bold tabular-nums" style={{ color: pctText(pct) }}>
                      {c.best}/{total} ({pct}%)
                    </span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: pctText(pct) }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* ===== ข้อที่ตอบผิดเยอะสุด ===== */}
      <Card className="space-y-3">
        <h3 className="text-sm font-bold text-slate-700">❌ ข้อที่คนตอบผิดมากสุด (รายชุด)</h3>
        <select
          value={qSetId}
          onChange={(e) => loadQStats(e.target.value)}
          className="w-full rounded-xl border-2 border-violet-100 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-violet-400"
        >
          <option value="">— เลือกชุดข้อสอบ —</option>
          {sets.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title || 'ชุดข้อสอบ'} ({s.question_count} ข้อ)
            </option>
          ))}
        </select>
        {qLoading && <Spinner label="กำลังคำนวณ…" />}
        {qStats && !qLoading && answeredStats.length === 0 && (
          <p className="py-2 text-center text-sm text-slate-400">ยังไม่มีใครทำชุดนี้</p>
        )}
        {answeredStats.length > 0 && (
          <div className="space-y-2.5">
            {answeredStats.map((q, i) => (
              <div key={q.question_id}>
                <div className="mb-0.5 flex items-start justify-between gap-2 text-xs">
                  <span className="min-w-0 flex-1 truncate font-semibold text-slate-600">
                    {i === 0 && q.wrong > 0 && '🔴 '}ข้อ {q.order_index + 1}. {q.question_text}
                  </span>
                  <span className="flex-shrink-0 font-bold tabular-nums text-rose-500">
                    {q.wrong_pct}% ({q.wrong}/{q.answered})
                  </span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-rose-400 transition-all"
                    style={{ width: `${q.wrong_pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

// แอดมินเขียน/จัดการบทความความรู้
function ArticlesAdmin() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [images, setImages] = useState([])
  const [published, setPublished] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const [stats, setStats] = useState({})
  const load = useCallback(async () => {
    setLoading(true)
    const [{ data }, { data: statData }] = await Promise.all([
      supabase
        .from('articles')
        .select('id, title, body, cover_url, images, published, created_at')
        .order('created_at', { ascending: false }),
      supabase.rpc('get_article_stats'),
    ])
    setList(data || [])
    setStats(statData && typeof statData === 'object' ? statData : {})
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const resetForm = () => {
    setEditingId(null)
    setTitle('')
    setBody('')
    setImages([])
    setPublished(true)
  }

  const startEdit = (a) => {
    setEditingId(a.id)
    setTitle(a.title)
    setBody(a.body)
    const imgs = Array.isArray(a.images) && a.images.length ? a.images : a.cover_url ? [a.cover_url] : []
    setImages(imgs)
    setPublished(a.published)
    setMsg('')
  }

  const onPickImages = async (e) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (!files.length) return
    setMsg('')
    setUploading(true)
    try {
      const urls = []
      for (const file of files) {
        if (!file.type.startsWith('image/')) continue
        if (file.size > 5 * 1024 * 1024) {
          setMsg('⚠️ ข้ามรูปที่ใหญ่เกิน 5MB บางรูป')
          continue
        }
        const up = await compressImage(file)
        const ext = (up.name.split('.').pop() || 'jpg').toLowerCase()
        const path = `articles/${crypto.randomUUID()}.${ext}`
        const { error } = await supabase.storage
          .from('question-images')
          .upload(path, up, { contentType: up.type, upsert: false })
        if (error) throw error
        const { data } = supabase.storage.from('question-images').getPublicUrl(path)
        urls.push(data.publicUrl)
      }
      setImages((prev) => [...prev, ...urls])
    } catch (err) {
      setMsg('❌ อัปโหลดรูปไม่สำเร็จ: ' + (err.message || ''))
    } finally {
      setUploading(false)
    }
  }

  const removeImage = (url) => setImages((prev) => prev.filter((u) => u !== url))

  const save = async () => {
    if (!title.trim() || !body.trim()) {
      setMsg('⚠️ ใส่หัวข้อและเนื้อหาก่อน')
      return
    }
    setSaving(true)
    setMsg('')
    const row = {
      title: title.trim(),
      body: body.trim(),
      images,
      cover_url: images[0] || null,
      published,
    }
    let error
    if (editingId) {
      ;({ error } = await supabase
        .from('articles')
        .update({ ...row, updated_at: new Date().toISOString() })
        .eq('id', editingId))
    } else {
      ;({ error } = await supabase.from('articles').insert(row))
    }
    setSaving(false)
    if (error) {
      setMsg('❌ ' + error.message)
      return
    }
    setMsg('✅ บันทึกบทความแล้ว' + (published ? ' (เผยแพร่ + แจ้งเตือนสมาชิก)' : ' (ฉบับร่าง)'))
    resetForm()
    load()
  }

  const togglePublish = async (a) => {
    await supabase.from('articles').update({ published: !a.published }).eq('id', a.id)
    load()
  }

  const remove = async (a) => {
    if (!confirm(`ลบบทความ "${a.title}"?`)) return
    await supabase.from('articles').delete().eq('id', a.id)
    if (editingId === a.id) resetForm()
    load()
  }

  return (
    <>
      <Card className="space-y-3">
        <p className="text-sm font-bold text-violet-600">
          {editingId ? '✏️ แก้ไขบทความ' : '✍️ เขียนบทความใหม่'}
        </p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="หัวข้อบทความ"
          className="w-full rounded-xl border-2 border-violet-100 bg-white px-3 py-2 text-slate-800 outline-none transition focus:border-violet-400"
        />
        <AutoTextarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          minRows={8}
          placeholder="เนื้อหาบทความ… (ขึ้นบรรทัดใหม่ได้ตามต้องการ)"
          className="w-full resize-none rounded-xl border-2 border-violet-100 bg-white p-2.5 text-[15px] leading-relaxed text-slate-800 outline-none transition focus:border-violet-400"
        />

        {/* รูปประกอบ (ใส่ได้หลายรูป — รูปแรกเป็นปก) */}
        {images.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {images.map((url, i) => (
              <div key={url} className="relative">
                <img src={url} alt="" className="h-24 w-full rounded-lg border border-violet-100 object-cover" />
                {i === 0 && (
                  <span className="absolute left-1 top-1 rounded-full bg-violet-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
                    ปก
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removeImage(url)}
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-xs font-bold text-white shadow"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-violet-200 py-3 text-sm font-semibold text-violet-500 hover:bg-violet-50">
          {uploading ? '⏳ กำลังอัปโหลด…' : images.length ? '➕ เพิ่มรูปอีก' : '🖼️ เพิ่มรูปประกอบ (เลือกได้หลายรูป)'}
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={onPickImages}
            disabled={uploading}
            className="hidden"
          />
        </label>

        <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
            className="h-4 w-4 accent-violet-500"
          />
          เผยแพร่ทันที (สมาชิกเห็น + เด้งแจ้งเตือนบทความใหม่)
        </label>

        {msg && (
          <p className={`text-sm font-semibold ${msg.startsWith('✅') ? 'text-emerald-600' : 'text-rose-500'}`}>
            {msg}
          </p>
        )}

        <div className="flex gap-2">
          <Button onClick={save} disabled={saving} className="flex-1">
            {saving ? 'กำลังบันทึก…' : editingId ? '💾 บันทึกการแก้ไข' : '📤 เผยแพร่บทความ'}
          </Button>
          {editingId && (
            <Button variant="outline" onClick={resetForm}>
              ยกเลิก
            </Button>
          )}
        </div>
      </Card>

      {/* รายการบทความที่มี */}
      {loading ? (
        <Spinner label="กำลังโหลดบทความ…" />
      ) : list.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">ยังไม่มีบทความ</p>
      ) : (
        <div className="mt-3 space-y-2">
          {list.map((a) => (
            <Card key={a.id} className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-bold text-slate-800">{a.title}</p>
                <p className="text-xs text-slate-400">
                  {a.published ? (
                    <span className="font-semibold text-emerald-600">เผยแพร่แล้ว</span>
                  ) : (
                    <span className="font-semibold text-amber-600">ฉบับร่าง</span>
                  )}{' '}
                  · 👤 {stats[a.id]?.viewers ?? 0} คน · ⭐ {stats[a.id]?.stars ?? 0} · {new Date(a.created_at).toLocaleDateString('th-TH')}
                </p>
              </div>
              <div className="flex flex-shrink-0 gap-1">
                <button
                  onClick={() => startEdit(a)}
                  className="rounded-lg bg-violet-100 px-2 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-200"
                >
                  แก้ไข
                </button>
                <button
                  onClick={() => togglePublish(a)}
                  className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200"
                >
                  {a.published ? 'ซ่อน' : 'เผยแพร่'}
                </button>
                <button
                  onClick={() => remove(a)}
                  className="rounded-lg bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-200"
                >
                  ลบ
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}

// รายการเมนูในแถบด้านข้างของหน้าแอดมิน (เลื่อนไปยังแต่ละส่วน)
const ADMIN_SECTIONS = [
  { id: 'exams', label: '📝 ข้อสอบ' },
  { id: 'results', label: '📊 ผลตรวจ' },
  { id: 'stats', label: '📈 สรุป & กราฟ' },
  { id: 'categories', label: '🏷️ หมวดข้อสอบ' },
  { id: 'time', label: '⏱ เวลาทำข้อสอบ' },
  { id: 'encourage', label: '💛 ข้อความให้กำลังใจ' },
  { id: 'score', label: '🎯 ข้อความตามคะแนน' },
  { id: 'qa', label: '💬 ข้อความช่องถาม-ตอบ' },
  { id: 'private', label: '📨 คำถามส่วนตัว' },
  { id: 'articles', label: '📰 บทความความรู้' },
  { id: 'users', label: '👥 ผู้ใช้' },
]

export default function Admin() {
  const { isAdmin, adminEmail, adminSignOut } = useStore()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [section, setSection] = useState('exams') // หน้าที่กำลังเปิดอยู่
  const touchRef = useRef({ x: 0, y: 0 })

  const onTouchStart = (e) => {
    const t = e.touches[0]
    touchRef.current = { x: t.clientX, y: t.clientY }
  }
  const onTouchEnd = (e) => {
    const t = e.changedTouches[0]
    const dx = t.clientX - touchRef.current.x
    const dy = t.clientY - touchRef.current.y
    if (Math.abs(dy) > Math.abs(dx)) return // เลื่อนแนวตั้ง = อ่าน ไม่ใช่เปิดเมนู
    if (!drawerOpen && touchRef.current.x < 30 && dx > 60) setDrawerOpen(true)
    else if (drawerOpen && dx < -60) setDrawerOpen(false)
  }
  const goSection = (secId) => {
    setSection(secId)
    setDrawerOpen(false)
    window.scrollTo({ top: 0 })
  }
  const sectionLabel = ADMIN_SECTIONS.find((m) => m.id === section)?.label || ''
  const [sets, setSets] = useState([])
  const [users, setUsers] = useState([])
  const [privateCount, setPrivateCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const [targetSetId, setTargetSetId] = useState('') // '' = สร้างชุดใหม่, ไม่งั้น = id ชุดเดิม
  const [dayNumber, setDayNumber] = useState(1)
  const [title, setTitle] = useState('')
  const [categoryList, setCategoryList] = useState([]) // หมวดที่ตั้งไว้ (สำหรับ dropdown)
  const [publish, setPublish] = useState(true)
  const [publishEdit, setPublishEdit] = useState(true) // สถานะเผยแพร่ของชุดที่กำลังแก้ไข
  const [questions, setQuestions] = useState(() =>
    Array.from({ length: 5 }, blankQuestion)
  )
  const [saving, setSaving] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const formRef = useRef(null)

  const isNewSet = targetSetId === ''

  // รวมตัวเลือกเดิมให้เป็นช่อง A-E ครบเพื่อแก้ไขได้
  const normalizeChoices = (choices) => {
    const map = {}
    for (const c of choices || []) map[c.key] = c.text
    return LETTERS.map((k) => ({ key: k, text: map[k] || '' }))
  }

  // โหลดคำถาม+เฉลยของชุดหนึ่งกลับมาเป็น state ของฟอร์ม (ทุกข้อมี id ครบ)
  const loadSetQuestions = async (setId) => {
    const { data: qs } = await supabase
      .from('questions')
      .select('id, order_index, question_text, image_url, category, choices, q_type')
      .eq('exam_set_id', setId)
      .order('order_index', { ascending: true })
    const ids = (qs || []).map((q) => q.id)
    const keys = {}
    if (ids.length) {
      const { data: ks } = await supabase
        .from('question_keys')
        .select('question_id, correct_choice, explanation, explanation_images')
        .in('question_id', ids)
      for (const k of ks || []) keys[k.question_id] = k
    }
    return (qs || []).map((q) => {
      const type = q.q_type || 'mc'
      const cc = keys[q.id]?.correct_choice
      const loadedAccepts = type === 'fill' ? fillAccepts(cc) : []
      const loadedPairs =
        type === 'match' && Array.isArray(q.choices)
          ? q.choices.map((c) => ({ left: c.left || '', right: c.right || '' }))
          : []
      return {
        id: q.id,
        question_text: q.question_text || '',
        image_url: q.image_url || '',
        category: q.category || '',
        q_type: type,
        choices: type === 'mc' ? normalizeChoices(q.choices) : LETTERS.map((k) => ({ key: k, text: '' })),
        correct_choice: type === 'mc' ? cc || 'A' : 'A',
        accepts: loadedAccepts.length ? loadedAccepts : [''],
        pairs: loadedPairs.length ? loadedPairs : [{ left: '', right: '' }, { left: '', right: '' }],
        explanation: keys[q.id]?.explanation || '',
        explanation_images: Array.isArray(keys[q.id]?.explanation_images)
          ? keys[q.id].explanation_images
          : [],
      }
    })
  }

  // เลือกชุดเดิม -> โหลดคำถาม+เฉลยทั้งหมดกลับมาแก้ไข; เลือก "สร้างใหม่" -> ฟอร์มเปล่า
  const pickTarget = async (setId) => {
    setTargetSetId(setId)
    setMsg('')
    if (setId === '') {
      setTitle('')
      setQuestions(Array.from({ length: 5 }, blankQuestion))
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    const tgt = sets.find((s) => s.id === setId)
    if (tgt) {
      setTitle(tgt.title || '')
      setDayNumber(tgt.day_number)
      setPublishEdit(tgt.published)
    }
    setFormLoading(true)
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    const loaded = await loadSetQuestions(setId)
    setQuestions(loaded.length ? loaded : [blankQuestion()])
    setFormLoading(false)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: setsData }, { count }, { data: usersData }, { data: catSetting }] =
      await Promise.all([
        supabase
          .from('exam_sets')
          .select('id, day_number, title, published, question_count, created_at')
          .order('day_number', { ascending: true }),
        supabase
          .from('qa_threads')
          .select('id', { count: 'exact', head: true })
          .eq('is_public', false),
        supabase
          .from('profiles')
          .select('id, username, suspended, exclude_stats, created_at')
          .order('created_at', { ascending: true }),
        supabase.from('app_settings').select('value').eq('key', 'categories').maybeSingle(),
      ])
    setSets(setsData || [])
    setPrivateCount(count || 0)
    setUsers(usersData || [])
    setDayNumber(((setsData || []).reduce((m, s) => Math.max(m, s.day_number), 0) || 0) + 1)
    let cats
    try {
      cats = catSetting?.value ? JSON.parse(catSetting.value) : []
    } catch {
      cats = []
    }
    setCategoryList(Array.isArray(cats) ? cats : [])
    setLoading(false)
  }, [])

  const toggleSuspend = async (u) => {
    const action = u.suspended ? 'ปลดระงับ' : 'ระงับ'
    if (!confirm(`${action}ผู้ใช้ "${u.username}"?`)) return
    await supabase.from('profiles').update({ suspended: !u.suspended }).eq('id', u.id)
    load()
  }

  const toggleExclude = async (u) => {
    await supabase.from('profiles').update({ exclude_stats: !u.exclude_stats }).eq('id', u.id)
    setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, exclude_stats: !x.exclude_stats } : x)))
  }

  useEffect(() => {
    if (isAdmin) load()
  }, [isAdmin, load])

  // ดึงรายการหมวดล่าสุดจาก DB ทุกครั้งที่เข้าหน้าข้อสอบ (กันหมวดที่เพิ่งบันทึกไม่ขึ้นใน dropdown)
  useEffect(() => {
    if (!isAdmin || section !== 'exams') return
    supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'categories')
      .maybeSingle()
      .then(({ data }) => {
        let cats
        try {
          cats = data?.value ? JSON.parse(data.value) : []
        } catch {
          cats = []
        }
        setCategoryList(Array.isArray(cats) ? cats : [])
      })
  }, [isAdmin, section])

  if (!isAdmin) return <AdminLogin />
  if (loading) return <Spinner />

  const updateQ = (i, val) => setQuestions((qs) => qs.map((q, qi) => (qi === i ? val : q)))
  const removeQ = async (i) => {
    const q = questions[i]
    if (q.id) {
      if (!confirm('ลบข้อนี้ออกจากชุดถาวร?')) return
      const { error } = await supabase.rpc('delete_question', { p_question_id: q.id })
      if (error) {
        setMsg('❌ ลบไม่สำเร็จ: ' + error.message)
        return
      }
    }
    setQuestions((qs) => qs.filter((_, qi) => qi !== i))
  }
  const addQ = () => setQuestions((qs) => [...qs, blankQuestion()])

  // ข้อที่ยังไม่ได้กรอกอะไรเลย -> ข้ามไป (ไม่ต้องครบ 5 ข้อ)
  const isBlankQuestion = (q) => {
    if (q.question_text.trim() || q.explanation.trim()) return false
    const type = q.q_type || 'mc'
    if (type === 'fill') return !(q.accepts || []).some((a) => a.trim())
    if (type === 'match') return !(q.pairs || []).some((p) => p.left.trim() || p.right.trim())
    return !q.choices.some((c) => c.text.trim())
  }

  const validate = (list) => {
    if (list.length === 0) return 'กรอกอย่างน้อย 1 ข้อก่อนบันทึก'
    for (let i = 0; i < list.length; i++) {
      const q = list[i]
      if (!q.question_text.trim()) return `ข้อ ${i + 1}: ยังไม่ได้ใส่โจทย์`
      const type = q.q_type || 'mc'
      if (type === 'fill') {
        if (!(q.accepts || []).some((a) => a.trim()))
          return `ข้อ ${i + 1}: เติมคำ — ต้องมีคำตอบที่ยอมรับอย่างน้อย 1 คำ`
      } else if (type === 'match') {
        const ps = (q.pairs || []).filter((p) => p.left.trim() && p.right.trim())
        if (ps.length < 2) return `ข้อ ${i + 1}: จับคู่ — ต้องมีคู่ที่กรอกครบ (ซ้าย+ขวา) อย่างน้อย 2 คู่`
      } else {
        const filled = q.choices.filter((c) => c.text.trim()).length
        if (filled < 2) return `ข้อ ${i + 1}: ต้องมีตัวเลือกอย่างน้อย 2 ข้อ`
        if (!q.choices.find((c) => c.key === q.correct_choice)?.text.trim())
          return `ข้อ ${i + 1}: ตัวเลือกที่ตั้งเป็นคำตอบถูกยังว่าง`
      }
    }
    return null
  }

  // แปลง state ของฟอร์มเป็น payload ตามชนิดข้อ
  const buildQuestionPayload = (q) => {
    const type = q.q_type || 'mc'
    const base = {
      id: q.id || null,
      question_text: q.question_text.trim(),
      image_url: q.image_url || '',
      category: (q.category || '').trim(),
      q_type: type,
      explanation: q.explanation.trim(),
      explanation_images: Array.isArray(q.explanation_images) ? q.explanation_images : [],
    }
    if (type === 'fill') {
      const accepts = (q.accepts || []).map((a) => a.trim()).filter(Boolean)
      return { ...base, choices: [], correct_choice: JSON.stringify(accepts) }
    }
    if (type === 'match') {
      const pairs = (q.pairs || [])
        .filter((p) => p.left.trim() && p.right.trim())
        .map((p, i) => ({ key: String(i + 1), left: p.left.trim(), right: p.right.trim() }))
      return { ...base, choices: pairs, correct_choice: 'match' }
    }
    return { ...base, choices: q.choices.filter((c) => c.text.trim()), correct_choice: q.correct_choice }
  }

  const save = async () => {
    setMsg('')
    // กรอกกี่ข้อก็ได้ — ข้ามข้อที่ว่างเปล่าทิ้ง แล้วบันทึกเฉพาะข้อที่กรอก
    const filledQuestions = questions.filter((q) => !isBlankQuestion(q))
    const v = validate(filledQuestions)
    if (v) {
      setMsg('⚠️ ' + v)
      return
    }
    setSaving(true)
    try {
      // ส่ง id ติดไปกับแต่ละข้อ เพื่อให้ฝั่ง DB แยก "แก้ของเดิม" (มี id) กับ "เพิ่มใหม่" (ไม่มี id)
      const payload = filledQuestions.map(buildQuestionPayload)

      if (isNewSet) {
        const { error } = await supabase.rpc('create_exam_set', {
          p_day: Number(dayNumber), // ลำดับภายในสำหรับเรียงชุด (ไม่แสดงให้กรอก)
          p_title: title.trim() || 'ชุดข้อสอบ',
          p_published: publish,
          p_questions: payload,
        })
        if (error) throw error
        setMsg('✅ บันทึกชุดข้อสอบใหม่เรียบร้อย' + (publish ? ' และเผยแพร่แล้ว' : ' (ฉบับร่าง)'))
        setTitle('')
        setQuestions(Array.from({ length: 5 }, blankQuestion))
      } else {
        // บันทึกทั้งชุดในคราวเดียวแบบ atomic (upsert ตาม id — กดซ้ำก็ไม่เกิดข้อซ้ำ)
        const { data, error } = await supabase.rpc('save_exam_set', {
          p_set_id: targetSetId,
          p_title: title.trim(),
          p_questions: payload,
        })
        if (error) throw error
        // อัปเดตสถานะเผยแพร่/ซ่อนของชุด
        await supabase.from('exam_sets').update({ published: publishEdit }).eq('id', targetSetId)
        setMsg(
          `✅ บันทึกแล้ว — แก้ไข ${data?.updated ?? 0} ข้อ, เพิ่มใหม่ ${data?.added ?? 0} ข้อ` +
            (publishEdit ? ' · เผยแพร่อยู่' : ' · ซ่อนอยู่ (ฉบับร่าง)')
        )
        // โหลดกลับมาใหม่เพื่อให้ทุกข้อมี id ครบ (กันการกดบันทึกซ้ำแล้วเพิ่มซ้ำ)
        const reloaded = await loadSetQuestions(targetSetId)
        if (reloaded.length) setQuestions(reloaded)
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
    if (!confirm(`ลบชุด "${s.title || 'ชุดข้อสอบ'}" และคำถามทั้งหมด?`)) return
    await supabase.from('exam_sets').delete().eq('id', s.id)
    load()
  }

  return (
    <div className="px-4 pt-4 pb-6" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {/* เมนูด้านข้าง — ปัดจากขอบซ้าย หรือกดปุ่ม ☰ */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setDrawerOpen(false)}>
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <div
            className="animate-slide-left absolute left-0 top-0 h-full w-64 max-w-[80%] overflow-y-auto bg-white p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-3 text-base font-extrabold text-violet-700">🛠️ เมนูแอดมิน</p>
            <div className="space-y-1">
              {ADMIN_SECTIONS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => goSection(m.id)}
                  className={`block w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold ${
                    section === m.id ? 'bg-violet-600 text-white' : 'text-slate-700 hover:bg-violet-50'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <p className="mt-4 truncate border-t border-violet-100 pt-3 text-xs text-slate-400">
              {adminEmail}
            </p>
          </div>
        </div>
      )}

      <header className="mb-4 flex items-center gap-2 rounded-3xl bg-gradient-to-r from-violet-500 to-indigo-500 p-4 text-white shadow-lg shadow-violet-300/50">
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex-shrink-0 rounded-xl bg-white/20 px-3 py-2 text-lg leading-none text-white hover:bg-white/30"
          title="เปิดเมนู"
        >
          ☰
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-extrabold">{sectionLabel}</h1>
          <p className="truncate text-xs text-white/80">แตะ ☰ เพื่อเปลี่ยนหน้า</p>
        </div>
        <button
          onClick={adminSignOut}
          className="flex-shrink-0 rounded-xl bg-white/20 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/30"
        >
          ออก
        </button>
      </header>

      {section === 'exams' && (
        <>
      {/* เพิ่ม/แก้ไขข้อสอบ */}
      <h2 ref={formRef} className="mb-2 scroll-mt-4 text-base font-bold text-slate-700">
        {isNewSet ? '➕ เพิ่มชุดข้อสอบ' : '✏️ แก้ไขชุดข้อสอบ'}
      </h2>
      <Card className="mb-3 space-y-3">
        {/* เลือก: สร้างใหม่ หรือแก้ไขชุดเดิม */}
        <div>
          <label className="text-xs font-medium text-slate-500">สร้างชุดใหม่ หรือเลือกชุดเดิมมาแก้ไข</label>
          <select
            value={targetSetId}
            onChange={(e) => pickTarget(e.target.value)}
            className="w-full rounded-xl border-2 border-violet-100 bg-white px-3 py-2 text-slate-800 outline-none transition focus:border-violet-400"
          >
            <option value="">➕ สร้างชุดใหม่</option>
            {sets.map((s) => (
              <option key={s.id} value={s.id}>
                ✏️ แก้ไข: {s.title || 'ชุดข้อสอบ'} ({s.question_count} ข้อ)
              </option>
            ))}
          </select>
        </div>

        {/* ชื่อชุด */}
        <div>
          <label className="text-xs font-medium text-slate-500">ชื่อชุดข้อสอบ</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="เช่น ข้อสอบบทที่ 1, แนวข้อสอบกลางภาค…"
            className="w-full rounded-xl border-2 border-violet-100 bg-white px-3 py-2 text-slate-800 outline-none transition focus:border-violet-400"
          />
        </div>
        {isNewSet ? (
          <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
            <input
              type="checkbox"
              checked={publish}
              onChange={(e) => setPublish(e.target.checked)}
              className="h-4 w-4 accent-violet-500"
            />
            เผยแพร่ทันที (ผู้ใช้เห็น + แจ้งเตือนข้อสอบใหม่)
          </label>
        ) : (
          <>
            <p className="rounded-xl bg-violet-50 p-2.5 text-xs text-violet-700">
              กำลังแก้ไขชุดเดิม — แก้ข้อที่มีอยู่ได้เลย หรือกด "+ เพิ่มคำถาม" เพื่อเพิ่มข้อใหม่ แล้วกดบันทึก
            </p>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <input
                type="checkbox"
                checked={publishEdit}
                onChange={(e) => setPublishEdit(e.target.checked)}
                className="h-4 w-4 accent-violet-500"
              />
              เผยแพร่ (Public) ให้ผู้ใช้เห็น
              <span
                className={`ml-auto rounded-full px-2 py-0.5 text-xs font-semibold ${
                  publishEdit ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}
              >
                {publishEdit ? 'Public' : 'Hidden (ฉบับร่าง)'}
              </span>
            </label>
          </>
        )}
      </Card>

      {formLoading ? (
        <Spinner label="กำลังโหลดข้อสอบมาแก้ไข…" />
      ) : (
        <>
          <div className="space-y-3">
            {questions.map((q, i) => (
              <QuestionEditor
                key={q.id || `new-${i}`}
                q={q}
                index={i}
                categories={categoryList}
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
            {saving ? 'กำลังบันทึก…' : isNewSet ? '💾 บันทึกชุดข้อสอบใหม่' : '💾 บันทึกการแก้ไข'}
          </Button>
          <p className="mt-2 text-center text-xs text-slate-400">
            กรอกกี่ข้อก็ได้ — ข้อที่เว้นว่างไว้จะถูกข้ามให้อัตโนมัติ
          </p>
        </>
      )}

      {/* ชุดที่มีอยู่ */}
      <h2 id="sec-sets" className="mb-2 mt-6 scroll-mt-4 text-base font-bold text-slate-700">📚 ชุดข้อสอบที่มีอยู่</h2>
      {sets.length === 0 ? (
        <p className="text-sm text-slate-400">ยังไม่มีชุดข้อสอบ</p>
      ) : (
        <div className="space-y-2">
          {sets.map((s) => (
            <Card key={s.id} className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="truncate font-bold text-slate-800">{s.title || 'ชุดข้อสอบ'}</p>
                <p className="text-xs text-slate-400">
                  {s.question_count} ข้อ ·{' '}
                  {s.published ? (
                    <span className="font-semibold text-emerald-600">เผยแพร่แล้ว</span>
                  ) : (
                    <span className="font-semibold text-amber-600">ฉบับร่าง</span>
                  )}
                </p>
              </div>
              <div className="flex flex-shrink-0 gap-1">
                <Link
                  to={`/admin/preview/${s.id}`}
                  className="rounded-lg bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-200"
                  title="ลองทำข้อสอบชุดนี้แบบนักเรียน (ไม่บันทึกคะแนน)"
                >
                  👁️ ทดสอบ
                </Link>
                <button
                  onClick={() => pickTarget(s.id)}
                  className="rounded-lg bg-violet-100 px-2 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-200"
                  title="แก้ไข/เพิ่มคำถามในชุดนี้"
                >
                  ✏️ แก้ไข
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

        </>
      )}

      {section === 'results' && (
        <>
      {/* ผลตรวจ + เหตุผลผู้ตอบ */}
      <h2 className="mb-2 text-base font-bold text-slate-700">📊 ผลตรวจ &amp; เหตุผลผู้ตอบ</h2>
      <ExamResults sets={sets} />
        </>
      )}

      {section === 'stats' && (
        <>
      <h2 className="mb-2 text-base font-bold text-slate-700">📈 สรุป &amp; กราฟ</h2>
      <StatsPanel sets={sets} />
        </>
      )}

      {section === 'categories' && (
        <div className="mb-4">
          <CategorySetting onSaved={setCategoryList} />
        </div>
      )}

      {section === 'time' && (
        <div className="mb-4">
          <QuizTimeSetting />
        </div>
      )}

      {section === 'encourage' && (
        <div className="mb-4">
          <EncourageSetting />
        </div>
      )}

      {section === 'score' && (
        <div className="mb-4">
          <ScoreMessageSetting />
        </div>
      )}

      {section === 'qa' && (
        <div className="mb-4">
          <QaPlaceholderSetting />
        </div>
      )}

      {section === 'private' && (
        <Link to="/qa" className="mb-4 block">
          <Card className="flex items-center justify-between">
            <div>
              <p className="font-bold text-slate-800">📨 คำถามส่วนตัวถึงแอดมิน</p>
              <p className="text-xs text-slate-400">แตะเพื่อไปตอบในแท็บถาม-ตอบ → ส่วนตัว</p>
            </div>
            <Badge color={privateCount ? 'red' : 'slate'}>{privateCount}</Badge>
          </Card>
        </Link>
      )}

      {section === 'articles' && (
        <div className="mb-4">
          <ArticlesAdmin />
        </div>
      )}

      {section === 'users' && (
        <>
      {/* จัดการผู้ใช้ */}
      <h2 className="mb-2 text-base font-bold text-slate-700">
        👥 ผู้ใช้ ({users.length})
      </h2>
      {users.length === 0 ? (
        <p className="text-sm text-slate-400">ยังไม่มีผู้ใช้</p>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <Card key={u.id} className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-1.5 truncate font-bold text-slate-800">
                    {u.username}
                    {u.suspended && <Badge color="red">ถูกระงับ</Badge>}
                    {u.exclude_stats && <Badge color="slate">🚫📊 ไม่นับสถิติ</Badge>}
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
              </div>
              <button
                onClick={() => toggleExclude(u)}
                className={`w-full rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  u.exclude_stats
                    ? 'bg-violet-100 text-violet-700 hover:bg-violet-200'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {u.exclude_stats ? '📊 นับในสถิติอีกครั้ง' : '🚫 ไม่นับบัญชีนี้ในสถิติ/กราฟ'}
              </button>
            </Card>
          ))}
        </div>
      )}
        </>
      )}
    </div>
  )
}
