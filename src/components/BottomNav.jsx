import { NavLink } from 'react-router-dom'
import { useStore } from '../store'

const tabs = [
  { to: '/', label: 'ข้อสอบ', icon: '📝', end: true },
  { to: '/qa', label: 'ถาม-ตอบ', icon: '💬' },
  { to: '/admin', label: 'แอดมิน', icon: '🛠️', adminTab: true },
]

export default function BottomNav({ newCount = 0 }) {
  const { isAdmin } = useStore()

  return (
    <nav className="sticky bottom-0 z-20 border-t border-slate-800 bg-slate-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-md items-stretch">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs ${
                isActive ? 'text-indigo-400' : 'text-slate-400'
              }`
            }
          >
            <span className="text-xl">{t.icon}</span>
            <span>{t.label}</span>
            {t.adminTab && isAdmin && (
              <span className="absolute right-6 top-1.5 h-2 w-2 rounded-full bg-emerald-400" />
            )}
            {t.to === '/' && newCount > 0 && (
              <span className="absolute right-5 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                {newCount}
              </span>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
