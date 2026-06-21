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

function Thread({ thread, isAdmin, currentUserId, onReply }) {
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
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="mb-1 flex items-center gap-2">
        <Badge color={thread.is_public ? 'indigo' : 'amber'}>
          {thread.is_public ? '🌐 สาธารณะ' : '🔒 ถึงแอดมิน'}
        </Badge>
        {/* ไม่ระบุชื่อผู้ถามในโหมดสาธารณะ */}
        <span className="text-xs text-slate-500">
          {thread.is_public ? 'ไม่ระบุชื่อ' : isAdmin ? thread._username || 'ผู้ใช้' : 'คุณ'} ·{' '}
          {timeAgo(thread.created_at)}
        </span>
      </div>
      <p className="leading-relaxed text-white">{thread.body}</p>

      {/* คำตอบ */}
      {thread.replies?.length > 0 && (
        <div className="mt-3 space-y-2 border-l-2 border-slate-700 pl-3">
          {thread.replies.map((r) => (
            <div key={r.id}>
              <div className="flex items-center gap-2">
                {r.is_admin ? (
                  <Badge color="green">👑 แอดมิน</Badge>
                ) : (
                  <span className="text-xs text-slate-500">
                    {thread.is_public ? 'ไม่ระบุชื่อ' : 'ตอบกลับ'}
                  </span>
                )}
                <span className="text-xs text-slate-600">{timeAgo(r.created_at)}</span>
              </div>
              <p className="mt-0.5 text-sm leading-relaxed text-slate-200">{r.body}</p>
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
                className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                onKeyDown={(e) => e.key === 'Enter' && send()}
              />
              <Button onClick={send} disabled={busy} className="px-3 py-2 text-sm">
                ส่ง
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setOpen(true)}
              className="text-sm text-indigo-400 hover:underline"
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

  const load = useCallback(async () => {
    if (!isConfigured) {
      setLoading(false)
      return
    }
    setLoading(true)

    let tq = supabase
      .from('qa_threads')
      // โหมดสาธารณะ: ไม่ดึง user_id มาเลย -> ไม่มีทางรู้ว่าใครถาม/ตอบ (นิรนามจริง)
      .select(
        tab === 'public'
          ? 'id, body, is_public, created_at'
          : 'id, user_id, body, is_public, created_at'
      )
      .order('created_at', { ascending: false })

    if (tab === 'public') {
      tq = tq.eq('is_public', true)
    } else {
      // ส่วนตัว: แอดมินเห็นทั้งหมด, ผู้ใช้เห็นเฉพาะของตัวเอง
      tq = tq.eq('is_public', false)
      if (!isAdmin) tq = tq.eq('user_id', user.id)
    }

    const { data: ths } = await tq
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
  }, [tab, isAdmin, user.id])

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

  return (
    <div className="px-4 pt-4">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-white">ถาม-ตอบ</h1>
        <button
          onClick={logoutAll}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
        >
          ↩ ออกจากระบบ
        </button>
      </div>

      <div className="mb-4 flex rounded-xl bg-slate-800 p-1">
        <button
          onClick={() => setTab('public')}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
            tab === 'public' ? 'bg-indigo-600 text-white' : 'text-slate-300'
          }`}
        >
          🌐 สาธารณะ
        </button>
        <button
          onClick={() => setTab('private')}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
            tab === 'private' ? 'bg-indigo-600 text-white' : 'text-slate-300'
          }`}
        >
          🔒 ถามแอดมิน
        </button>
      </div>

      {/* กล่องถาม */}
      <div className="mb-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
        <textarea
          value={newQ}
          onChange={(e) => setNewQ(e.target.value)}
          rows={2}
          placeholder={
            tab === 'public'
              ? 'ถามแบบสาธารณะ (ทุกคนเห็น แต่ไม่ระบุชื่อคุณ)…'
              : 'ส่งคำถามถึงแอดมินแบบส่วนตัว…'
          }
          className="w-full resize-none rounded-lg border border-slate-700 bg-slate-900 p-2 text-sm text-white outline-none focus:border-indigo-500"
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
            />
          ))}
        </div>
      )}
    </div>
  )
}
