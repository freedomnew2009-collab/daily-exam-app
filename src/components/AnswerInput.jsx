import { useMemo } from 'react'
import { matchView, matchCorrect, fillAccepts, normalize } from '../lib/questions'

// ====================== ช่องตอบ (หน้าทำข้อสอบ) ======================

function ChoiceInput({ q, value, onChange }) {
  return (
    <div className="space-y-2.5">
      {(q.choices || []).map((c) => {
        const active = value === c.key
        return (
          <button
            key={c.key}
            onClick={() => onChange(c.key)}
            className={`flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left transition ${
              active
                ? 'border-violet-400 bg-violet-50 shadow-md shadow-violet-200/50'
                : 'border-violet-100 bg-white active:bg-violet-50'
            }`}
          >
            <span
              className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-extrabold transition ${
                active ? 'bg-gradient-to-br from-violet-500 to-indigo-500 text-white' : 'bg-violet-100 text-violet-500'
              }`}
            >
              {c.key}
            </span>
            <span className="whitespace-pre-wrap break-words text-sm text-slate-700">{c.text}</span>
          </button>
        )
      })}
    </div>
  )
}

function FillInput({ value, onChange }) {
  return (
    <div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="พิมพ์คำตอบที่นี่…"
        className="w-full rounded-2xl border-2 border-violet-200 bg-white px-4 py-3 text-base text-slate-800 outline-none transition focus:border-violet-400"
      />
      <p className="mt-1.5 text-xs text-slate-400">✏️ พิมพ์คำตอบเป็นคำ/ข้อความ</p>
    </div>
  )
}

function MatchInput({ q, value, onChange }) {
  // rights ถูกสลับมาจาก server แล้ว — ใช้ useMemo กันสลับซ้ำตอน re-render
  const { lefts, rights } = useMemo(() => matchView(q.choices), [q.choices])
  const pick = (leftKey, rightText) => onChange({ ...value, [leftKey]: rightText })
  return (
    <div className="space-y-2.5">
      <p className="text-xs font-semibold text-slate-400">🔗 เลือกคำตอบฝั่งขวาให้ตรงกับฝั่งซ้าย</p>
      {lefts.map((l) => (
        <div
          key={l.key}
          className="flex items-center gap-2 rounded-2xl border-2 border-violet-100 bg-white p-2.5"
        >
          <span className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm font-semibold text-slate-700">
            {l.text}
          </span>
          <span className="flex-shrink-0 text-violet-300">→</span>
          <select
            value={value?.[l.key] ?? ''}
            onChange={(e) => pick(l.key, e.target.value)}
            className={`min-w-0 flex-1 rounded-xl border-2 px-2 py-2 text-sm outline-none transition ${
              value?.[l.key] ? 'border-violet-300 bg-violet-50 text-slate-800' : 'border-violet-100 bg-white text-slate-400'
            }`}
          >
            <option value="">— เลือก —</option>
            {rights.map((r, ri) => (
              <option key={ri} value={r.text}>
                {r.text}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  )
}

// q: { q_type, choices }  value: string (mc/fill) | map (match)  onChange(newValue)
export function AnswerInput({ q, value, onChange }) {
  const type = q.q_type || 'mc'
  if (type === 'fill') return <FillInput value={value || ''} onChange={onChange} />
  if (type === 'match') return <MatchInput q={q} value={value || {}} onChange={onChange} />
  return <ChoiceInput q={q} value={value || ''} onChange={onChange} />
}

// ====================== แสดงเฉลย (หน้ารีวิว) ======================

function McReview({ it }) {
  return (
    <div className="space-y-1.5">
      {(it.choices || []).map((c) => {
        const isCorrect = c.key === it.correct_choice
        const isYours = c.key === it.your_choice
        return (
          <div
            key={c.key}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
              isCorrect
                ? 'border-emerald-300 bg-emerald-50 font-semibold text-emerald-700'
                : isYours
                  ? 'border-rose-300 bg-rose-50 text-rose-600'
                  : 'border-slate-100 text-slate-500'
            }`}
          >
            <span className="font-bold">{c.key}</span>
            <span className="flex-1 whitespace-pre-wrap break-words">{c.text}</span>
            {isCorrect && <span>✅</span>}
            {isYours && !isCorrect && <span className="text-xs">← คุณเลือก</span>}
          </div>
        )
      })}
    </div>
  )
}

function FillReview({ it }) {
  const accepts = fillAccepts(it.correct_choice)
  const yours = it.your_choice || ''
  const ok = it.is_correct
  return (
    <div className="space-y-2 text-sm">
      <div
        className={`rounded-xl border px-3 py-2 ${
          ok ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-rose-300 bg-rose-50 text-rose-600'
        }`}
      >
        <span className="text-xs font-bold opacity-70">คำตอบของคุณ</span>
        <p className="whitespace-pre-wrap break-words font-semibold">{yours || '— ไม่ได้ตอบ —'}</p>
      </div>
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">
        <span className="text-xs font-bold opacity-70">✅ คำตอบที่ยอมรับ</span>
        <p className="whitespace-pre-wrap break-words font-semibold">{accepts.join('  /  ') || '—'}</p>
      </div>
    </div>
  )
}

function MatchReview({ it }) {
  const { lefts } = matchView(it.choices)
  const correct = matchCorrect(it.choices) || {}
  let yourMap = {}
  try {
    yourMap = it.your_choice ? JSON.parse(it.your_choice) : {}
  } catch {
    yourMap = {}
  }
  return (
    <div className="space-y-1.5 text-sm">
      {lefts.map((l) => {
        const yours = yourMap[l.key] || ''
        const right = correct[l.key] || ''
        const ok = normalize(yours) !== '' && normalize(yours) === normalize(right)
        return (
          <div
            key={l.key}
            className={`rounded-xl border px-3 py-2 ${
              ok ? 'border-emerald-300 bg-emerald-50' : 'border-rose-300 bg-rose-50'
            }`}
          >
            <p className="font-semibold text-slate-700">
              {l.text} <span className="text-violet-300">→</span>{' '}
              <span className={ok ? 'text-emerald-700' : 'text-rose-600'}>{yours || '— ไม่ได้เลือก —'}</span>{' '}
              {ok ? '✅' : '❌'}
            </p>
            {!ok && <p className="text-xs text-emerald-700">เฉลย: {right}</p>}
          </div>
        )
      })}
    </div>
  )
}

// it: { q_type, choices, correct_choice, your_choice, is_correct }
export function ReviewAnswer({ it }) {
  const type = it.q_type || 'mc'
  if (type === 'fill') return <FillReview it={it} />
  if (type === 'match') return <MatchReview it={it} />
  return <McReview it={it} />
}
