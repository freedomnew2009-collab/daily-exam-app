import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store'
import { supabase, isConfigured } from '../lib/supabase'
import { getLastSeenArticles, setLastSeenArticles } from '../lib/notify'
import { Spinner, Badge, Empty } from '../components/ui'

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// ---------- รายการบทความ ----------
export default function Articles({ onSeen }) {
  const { isAdmin, logoutUser, adminSignOut } = useStore()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [articles, setArticles] = useState([])
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
    const { data } = await supabase
      .from('articles')
      .select('id, title, body, cover_url, images, views, created_at')
      .eq('published', true)
      .order('created_at', { ascending: false })
    setArticles(data || [])
    setLoading(false)

    // มาถึงหน้านี้ = เห็นบทความใหม่แล้ว
    setLastSeenArticles(new Date().toISOString())
    onSeen?.()
  }, [onSeen])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <Spinner />

  return (
    <div className="px-4 pt-4">
      <header className="animate-rise mb-5 flex items-center justify-between rounded-3xl bg-gradient-to-r from-sky-500 to-violet-500 p-4 text-white shadow-lg shadow-sky-300/50">
        <div className="min-w-0">
          <p className="text-xs text-white/80">ความรู้ดี ๆ จากแอดมิน</p>
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
            return (
              <button
                key={a.id}
                onClick={() => navigate(`/articles/${a.id}`)}
                className="animate-rise block w-full overflow-hidden rounded-3xl border border-white bg-white/80 text-left shadow-lg shadow-violet-200/40 backdrop-blur"
              >
                {a.cover_url && (
                  <img src={a.cover_url} alt="" className="h-36 w-full object-cover" loading="lazy" />
                )}
                <div className="p-4">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    {isNew && <Badge color="red">✨ ใหม่</Badge>}
                    <span className="text-xs text-slate-400">{fmtDate(a.created_at)}</span>
                    <span className="text-xs text-slate-400">· 👁 {a.views ?? 0} ครั้ง</span>
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
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [article, setArticle] = useState(null)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const { data } = await supabase
        .from('articles')
        .select('id, title, body, cover_url, images, views, created_at')
        .eq('id', id)
        .maybeSingle()
      setArticle(data)
      setLoading(false)
      // นับยอดเข้าอ่าน +1
      if (data) supabase.rpc('increment_article_views', { p_id: id })
    })()
  }, [id])

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

      <div className="flex items-center gap-2 text-xs text-slate-400">
        <span>{fmtDate(article.created_at)}</span>
        <span>· 👁 {(article.views ?? 0) + 1} ครั้ง</span>
      </div>
      <h1 className="mt-1 text-2xl font-extrabold leading-snug text-slate-800">{article.title}</h1>

      <div className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed text-slate-700">
        {article.body}
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

      <p className="mt-8 text-center text-sm text-slate-400">— จบบทความ — 🌟</p>
    </div>
  )
}
