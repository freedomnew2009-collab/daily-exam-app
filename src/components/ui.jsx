// คอมโพเนนต์ UI เล็ก ๆ ที่ใช้ซ้ำทั้งแอพ (mobile-first, โทนสว่างสดใส)

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
