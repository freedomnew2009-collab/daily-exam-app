import { useEffect, useState, useCallback } from 'react'
import { useStore } from '../store'
import { supabase, isConfigured } from '../lib/supabase'
import { Spinner, Button, Badge, Empty } from '../components/ui'

function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso)) / 1000)
  if (s < 60) return 'เมื่อสักครู่'
  if (s < 3600) return `${Math.floor(s / 60)} นาทีที่แล้ว`
  if (s < 86400) return `${Math.floor(s / 3600)} ชม.ที่แล้ว`
  return `${Math.floor(s / 86400)} วันที่แล้ว`
}

function Thread({ thread, isAdmin, currentUserId, onReply, onDeleteThread, onDeleteReply }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  const send = async () => {
    if (!text.trim()) return
    setBusy(true)
    await onReply(thread.id, text.trim())
    setText('')
    setBusy(false)
    setOpen(true)
  }

  return (
    <div className="animate-rise rounded-3xl border border-white bg-white/80 p-4 shadow-lg shadow-violet-200/40 backdrop-blur">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <Badge color={thread.is_public ? 'indigo' : 'amber'}>
          {thread.is_public ? '🌐 สาธารณะ' : '🔒 Private'}
        </Badge>
        {!thread.is_public && (
          <span className="text-[11px] text-amber-600">เห็นเฉพาะคุณกับแอดมิน</span>
        )}
        {/* ไม่ระบุชื่อผู้ถามในโหมดสาธารณะ */}
        <span className="text-xs text-slate-400">
          {thread.is_public ? 'ไม่ระบุชื่อ' : isAdmin ? thread.username || 'ผู้ใช้' : 'คุณ'} ·{' '}
          {timeAgo(thread.created_at)}
        </span>
        {isAdmin && (
          <button
            onClick={() => onDeleteThread(thread.id)}
            className="ml-auto rounded-lg bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-600 hover:bg-rose-200"
            title="ลบกระทู้นี้ทั้งหมด"
          >
            🗑 ลบ
          </button>
        )}
      </div>
      <p className="leading-relaxed text-slate-800">{thread.body}</p>

      {/* คำตอบ */}
      {thread.replies?.length > 0 && (
        <div className="mt-3 space-y-2 border-l-2 border-violet-200 pl-3">
          {thread.replies.map((r) => (
            <div key={r.id}>
              <div className="flex items-center gap-2">
                {r.is_admin ? (
                  <Badge color="green">👑 แอดมิน</Badge>
                ) : (
                  <span className="text-xs text-slate-400">
                    {thread.is_public ? 'ไม่ระบุชื่อ' : 'ตอบกลับ'}
                  </span>
                )}
                <span className="text-xs text-slate-400">{timeAgo(r.created_at)}</span>
                {isAdmin && (
                  <button
                    onClick={() => onDeleteReply(r.id)}
                    className="ml-auto text-xs font-semibold text-rose-500 hover:underline"
                    title="ลบคำตอบนี้"
                  >
                    🗑 ลบ
                  </button>
                )}
              </div>
              <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{r.body}</p>
            </div>
          ))}
        </div>
      )}

      {/* ช่องตอบ: ทุกคนตอบ public ได้, ส่วน private ตอบได้เฉพาะแอดมินหรือเจ้าของ */}
      {(thread.is_public || isAdmin || thread.user_id === currentUserId) && (
        <div className="mt-3">
          {open ? (
            <div className="flex gap-2">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={isAdmin ? 'ตอบในนามแอดมิน…' : 'ร่วมตอบ…'}
                className="flex-1 rounded-xl border-2 border-violet-100 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-violet-400"
                onKeyDown={(e) => e.key === 'Enter' && send()}
              />
              <Button onClick={send} disabled={busy} className="px-4 py-2 text-sm">
                ส่ง
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setOpen(true)}
              className="text-sm font-semibold text-violet-600 hover:underline"
            >
              💬 ตอบกลับ
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function QA() {
  const { user, isAdmin, logoutUser, adminSignOut } = useStore()

  const logoutAll = async () => {
    if (isAdmin) await adminSignOut()
    logoutUser()
  }
  const [tab, setTab] = useState('public') // 'public' | 'private'
  const [loading, setLoading] = useState(true)
  const [threads, setThreads] = useState([])
  const [newQ, setNewQ] = useState('')
  const [posting, setPosting] = useState(false)
  const [ph, setPh] = useState({ public: '', private: '' }) // ข้อความตัวอย่างที่แอดมินตั้งค่า

  // โหลดข้อความ placeholder ในช่องถาม (ตั้งค่าจากหน้าแอดมิน)
  useEffect(() => {
    if (!isConfigured) return
    ;(async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['qa_public_placeholder', 'qa_private_placeholder'])
      const m = {}
      for (const r of data || []) m[r.key] = r.value
      setPh({
        public: m['qa_public_placeholder'] || '',
        private: m['qa_private_placeholder'] || '',
      })
    })()
  }, [])

  const load = useCallback(async () => {
    if (!isConfigured) {
      setLoading(false)
      return
    }
    setLoading(true)

    // Private: ดึงผ่าน RPC (คืนเฉพาะของ user คนนี้ หรือทั้งหมดถ้าเป็นแอดมิน) พร้อม replies
    if (tab === 'private') {
      const { data } = await supabase.rpc('get_private_threads', { p_user_id: user.id })
      setThreads(data || [])
      setLoading(false)
      return
    }

    // Public: ไม่ดึง user_id มาเลย -> ไม่มีทางรู้ว่าใครถาม/ตอบ (นิรนามจริง)
    const { data: ths } = await supabase
      .from('qa_threads')
      .select('id, body, is_public, created_at')
      .eq('is_public', true)
      .order('created_at', { ascending: false })

    const ids = (ths || []).map((t) => t.id)
    let replies = []
    if (ids.length) {
      const { data: rs } = await supabase
        .from('qa_replies')
        .select('id, thread_id, body, is_admin, created_at')
        .in('thread_id', ids)
        .order('created_at', { ascending: true })
      replies = rs || []
    }
    const byThread = {}
    for (const r of replies) (byThread[r.thread_id] ||= []).push(r)
    setThreads((ths || []).map((t) => ({ ...t, replies: byThread[t.id] || [] })))
    setLoading(false)
  }, [tab, user.id])

  useEffect(() => {
    load()
    if (!isConfigured) return
    const ch = supabase
      .channel('qa_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'qa_threads' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'qa_replies' }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [load])

  const ask = async () => {
    if (!newQ.trim()) return
    setPosting(true)
    await supabase.from('qa_threads').insert({
      user_id: user.id,
      body: newQ.trim(),
      is_public: tab === 'public',
    })
    setNewQ('')
    setPosting(false)
    load()
  }

  const reply = async (threadId, body) => {
    await supabase.from('qa_replies').insert({
      thread_id: threadId,
      user_id: user.id,
      body,
      is_admin: isAdmin,
    })
    load()
  }

  // แอดมินลบกระทู้/คำตอบ
  const deleteThread = async (id) => {
    if (!confirm('ลบกระทู้นี้และคำตอบทั้งหมด?')) return
    await supabase.from('qa_threads').delete().eq('id', id)
    load()
  }
  const deleteReply = async (id) => {
    if (!confirm('ลบคำตอบนี้?')) return
    await supabase.from('qa_replies').delete().eq('id', id)
    load()
  }

  return (
    <div className="px-4 pt-4">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-extrabold text-slate-800">
          <span className="animate-float">💬</span> ถาม-ตอบ
        </h1>
        <button
          onClick={logoutAll}
          className="rounded-xl border-2 border-violet-200 px-3 py-1.5 text-sm font-semibold text-violet-700 hover:bg-violet-50"
        >
          ↩ ออก
        </button>
      </div>

      <div className="mb-4 flex rounded-2xl bg-white/70 p-1 shadow-md shadow-violet-200/40">
        <button
          onClick={() => setTab('public')}
          className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition ${
            tab === 'public'
              ? 'bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-md shadow-violet-300/50'
              : 'text-slate-500'
          }`}
        >
          🌐 สาธารณะ
        </button>
        <button
          onClick={() => setTab('private')}
          className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition ${
            tab === 'private'
              ? 'bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-md shadow-violet-300/50'
              : 'text-slate-500'
          }`}
        >
          🔒 ถามแอดมิน
        </button>
      </div>

      {/* กล่องถาม */}
      <div className="mb-4 rounded-3xl border border-white bg-white/80 p-3 shadow-lg shadow-violet-200/40 backdrop-blur">
        <textarea
          value={newQ}
          onChange={(e) => setNewQ(e.target.value)}
          rows={2}
          placeholder={
            tab === 'public'
              ? ph.public || 'ถามแบบสาธารณะ (ทุกคนเห็น แต่ไม่ระบุชื่อคุณ)…'
              : ph.private || 'ส่งคำถามถึงแอดมินแบบส่วนตัว…'
          }
          className="w-full resize-none rounded-2xl border-2 border-violet-100 bg-white p-2.5 text-sm text-slate-800 outline-none transition focus:border-violet-400"
        />
        <div className="mt-2 flex justify-end">
          <Button onClick={ask} disabled={posting || !newQ.trim()} className="px-4 py-2 text-sm">
            {posting ? 'กำลังส่ง…' : tab === 'public' ? 'ถามสาธารณะ' : 'ส่งถึงแอดมิน'}
          </Button>
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : threads.length === 0 ? (
        <Empty
          icon="💬"
          title={tab === 'public' ? 'ยังไม่มีคำถามสาธารณะ' : 'ยังไม่มีคำถามส่วนตัว'}
          hint="เริ่มถามคำถามแรกได้เลย"
        />
      ) : (
        <div className="space-y-3 pb-4">
          {threads.map((t) => (
            <Thread
              key={t.id}
              thread={t}
              isAdmin={isAdmin}
              currentUserId={user.id}
              onReply={reply}
              onDeleteThread={deleteThread}
              onDeleteReply={deleteReply}
            />
          ))}
        </div>
      )}
    </div>
  )
}
