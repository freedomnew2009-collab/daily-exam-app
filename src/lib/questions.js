// ตัวช่วยสำหรับข้อสอบหลายรูปแบบ: ปรนัย (mc) · เติมคำ (fill) · จับคู่ (match)

export const Q_TYPES = [
  { value: 'mc', label: 'ปรนัย (เลือกตอบ)', emoji: '🔘' },
  { value: 'fill', label: 'เติมคำ (พิมพ์ตอบ)', emoji: '✏️' },
  { value: 'match', label: 'จับคู่ (โยงซ้าย-ขวา)', emoji: '🔗' },
]

export function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// เทียบข้อความแบบยืดหยุ่น: ตัดช่องว่างหัวท้าย, ยุบช่องว่างซ้ำ, ตัวพิมพ์เล็ก
export function normalize(t) {
  return (t ?? '').toString().toLowerCase().trim().replace(/\s+/g, ' ')
}

// คำตอบที่ยอมรับได้ของข้อเติมคำ จาก correct_choice (อาจเป็น JSON array หรือสตริงเดี่ยว)
export function fillAccepts(correctChoice) {
  if (Array.isArray(correctChoice)) return correctChoice.filter((s) => String(s).trim())
  try {
    const p = JSON.parse(correctChoice)
    if (Array.isArray(p)) return p.filter((s) => String(s).trim())
  } catch {
    /* ไม่ใช่ JSON */
  }
  return correctChoice && String(correctChoice).trim() ? [correctChoice] : []
}

// แปลง choices เป็น { lefts:[{key,text}], rights:[{text}] }
// • แบบดิบ [{key,left,right}] (โหมดฝึกซ้อม/รีวิว) -> สลับฝั่งขวาให้ ไม่ให้เดาจากลำดับ
// • แบบ sanitized {left,right} (โหมดทำข้อสอบจริง) -> ฝั่งขวาถูกสลับมาจาก server แล้ว ใช้ตามนั้น
export function matchView(choices) {
  if (Array.isArray(choices)) {
    const lefts = choices.map((c) => ({ key: String(c.key), text: c.left }))
    const rights = shuffle(choices.map((c) => ({ text: c.right })))
    return { lefts, rights }
  }
  const lefts = (choices?.left || []).map((l) => ({ key: String(l.key), text: l.text }))
  const rights = choices?.right || []
  return { lefts, rights }
}

// แผนที่เฉลยของข้อจับคู่จาก choices ดิบ -> { leftKey: rightText } (null ถ้าไม่มีเฉลย)
export function matchCorrect(choices) {
  if (!Array.isArray(choices)) return null
  const m = {}
  for (const c of choices) m[String(c.key)] = c.right
  return m
}

// แปลงค่าใน state ของผู้ทำ -> ข้อความ selected_choice ที่ส่งขึ้น server
export function encodeAnswer(type, value) {
  if (type === 'match') return value && Object.keys(value).length ? JSON.stringify(value) : null
  return value ? String(value) : null
}

// ผู้ใช้ตอบข้อนี้แล้วหรือยัง (ใช้ในแถบความคืบหน้า)
export function hasAnswer(type, value) {
  if (type === 'match') return !!(value && Object.keys(value).length > 0)
  return !!(value && String(value).trim())
}

// ตรวจคำตอบฝั่ง client (โหมดฝึกซ้อม) — q ต้องมี q_type, choices, correct_choice
export function gradeClient(q, value) {
  const type = q.q_type || 'mc'
  if (type === 'fill') {
    const accepts = fillAccepts(q.correct_choice).map(normalize)
    const ok = normalize(value) !== '' && accepts.includes(normalize(value))
    return { gained: ok ? 1 : 0, possible: 1, isCorrect: ok }
  }
  if (type === 'match') {
    const correct = matchCorrect(q.choices) || {}
    const keys = Object.keys(correct)
    const map = value || {}
    let g = 0
    for (const k of keys) {
      if (normalize(map[k]) !== '' && normalize(map[k]) === normalize(correct[k])) g++
    }
    const possible = Math.max(1, keys.length)
    return { gained: g, possible, isCorrect: g >= possible }
  }
  const ok = value != null && value === q.correct_choice
  return { gained: ok ? 1 : 0, possible: 1, isCorrect: ok }
}
