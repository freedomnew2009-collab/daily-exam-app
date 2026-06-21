// คอมโพเนนต์ UI เล็ก ๆ ที่ใช้ซ้ำทั้งแอพ (mobile-first, โทนสว่างสดใส)

import { useEffect, useRef, useState } from 'react'

// textarea ที่ยืดสูงตามข้อความที่พิมพ์อัตโนมัติ (พิมพ์เยอะก็เห็นครบ แก้ง่ายบนมือถือ)
export function AutoTextarea({ value, minRows = 2, className = '', onInput, ...props }) {
  const ref = useRef(null)
  const resize = (el) => {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }
  useEffect(() => {
    resize(ref.current)
  }, [value])
  return (
    <textarea
      ref={ref}
      value={value}
      rows={minRows}
      onInput={(e) => {
        resize(e.target)
        onInput?.(e)
      }}
      className={`overflow-hidden ${className}`}
      {...props}
    />
  )
}

// ปุ่มที่กดแล้วเปิดช่องพิมพ์ใหญ่เต็มจอ (ตัวหนังสือใหญ่ อ่าน/แก้ง่ายบนมือถือ) กด "เสร็จ" แล้วย่อกลับ
export function BigTextField({ label = 'คำอธิบาย', value = '', onChange, placeholder = '' }) {
  const [open, setOpen] = useState(false)
  const has = (value || '').trim().length > 0
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border-2 border-violet-100 bg-white p-3 text-left"
      >
        <span className="flex items-center justify-between gap-2">
          <span className="text-sm font-bold text-violet-600">📝 {label}</span>
          <span className="flex-shrink-0 rounded-lg bg-violet-100 px-2 py-1 text-xs font-bold text-violet-600">
            {has ? 'แตะเพื่อแก้ไข' : 'แตะเพื่อพิมพ์'} ▾
          </span>
        </span>
        {has ? (
          <span className="mt-1.5 block whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-600 line-clamp-3">
            {value}
          </span>
        ) : (
          <span className="mt-1.5 block text-sm text-slate-400">{placeholder || 'ยังไม่มีข้อความ'}</span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-slate-900/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="mt-auto flex h-[88vh] flex-col rounded-t-3xl bg-white p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-base font-extrabold text-slate-800">📝 {label}</span>
              <button
                onClick={() => setOpen(false)}
                className="rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 px-5 py-2 text-sm font-bold text-white shadow-md shadow-violet-300/50"
              >
                ✓ เสร็จ
              </button>
            </div>
            <textarea
              value={value}
              onChange={(e) => onChange?.(e.target.value)}
              autoFocus
              placeholder={placeholder}
              className="w-full flex-1 resize-none rounded-2xl border-2 border-violet-100 bg-white p-4 text-[17px] leading-relaxed text-slate-800 outline-none focus:border-violet-400"
            />
            <p className="mt-2 text-center text-xs text-slate-400">พิมพ์ได้ยาวเต็มที่ — กด “เสร็จ” เพื่อย่อกลับ</p>
          </div>
        </div>
      )}
    </>
  )
}

export function Spinner({ label = 'กำลังโหลด…' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
      <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-violet-200 border-t-violet-500" />
      <span className="text-sm">{label}</span>
    </div>
  )
}

export function Button({ children, variant = 'primary', className = '', ...props }) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-base font-bold transition active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100'
  const variants = {
    primary:
      'bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-lg shadow-violet-300/50 hover:from-violet-400 hover:to-indigo-400',
    ghost: 'bg-violet-100 text-violet-700 hover:bg-violet-200',
    danger:
      'bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-lg shadow-rose-300/50 hover:from-rose-400 hover:to-pink-400',
    outline: 'border-2 border-violet-200 text-violet-700 hover:bg-violet-50',
  }
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  )
}

export function Card({ children, className = '' }) {
  return (
    <div
      className={`rounded-3xl border border-white bg-white/80 p-4 shadow-lg shadow-violet-200/40 backdrop-blur ${className}`}
    >
      {children}
    </div>
  )
}

export function Badge({ children, color = 'slate' }) {
  const colors = {
    slate: 'bg-slate-100 text-slate-600',
    green: 'bg-emerald-100 text-emerald-700',
    red: 'bg-rose-100 text-rose-600',
    indigo: 'bg-violet-100 text-violet-700',
    amber: 'bg-amber-100 text-amber-700',
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${colors[color]}`}
    >
      {children}
    </span>
  )
}

export function Empty({ icon = '📭', title, hint }) {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center text-slate-400">
      <div className="animate-float text-5xl">{icon}</div>
      <p className="font-bold text-slate-600">{title}</p>
      {hint && <p className="text-sm text-slate-400">{hint}</p>}
    </div>
  )
}

// แปลงวินาทีเป็นรูปแบบ นาที:วินาที (เช่น 3:07)
export function formatDuration(totalSec = 0) {
  const s = Math.max(0, Math.floor(totalSec || 0))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}
