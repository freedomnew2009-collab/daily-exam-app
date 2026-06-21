-- ============================================================
--  Migration 003 — หมวดข้อสอบ + คลังข้อสอบ + ข้อความให้กำลังใจ (ตั้งค่าโดยแอดมิน)
--  วิธีใช้: Supabase Dashboard -> SQL Editor -> วางทั้งไฟล์นี้ -> Run
--  (รันซ้ำได้ ปลอดภัย ไม่ลบข้อมูลเดิม)
-- ============================================================

-- ---------- 1) หมวดของชุดข้อสอบ ----------
alter table exam_sets add column if not exists category text;

-- ---------- 2) ตารางตั้งค่าทั่วไปของแอป (key-value) ----------
create table if not exists app_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

alter table app_settings enable row level security;

-- อ่านได้ทุกคน (เช่น ข้อความให้กำลังใจ)
drop policy if exists p_settings_sel on app_settings;
create policy p_settings_sel on app_settings for select using (true);

-- เพิ่ม/แก้ไขได้เฉพาะแอดมิน (login ผ่าน Supabase Auth)
drop policy if exists p_settings_ins on app_settings;
create policy p_settings_ins on app_settings for insert
  with check (auth.uid() is not null);
drop policy if exists p_settings_upd on app_settings;
create policy p_settings_upd on app_settings for update
  using (auth.uid() is not null) with check (auth.uid() is not null);

-- ---------- 3) สร้างชุดข้อสอบ (รองรับหมวด) ----------
-- เพิ่มพารามิเตอร์ p_category จึง drop ของเดิมก่อน
drop function if exists create_exam_set(int, text, boolean, jsonb);
drop function if exists create_exam_set(int, text, boolean, jsonb, text);
create function create_exam_set(
  p_day int, p_title text, p_published boolean, p_questions jsonb, p_category text default ''
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_set_id uuid;
  rec jsonb;
  v_q_id uuid;
  v_idx int := 0;
begin
  if auth.uid() is null then
    raise exception 'unauthorized: admin only';
  end if;

  insert into exam_sets(day_number, title, published, question_count, created_by, category)
  values (p_day, p_title, p_published, jsonb_array_length(p_questions), auth.uid(),
          nullif(btrim(p_category), ''))
  returning id into v_set_id;

  for rec in select * from jsonb_array_elements(p_questions) loop
    insert into questions(exam_set_id, order_index, question_text, choices, image_url)
    values (v_set_id, v_idx, rec->>'question_text', rec->'choices',
            nullif(rec->>'image_url', ''))
    returning id into v_q_id;

    insert into question_keys(question_id, correct_choice, explanation)
    values (v_q_id, rec->>'correct_choice', rec->>'explanation');

    v_idx := v_idx + 1;
  end loop;

  return v_set_id;
end;
$$;
grant execute on function create_exam_set(int, text, boolean, jsonb, text) to authenticated;
