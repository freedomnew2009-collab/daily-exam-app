import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// แจ้งเตือนตอน dev ถ้ายังไม่ได้ตั้งค่า .env
if (!url || !anonKey) {
  console.warn(
    '[supabase] ยังไม่ได้ตั้งค่า VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — ดู .env.example'
  )
}

export const supabase = createClient(url || 'http://localhost', anonKey || 'public-anon-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

export const isConfigured = Boolean(url && anonKey)
