import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store'
import { supabase, isConfigured } from '../lib/supabase'
import { getLastSeenArticles, setLastSeenArticles } from '../lib/notify'
import { Spinner, Badge, Empty, Card } from '../components/ui'

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
      .select('id, title, body, cover_url, created_at')
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
              <button key={a.id} onClick={() => navigate(`/articles/${a.id}`)} className="block w-full text-left">
                <Card className="animate-rise overflow-hidden p-0">
                  {a.cover_url && (
                    <img
                      src={a.cover_url}
                      alt=""
                      className="h-36 w-full object-cover"
                      loading="lazy"
                    />
                  )}
                  <div className="p-4">
                    <div className="mb-1 flex items-center gap-2">
                      {isNew && <Badge color="red">✨ ใหม่</Badge>}
                      <span className="text-xs text-slate-400">{fmtDate(a.created_at)}</span>
                    </div>
                    <p className="font-bold leading-snug text-slate-800">{a.title}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-500">{a.body}</p>
                    <p className="mt-2 text-sm font-bold text-violet-600">อ่านต่อ →</p>
                  </div>
                </Card>
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
        .select('id, title, body, cover_url, created_at')
        .eq('id', id)
        .maybeSingle()
      setArticle(data)
      setLoading(false)
    })()
  }, [id])

  if (loading) return <Spinner />
  if (!article)
    return <Empty icon="🔍" title="ไม่พบบทความนี้" hint="อาจถูกลบหรือยังไม่เผยแพร่" />

  return (
    <div className="px-4 pt-4 pb-6">
      <button
        onClick={() => navigate('/articles')}
        className="mb-3 rounded-lg bg-white/70 px-3 py-1.5 text-sm font-semibold text-violet-600 shadow-sm"
      >
        ← กลับไปบทความ
      </button>

      {article.cover_url && (
        <img
          src={article.cover_url}
          alt=""
          className="mb-4 max-h-72 w-full rounded-3xl border border-violet-100 object-cover shadow-sm"
        />
      )}

      <p className="text-xs text-slate-400">{fmtDate(article.created_at)}</p>
      <h1 className="mt-1 text-2xl font-extrabold leading-snug text-slate-800">{article.title}</h1>

      <div className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed text-slate-700">
        {article.body}
      </div>

      <p className="mt-8 text-center text-sm text-slate-400">— จบบทความ — 🌟</p>
    </div>
  )
}
