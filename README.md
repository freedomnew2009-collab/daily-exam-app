# 📝 ข้อสอบรายวัน (Daily Exam PWA)

แอป/เว็บทำข้อสอบวันละ ~5 ข้อ พร้อมเฉลย ระบบผู้ใช้แบบไม่ต้องสมัคร และถาม-ตอบ
ออกแบบ **มือถือเป็นหลัก** ติดตั้งเป็นแอป (PWA) ได้

สแตก: **Vite + React + Tailwind + Supabase + GitHub Pages**

---

## ✨ ฟีเจอร์

| # | ความสามารถ |
|---|---|
| 1 | แอดมิน login เพิ่ม/แก้ไข/เผยแพร่ชุดข้อสอบได้ตลอด |
| 2 | ชุดข้อสอบเป็น "วันที่ 1, 2, 3…" (ไม่อ้างวันจริง) ทำใหม่ได้ — ดูเฉลยได้เฉพาะหลังทำแล้ว |
| 3 | ทำข้อสอบทีละข้อ + ช่องใส่เหตุผลว่าทำไมเลือกข้อนี้ |
| 4 | ถาม-ตอบ **สาธารณะ** (ทุกคนเห็น ไม่ระบุชื่อ) และ **ส่วนตัวถึงแอดมิน** |
| 5 | แจ้งเตือนเมื่อมีข้อสอบใหม่ (Realtime + Notification) |

> 🔐 ความปลอดภัย: เฉลยเก็บแยกตาราง อ่านผ่าน RPC ที่ตรวจว่า "เคยทำแล้ว" เท่านั้น — ผู้ใช้ดึงเฉลยล่วงหน้าไม่ได้

---

## 🚀 ติดตั้งใช้งาน (3 ขั้น)

### 1) สร้างฐานข้อมูล Supabase
1. สมัคร/เข้า [supabase.com](https://supabase.com) → **New project** (ฟรี)
2. ไปที่ **SQL Editor** → วางทั้งไฟล์ [`supabase/schema.sql`](supabase/schema.sql) → **Run**
3. สร้างบัญชีแอดมิน: **Authentication → Users → Add user** (ใส่อีเมล+รหัสผ่าน, ติ๊ก Auto confirm)
4. คัดลอกค่า **Project Settings → API**: `Project URL` และ `anon public key`

### 2) รันบนเครื่อง
```bash
npm install
cp .env.example .env      # แล้วใส่ค่า URL + anon key ลงใน .env
npm run dev
```
เปิด http://localhost:5173

### 3) ขึ้น GitHub Pages (ง่ายสุด — ไม่ต้องตั้ง secret)
ใส่ค่า Supabase ใน `.env` แล้วสั่ง:
```bash
npm run deploy
```
คำสั่งนี้ build (ฝังค่าจาก `.env`) แล้ว push ไฟล์ที่ build เสร็จขึ้น branch `gh-pages` ให้อัตโนมัติ

จากนั้นครั้งแรกครั้งเดียว: ไปที่ repo → **Settings → Pages → Source = Deploy from a branch → Branch = `gh-pages` / root** → Save

เว็บจะอยู่ที่: `https://<username>.github.io/daily-exam-app/`
อยากอัปเดตเว็บเมื่อไหร่ก็แค่สั่ง `npm run deploy` อีกครั้ง

> ถ้าชื่อ repo ไม่ใช่ `daily-exam-app` ให้แก้ค่า `REPO` ใน [`vite.config.js`](vite.config.js)

---

## 🧪 ทดลองใช้
- **ผู้ใช้**: พิมพ์ชื่อ → ทำข้อสอบ → ใส่เหตุผล → ส่ง → ดูเฉลย
- **แอดมิน**: แท็บ "แอดมิน" → login → เพิ่มชุดข้อสอบ (ตั้งคำตอบถูกด้วยการแตะวงกลม A/B/C/D)
- **ติดตั้งเป็นแอป**: เปิดบนมือถือ → เมนูเบราว์เซอร์ → "เพิ่มลงในหน้าจอหลัก"

## 📁 โครงสร้าง
```
src/
  pages/      Login, Home, Quiz, Review, QA, Admin
  components/ BottomNav, ui
  lib/        supabase, notify
  store.jsx   state ผู้ใช้ + แอดมิน
supabase/schema.sql   ตาราง + RLS + RPC
```
