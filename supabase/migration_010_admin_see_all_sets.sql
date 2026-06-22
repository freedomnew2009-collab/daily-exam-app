-- ============================================================
--  Migration 010 — แอดมินทุกคนเห็นชุดข้อสอบทั้งหมด (ไม่ว่าใครสร้าง)
--  วิธีใช้: Supabase Dashboard -> SQL Editor -> วางทั้งไฟล์นี้ -> Run
--  (รันซ้ำได้ ปลอดภัย)
--
--  ถ้า DB เดิมตั้ง policy ให้เห็นเฉพาะชุดที่ตัวเองสร้าง (created_by = auth.uid())
--  ไฟล์นี้จะแก้ให้แอดมินที่ล็อกอินทุกคนเห็น/แก้ไข/ลบชุดข้อสอบได้ทุกชุด
-- ============================================================

alter table exam_sets enable row level security;

-- อ่านได้ถ้าเผยแพร่แล้ว หรือเป็นแอดมินที่ล็อกอิน (เห็นทุกชุดไม่ว่าใครสร้าง)
drop policy if exists p_sets_sel on exam_sets;
create policy p_sets_sel on exam_sets for select
  using (published = true or auth.uid() is not null);

-- แก้ไข/ลบ: แอดมินที่ล็อกอินทำได้ทุกชุด
drop policy if exists p_sets_upd on exam_sets;
create policy p_sets_upd on exam_sets for update
  using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists p_sets_del on exam_sets;
create policy p_sets_del on exam_sets for delete using (auth.uid() is not null);

-- คำถาม + เฉลย: ให้แอดมินอ่านได้ทุกข้อ (เพื่อโหลดมาแก้ไข)
drop policy if exists p_q_sel on questions;
create policy p_q_sel on questions for select using (true);

drop policy if exists p_keys_sel on question_keys;
create policy p_keys_sel on question_keys for select using (auth.uid() is not null);
