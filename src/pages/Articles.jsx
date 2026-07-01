import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store'
import { supabase, isConfigured } from '../lib/supabase'
import { getLastSeenArticles, setLastSeenArticles } from '../lib/notify'
import { Spinner, Badge, Empty } from '../components/ui'
import { playFinishSound } from '../lib/sound'

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// ---------- รายการบทความ ----------
export default function Articles({ onSeen }) {
  const { user, isAdmin, logoutUser, adminSignOut } = useStore()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [articles, setArticles] = useState([])
  const [readIds, setReadIds] = useState(new Set())
  const [stats, setStats] = useState({}) // articleId -> { viewers, stars }
  const [lastSeenAtLoad] = useState(getLastSeenArticles())

  const logoutAll = async () => {
    if (isAdmin) await adminSignOut()
    logoutUser()
  }

  const load = useCallback(async () => {
    if (!isConfigured) {
      setLoading(false)
      return
    }
    setLoading(true)
    const [{ data }, { data: read }, { data: statData }] = await Promise.all([
      supabase
        .from('articles')
        .select('id, title, body, cover_url, images, created_at')
        .eq('published', true)
        .order('created_at', { ascending: false }),
      supabase.rpc('get_read_articles', { p_user_id: user.id }),
      supabase.rpc('get_article_stats'),
    ])
    setArticles(data || [])
    setReadIds(new Set(Array.isArray(read) ? read : []))
    setStats(statData && typeof statData === 'object' ? statData : {})
    setLoading(false)

    // มาถึงหน้านี้ = เห็นบทความใหม่แล้ว
    setLastSeenArticles(new Date().toISOString())
    onSeen?.()
  }, [onSeen, user.id])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <Spinner />

  return (
    <div className="px-4 pt-4">
      <header className="animate-rise mb-5 flex items-center justify-between rounded-3xl bg-gradient-to-r from-sky-500 to-violet-500 p-4 text-white shadow-lg shadow-sky-300/50">
        <div className="min-w-0">
          <p className="text-xs text-white/80">
            {articles.length > 0
              ? `⭐ อ่านจบแล้ว ${articles.filter((a) => readIds.has(a.id)).length}/${articles.length} บทความ`
              : 'ความรู้ดี ๆ จากแอดมิน'}
          </p>
          <h1 className="text-lg font-extrabold">📰 บทความ</h1>
        </div>
        <button
          onClick={logoutAll}
          className="flex-shrink-0 rounded-xl bg-white/20 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/30"
        >
          ↩ ออก
        </button>
      </header>

      {articles.length === 0 ? (
        <Empty
          icon="📰"
          title="ยังไม่มีบทความ"
          hint={isAdmin ? 'ไปที่แท็บแอดมินเพื่อเขียนบทความ' : 'รอแอดมินมาแบ่งปันความรู้เร็ว ๆ นี้'}
        />
      ) : (
        <div className="space-y-3 pb-4">
          {articles.map((a) => {
            const isNew = new Date(a.created_at) > new Date(lastSeenAtLoad)
            const isRead = readIds.has(a.id)
            return (
              <button
                key={a.id}
                onClick={() => navigate(`/articles/${a.id}`)}
                className={`animate-rise relative block w-full overflow-hidden rounded-3xl border text-left shadow-lg shadow-violet-200/40 backdrop-blur ${
                  isRead ? 'border-amber-200 bg-amber-50/70' : 'border-white bg-white/80'
                }`}
              >
                {isRead && (
                  <span className="absolute right-2 top-2 z-10 rounded-full bg-amber-400 px-2 py-1 text-xs font-bold text-white shadow">
                    ⭐ อ่านจบแล้ว
                  </span>
                )}
                {a.cover_url && (
                  <img src={a.cover_url} alt="" className="h-36 w-full object-cover" loading="lazy" />
                )}
                <div className="p-4">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    {isNew && <Badge color="red">✨ ใหม่</Badge>}
                    <span className="text-xs text-slate-400">{fmtDate(a.created_at)}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-500">
                      👤 {stats[a.id]?.viewers ?? 0} คน
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-500">
                      ⭐ {stats[a.id]?.stars ?? 0}
                    </span>
                  </div>
                  <p className="font-bold leading-snug text-slate-800">{a.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-500">{a.body}</p>
                  <p className="mt-2 text-sm font-bold text-violet-600">อ่านต่อ →</p>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---------- อ่านบทความเต็ม ----------
export function ArticleView() {
  const { id } = useParams()
  const { user } = useStore()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [article, setArticle] = useState(null)
  const [read, setRead] = useState(false) // อ่านจบแล้วหรือยัง
  const [claiming, setClaiming] = useState(false)
  const [reward, setReward] = useState(null) // { total } เมื่อเพิ่งรับดาว
  const [stat, setStat] = useState({ viewers: 0, stars: 0 })

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      // นับผู้เข้าอ่าน (ไม่ซ้ำคน) ก่อน แล้วค่อยดึงสถิติให้รวมตัวเราด้วย
      await supabase.rpc('mark_article_view', { p_user_id: user.id, p_article_id: id }).then(
        () => {},
        () => {}
      )
      const [{ data }, { data: readIds }, { data: statData }] = await Promise.all([
        supabase
          .from('articles')
          .select('id, title, body, cover_url, images, created_at')
          .eq('id', id)
          .maybeSingle(),
        supabase.rpc('get_read_articles', { p_user_id: user.id }),
        supabase.rpc('get_article_stats'),
      ])
      setArticle(data)
      setRead(Array.isArray(readIds) && readIds.includes(id))
      setStat(statData?.[id] || { viewers: 0, stars: 0 })
      setLoading(false)
    })()
  }, [id, user.id])

  const claimStar = async () => {
    if (claiming || read) return
    setClaiming(true)
    const { data, error } = await supabase.rpc('mark_article_read', {
      p_user_id: user.id,
      p_article_id: id,
    })
    setClaiming(false)
    if (error) return
    setRead(true)
    setStat((s) => ({ ...s, stars: (s.stars || 0) + 1 }))
    setReward({ total: data?.total_read ?? 1 })
    playFinishSound(1)
  }

  if (loading) return <Spinner />
  if (!article)
    return <Empty icon="🔍" title="ไม่พบบทความนี้" hint="อาจถูกลบหรือยังไม่เผยแพร่" />

  const imgs =
    Array.isArray(article.images) && article.images.length
      ? article.images
      : article.cover_url
        ? [article.cover_url]
        : []

  return (
    <div className="px-4 pt-4 pb-6">
      <button
        onClick={() => navigate('/articles')}
        className="mb-3 rounded-lg bg-white/70 px-3 py-1.5 text-sm font-semibold text-violet-600 shadow-sm"
      >
        ← กลับไปบทความ
      </button>

      {imgs[0] && (
        <img
          src={imgs[0]}
          alt=""
          className="mb-4 max-h-72 w-full rounded-3xl border border-violet-100 object-cover shadow-sm"
        />
      )}

      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <span>{fmtDate(article.created_at)}</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 font-semibold text-violet-500">
          👤 {stat.viewers ?? 0} คนอ่าน
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-500">
          ⭐ {stat.stars ?? 0} ดาว
        </span>
      </div>
      <h1 className="mt-1 text-2xl font-extrabold leading-snug text-slate-800">{article.title}</h1>

      <div className="mt-4 space-y-2 text-[15px] leading-relaxed text-slate-700">
        {String(article.body || '')
          .split(/\[\[img:(.*?)\]\]/g)
          .map((seg, i) => {
            if (!seg) return null
            if (i % 2 === 1) {
              return (
                <a key={i} href={seg} target="_blank" rel="noreferrer" className="block">
                  <img
                    src={seg}
                    alt="รูปประกอบบทความ"
                    className="my-3 w-full rounded-2xl border border-violet-100 object-contain shadow-sm"
                    loading="lazy"
                  />
                </a>
              )
            }
            return (
              <p key={i} className="whitespace-pre-wrap">
                {seg}
              </p>
            )
          })}
      </div>

      {/* รูปประกอบเพิ่มเติม */}
      {imgs.length > 1 && (
        <div className="mt-5 space-y-3">
          {imgs.slice(1).map((url) => (
            <img
              key={url}
              src={url}
              alt=""
              className="w-full rounded-2xl border border-violet-100 object-contain"
              loading="lazy"
            />
          ))}
        </div>
      )}

      {/* รางวัลเมื่ออ่านจบ */}
      <div className="mt-8 flex flex-col items-center">
        {read ? (
          <div className="flex flex-col items-center gap-1 rounded-2xl border-2 border-amber-200 bg-amber-50 px-6 py-4">
            <span className="text-4xl">⭐</span>
            <p className="font-bold text-amber-700">อ่านจบแล้ว — เก่งมาก!</p>
          </div>
        ) : (
          <button
            onClick={claimStar}
            disabled={claiming}
            className="animate-pop rounded-2xl bg-gradient-to-r from-amber-400 to-orange-400 px-6 py-3.5 text-base font-extrabold text-white shadow-lg shadow-amber-300/50 active:scale-95 disabled:opacity-60"
          >
            {claiming ? 'กำลังบันทึก…' : '📖 อ่านจบแล้ว — รับดาว ⭐'}
          </button>
        )}
        <p className="mt-3 text-center text-sm text-slate-400">— จบบทความ — 🌟</p>
      </div>

      {/* ป๊อปอัปฉลองรับดาว (ครั้งแรก) */}
      {reward && (
        <div
          onClick={() => setReward(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6 backdrop-blur-sm"
        >
          <div className="animate-pop relative max-w-xs rounded-3xl bg-white p-7 text-center shadow-2xl">
            <div className="mb-1 flex justify-center gap-1 text-3xl">
              <span className="animate-float">⭐</span>
              <span className="animate-float text-5xl" style={{ animationDelay: '0.1s' }}>
                🌟
              </span>
              <span className="animate-float" style={{ animationDelay: '0.2s' }}>
                ⭐
              </span>
            </div>
            <h2 className="text-xl font-extrabold text-violet-700">เก่งมาก! อ่านจบแล้ว 🎉</h2>
            <p className="mt-1 text-sm text-slate-500">
              ได้รับดาวเพิ่ม 1 ดวง · อ่านจบไปแล้วทั้งหมด{' '}
              <b className="text-amber-500">{reward.total}</b> บทความ
            </p>
            <button
              onClick={() => setReward(null)}
              className="mt-4 rounded-2xl bg-violet-500 px-6 py-2.5 font-bold text-white hover:bg-violet-600"
            >
              เยี่ยมไปเลย! 🙌
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
