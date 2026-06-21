import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from './lib/supabase'

const Ctx = createContext(null)
export const useStore = () => useContext(Ctx)

const USER_KEY = 'exam_user'

function loadUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null')
  } catch {
    return null
  }
}

export function StoreProvider({ children }) {
  const [user, setUser] = useState(loadUser) // ผู้ทำข้อสอบ { id, username }
  const [adminSession, setAdminSession] = useState(null) // session ของ Supabase Auth (admin)
  const [ready, setReady] = useState(false)

  // โหลด session ของ admin (ถ้าเคย login ค้างไว้)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAdminSession(data.session)
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setAdminSession(session)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // เข้าระบบผู้ใช้: พิมพ์ชื่อ -> ถ้ามีอยู่แล้วใช้ซ้ำ ไม่มีก็สร้างใหม่ (ไม่ต้องยืนยันตัวตน)
  const loginUser = useCallback(async (rawName) => {
    const username = rawName.trim()
    if (!username) throw new Error('กรุณาใส่ชื่อ')

    // หาก่อนว่ามี username นี้หรือยัง
    const { data: existing, error: selErr } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('username', username)
      .maybeSingle()
    if (selErr) throw selErr

    let profile = existing
    if (!profile) {
      const { data: created, error: insErr } = await supabase
        .from('profiles')
        .insert({ username })
        .select('id, username')
        .single()
      if (insErr) throw insErr
      profile = created
    }

    localStorage.setItem(USER_KEY, JSON.stringify(profile))
    setUser(profile)
    return profile
  }, [])

  const logoutUser = useCallback(() => {
    localStorage.removeItem(USER_KEY)
    setUser(null)
  }, [])

  const adminSignIn = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    setAdminSession(data.session)
    return data.session
  }, [])

  const adminSignOut = useCallback(async () => {
    await supabase.auth.signOut()
    setAdminSession(null)
  }, [])

  const value = {
    user,
    isAdmin: Boolean(adminSession),
    adminEmail: adminSession?.user?.email || null,
    ready,
    loginUser,
    logoutUser,
    adminSignIn,
    adminSignOut,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
