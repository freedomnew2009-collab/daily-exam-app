import { NavLink } from 'react-router-dom'
import { useStore } from '../store'

const tabs = [
  { to: '/', label: 'ข้อสอบ', icon: '📝', end: true },
  { to: '/library', label: 'คลัง', icon: '📚' },
  { to: '/practice', label: 'ฝึกซ้อม', icon: '🎯' },
  { to: '/articles', label: 'บทความ', icon: '📰', articleTab: true },
  { to: '/qa', label: 'ถาม-ตอบ', icon: '💬' },
  { to: '/admin', label: 'แอดมิน', icon: '🛠️', adminTab: true },
]

export default function BottomNav({ newCount = 0, articleCount = 0 }) {
  const { isAdmin } = useStore()

  return (
    <nav className="sticky bottom-0 z-20 border-t border-violet-100 bg-white/85 backdrop-blur-lg">
      <div className="mx-auto flex max-w-md items-stretch">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-semibold transition ${
                isActive ? 'text-violet-600' : 'text-slate-400'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-2xl text-xl transition ${
                    isActive ? 'scale-110 bg-violet-100' : ''
                  }`}
                >
                  {t.icon}
                </span>
                <span>{t.label}</span>
                {t.adminTab && isAdmin && (
                  <span className="absolute right-5 top-1 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-white" />
                )}
                {t.to === '/' && newCount > 0 && (
                  <span className="absolute right-4 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-gradient-to-r from-rose-500 to-pink-500 px-1 text-[10px] font-bold text-white shadow-md shadow-rose-300/50">
                    {newCount}
                  </span>
                )}
                {t.articleTab && articleCount > 0 && (
                  <span className="absolute right-3 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-gradient-to-r from-rose-500 to-pink-500 px-1 text-[10px] font-bold text-white shadow-md shadow-rose-300/50">
                    {articleCount}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
