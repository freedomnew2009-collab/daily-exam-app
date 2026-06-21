// คอมโพเนนต์ UI เล็ก ๆ ที่ใช้ซ้ำทั้งแอพ (mobile-first)

export function Spinner({ label = 'กำลังโหลด…' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-indigo-400" />
      <span className="text-sm">{label}</span>
    </div>
  )
}

export function Button({ children, variant = 'primary', className = '', ...props }) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-base font-semibold transition active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100'
  const variants = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-500',
    ghost: 'bg-slate-800 text-slate-200 hover:bg-slate-700',
    danger: 'bg-rose-600 text-white hover:bg-rose-500',
    outline: 'border border-slate-700 text-slate-200 hover:bg-slate-800',
  }
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  )
}

export function Card({ children, className = '' }) {
  return (
    <div className={`rounded-2xl border border-slate-800 bg-slate-900/70 p-4 ${className}`}>
      {children}
    </div>
  )
}

export function Badge({ children, color = 'slate' }) {
  const colors = {
    slate: 'bg-slate-700 text-slate-200',
    green: 'bg-emerald-600/20 text-emerald-300 border border-emerald-600/40',
    red: 'bg-rose-600/20 text-rose-300 border border-rose-600/40',
    indigo: 'bg-indigo-600/20 text-indigo-300 border border-indigo-600/40',
    amber: 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[color]}`}>
      {children}
    </span>
  )
}

export function Empty({ icon = '📭', title, hint }) {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center text-slate-400">
      <div className="text-4xl">{icon}</div>
      <p className="font-medium text-slate-300">{title}</p>
      {hint && <p className="text-sm">{hint}</p>}
    </div>
  )
}
