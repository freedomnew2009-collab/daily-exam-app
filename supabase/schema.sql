-- ============================================================
--  ข้อสอบรายวัน — Supabase schema
--  วิธีใช้: เปิด Supabase Dashboard -> SQL Editor -> วางทั้งไฟล์นี้ -> Run
-- ============================================================

-- ---------- ตาราง ----------

-- ผู้ใช้ (ไม่ต้องยืนยันตัวตน — แค่ตั้งชื่อ)
create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  suspended boolean not null default false, -- แอดมินกดระงับได้
  exclude_stats boolean not null default false, -- ไม่นับในสถิติ/กราฟ (บัญชีทดสอบ/แอดมิน)
  created_at timestamptz not null default now()
);
alter table profiles add column if not exists exclude_stats boolean not null default false;
-- เผื่อ DB เดิมที่สร้างก่อนมีคอลัมน์นี้
alter table profiles add column if not exists suspended boolean not null default false;

-- ชุดข้อสอบ (วันละ ~5 ข้อ, ไม่อ้างอิงวันที่จริง ใช้ day_number)
create table if not exists exam_sets (
  id uuid primary key default gen_random_uuid(),
  day_number int not null,
  title text,
  category text, -- หมวดของชุดข้อสอบ (ใช้จัดกลุ่มในคลังข้อสอบ)
  question_count int not null default 0,
  published boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now()
);
-- เผื่อ DB เดิมที่สร้างก่อนมีคอลัมน์นี้
alter table exam_sets add column if not exists category text;

-- ตั้งค่าทั่วไปของแอป (key-value) เช่น ข้อความให้กำลังใจหลังทำข้อสอบ
create table if not exists app_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

-- คำถาม (ไม่มีคำตอบ/เฉลย เพื่อกันผู้ใช้ดึงไปดูก่อนทำ)
create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  exam_set_id uuid not null references exam_sets(id) on delete cascade,
  order_index int not null default 0,
  question_text text not null,
  image_url text, -- รูปประกอบคำถาม (ไม่บังคับ)
  category text,  -- หมวดของคำถามแต่ละข้อ (ไม่บังคับ)
  choices jsonb not null default '[]'::jsonb, -- mc:[{key,text}] · match:[{key,left,right}] · fill:[]
  q_type text not null default 'mc', -- ชนิดข้อสอบ: mc | fill | match
  created_at timestamptz not null default now()
);
-- เผื่อ DB เดิมที่สร้างก่อนมีคอลัมน์นี้
alter table questions add column if not exists image_url text;
alter table questions add column if not exists category text;
alter table questions add column if not exists q_type text not null default 'mc';

-- เฉลย (แยกตาราง — อ่านได้เฉพาะแอดมิน / ผ่าน RPC หลังทำเสร็จ)
create table if not exists question_keys (
  question_id uuid primary key references questions(id) on delete cascade,
  correct_choice text not null,
  explanation text,
  explanation_images jsonb not null default '[]'::jsonb -- รูปประกอบคำอธิบาย/เฉลย
);
alter table question_keys add column if not exists explanation_images jsonb not null default '[]'::jsonb;

-- การทำข้อสอบแต่ละครั้ง
create table if not exists attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  exam_set_id uuid not null references exam_sets(id) on delete cascade,
  score int not null default 0,
  total int not null default 0,
  duration_seconds int not null default 0, -- เวลาที่ใช้ทำทั้งชุด (วินาที)
  completed boolean not null default false,
  created_at timestamptz not null default now()
);
-- เผื่อ DB เดิมที่สร้างก่อนมีคอลัมน์นี้
alter table attempts add column if not exists duration_seconds int not null default 0;

-- คำตอบราย ข้อ (เก็บเหตุผลที่ผู้ใช้เลือกตอบ)
create table if not exists answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references attempts(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  selected_choice text,
  reason text,
  is_correct boolean not null default false,
  created_at timestamptz not null default now()
);

-- กระทู้ถาม-ตอบ (is_public=true แสดงทุกคนแบบไม่ระบุชื่อ, false=ส่วนตัวถึงแอดมิน)
create table if not exists qa_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  body text not null,
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists qa_replies (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references qa_threads(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null,
  body text not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- บทความความรู้จากแอดมิน (สมาชิกอ่านได้ + เด้งเตือนเมื่อมีใหม่)
create table if not exists articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  cover_url text,
  images jsonb not null default '[]'::jsonb, -- รูปประกอบหลายรูป
  views int not null default 0,             -- ยอดเข้าอ่าน
  published boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table articles add column if not exists images jsonb not null default '[]'::jsonb;
alter table articles add column if not exists views int not null default 0;

create index if not exists idx_questions_set on questions(exam_set_id);
create index if not exists idx_attempts_user on attempts(user_id, exam_set_id);
create index if not exists idx_replies_thread on qa_replies(thread_id);
create index if not exists idx_articles_pub on articles(published, created_at desc);

-- ---------- เปิด Row Level Security ----------
alter table profiles enable row level security;
alter table exam_sets enable row level security;
alter table questions enable row level security;
alter table question_keys enable row level security;
alter table attempts enable row level security;
alter table answers enable row level security;
alter table qa_threads enable row level security;
alter table qa_replies enable row level security;
alter table app_settings enable row level security;
alter table articles enable row level security;

-- profiles: ใครก็อ่าน/สร้างได้ (ระบบไม่ต้องยืนยันตัวตน) แต่อัปเดต (ระงับ) ได้เฉพาะแอดมิน
drop policy if exists p_profiles_sel on profiles;
create policy p_profiles_sel on profiles for select using (true);
drop policy if exists p_profiles_ins on profiles;
create policy p_profiles_ins on profiles for insert with check (true);
drop policy if exists p_profiles_upd on profiles;
create policy p_profiles_upd on profiles for update
  using (auth.uid() is not null) with check (auth.uid() is not null);

-- exam_sets: อ่านได้ถ้าเผยแพร่แล้ว (หรือเป็นแอดมินที่ล็อกอิน)
drop policy if exists p_sets_sel on exam_sets;
create policy p_sets_sel on exam_sets for select
  using (published = true or auth.uid() is not null);
-- แก้ไข/ลบ: เฉพาะแอดมิน (ผู้ใช้ที่ login ผ่าน Supabase Auth)
drop policy if exists p_sets_upd on exam_sets;
create policy p_sets_upd on exam_sets for update
  using (auth.uid() is not null) with check (auth.uid() is not null);
drop policy if exists p_sets_del on exam_sets;
create policy p_sets_del on exam_sets for delete using (auth.uid() is not null);

-- questions: อ่านได้ทุกคน (ไม่มีเฉลยในตารางนี้)
drop policy if exists p_q_sel on questions;
create policy p_q_sel on questions for select using (true);

-- question_keys: อ่านได้เฉพาะแอดมิน (ผู้ใช้ทั่วไปดูเฉลยผ่าน RPC get_review เท่านั้น)
drop policy if exists p_keys_sel on question_keys;
create policy p_keys_sel on question_keys for select using (auth.uid() is not null);

-- attempts: อ่านได้ทุกคน (ใช้แสดงสถานะ/คะแนนของตัวเอง); สร้างผ่าน RPC เท่านั้น
drop policy if exists p_attempts_sel on attempts;
create policy p_attempts_sel on attempts for select using (true);

-- answers: ไม่มี policy ตรง ๆ (เข้าถึงผ่าน RPC เท่านั้น เพื่อความเป็นส่วนตัวของเหตุผล)

-- qa: เขียนได้ทุกคนที่ "ไม่ถูกระงับ"; แอดมินลบได้
drop policy if exists p_threads_ins on qa_threads;
create policy p_threads_ins on qa_threads for insert
  with check (not exists (select 1 from profiles p where p.id = user_id and p.suspended));
drop policy if exists p_replies_ins on qa_replies;
create policy p_replies_ins on qa_replies for insert
  with check (not exists (select 1 from profiles p where p.id = user_id and p.suspended));

-- แอดมิน (login) ลบกระทู้/คำตอบได้
drop policy if exists p_threads_del on qa_threads;
create policy p_threads_del on qa_threads for delete using (auth.uid() is not null);
drop policy if exists p_replies_del on qa_replies;
create policy p_replies_del on qa_replies for delete using (auth.uid() is not null);

-- อ่านกระทู้: anon เห็นเฉพาะ "สาธารณะ", แอดมิน (login) เห็นทั้งหมด
-- ส่วนกระทู้ Private ของตัวเอง ผู้ใช้ดึงผ่าน RPC get_private_threads เท่านั้น
drop policy if exists p_threads_sel on qa_threads;
create policy p_threads_sel on qa_threads for select
  using (is_public = true or auth.uid() is not null);

-- อ่านคำตอบ: anon เห็นเฉพาะคำตอบของกระทู้สาธารณะ, แอดมินเห็นทั้งหมด
drop policy if exists p_replies_sel on qa_replies;
create policy p_replies_sel on qa_replies for select
  using (
    auth.uid() is not null
    or exists (select 1 from qa_threads t where t.id = thread_id and t.is_public = true)
  );

-- app_settings: อ่านได้ทุกคน, เพิ่ม/แก้ไขได้เฉพาะแอดมิน
drop policy if exists p_settings_sel on app_settings;
create policy p_settings_sel on app_settings for select using (true);
drop policy if exists p_settings_ins on app_settings;
create policy p_settings_ins on app_settings for insert with check (auth.uid() is not null);
drop policy if exists p_settings_upd on app_settings;
create policy p_settings_upd on app_settings for update
  using (auth.uid() is not null) with check (auth.uid() is not null);

-- articles: อ่านได้ถ้าเผยแพร่ (หรือแอดมิน), เพิ่ม/แก้ไข/ลบ เฉพาะแอดมิน
drop policy if exists p_articles_sel on articles;
create policy p_articles_sel on articles for select
  using (published = true or auth.uid() is not null);
drop policy if exists p_articles_ins on articles;
create policy p_articles_ins on articles for insert with check (auth.uid() is not null);
drop policy if exists p_articles_upd on articles;
create policy p_articles_upd on articles for update
  using (auth.uid() is not null) with check (auth.uid() is not null);
drop policy if exists p_articles_del on articles;
create policy p_articles_del on articles for delete using (auth.uid() is not null);

-- ---------- ฟังก์ชัน (RPC) ----------

-- แอดมินสร้างชุดข้อสอบ + คำถาม + เฉลย ในครั้งเดียว (รองรับหมวด)
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
    insert into questions(exam_set_id, order_index, question_text, q_type, choices, image_url, category)
    values (v_set_id, v_idx, rec->>'question_text', coalesce(nullif(rec->>'q_type', ''), 'mc'),
            rec->'choices', nullif(rec->>'image_url', ''), nullif(btrim(rec->>'category'), ''))
    returning id into v_q_id;

    insert into question_keys(question_id, correct_choice, explanation, explanation_images)
    values (v_q_id, rec->>'correct_choice', rec->>'explanation',
            coalesce(rec->'explanation_images', '[]'::jsonb));

    v_idx := v_idx + 1;
  end loop;

  return v_set_id;
end;
$$;

-- แอดมินเพิ่มคำถามทีละข้อเข้าไปใน "ชุดเดิม" ที่มีอยู่แล้ว
create or replace function add_question(
  p_exam_set_id uuid, p_question jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_q_id uuid;
  v_idx int;
begin
  if auth.uid() is null then
    raise exception 'unauthorized: admin only';
  end if;

  select coalesce(max(order_index), -1) + 1 into v_idx
    from questions where exam_set_id = p_exam_set_id;

  insert into questions(exam_set_id, order_index, question_text, q_type, choices, image_url, category)
  values (p_exam_set_id, v_idx, p_question->>'question_text', coalesce(nullif(p_question->>'q_type', ''), 'mc'),
          p_question->'choices', nullif(p_question->>'image_url', ''), nullif(btrim(p_question->>'category'), ''))
  returning id into v_q_id;

  insert into question_keys(question_id, correct_choice, explanation, explanation_images)
  values (v_q_id, p_question->>'correct_choice', p_question->>'explanation',
          coalesce(p_question->'explanation_images', '[]'::jsonb));

  update exam_sets set question_count = question_count + 1 where id = p_exam_set_id;

  return v_q_id;
end;
$$;

-- ===== ตัวช่วยตรวจคำตอบ (รองรับ mc / fill / match) =====
-- ทำให้ข้อความเทียบกันแบบยืดหยุ่น: ตัดช่องว่างหัวท้าย, ยุบช่องว่างซ้ำ, ตัวพิมพ์เล็ก
create or replace function normalize_text(t text)
returns text language sql immutable as $$
  select lower(btrim(regexp_replace(coalesce(t, ''), '\s+', ' ', 'g')));
$$;

-- คะแนนเต็มของข้อหนึ่ง: จับคู่ = จำนวนคู่, อื่น ๆ = 1
create or replace function question_points(p_q_type text, p_choices jsonb)
returns int language sql immutable as $$
  select case when coalesce(p_q_type, 'mc') = 'match'
    then greatest(1, coalesce(jsonb_array_length(p_choices), 0))
    else 1 end;
$$;

-- ตรวจคำตอบหนึ่งข้อ -> {gained, possible, is_correct}
create or replace function grade_answer(p_qid uuid, p_selected text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_type text; v_choices jsonb; v_correct text;
  g int := 0; p int := 1; v_norm text; v_accepts jsonb; v_map jsonb;
begin
  select coalesce(q.q_type, 'mc'), q.choices, k.correct_choice
    into v_type, v_choices, v_correct
    from questions q left join question_keys k on k.question_id = q.id
    where q.id = p_qid;
  if not found then
    return jsonb_build_object('gained', 0, 'possible', 1, 'is_correct', false);
  end if;

  if v_type = 'fill' then
    p := 1;
    v_norm := normalize_text(p_selected);
    begin v_accepts := v_correct::jsonb; exception when others then v_accepts := null; end;
    if v_accepts is null or jsonb_typeof(v_accepts) <> 'array' then
      v_accepts := to_jsonb(array[coalesce(v_correct, '')]);
    end if;
    if v_norm <> '' and exists (
      select 1 from jsonb_array_elements_text(v_accepts) a where normalize_text(a) = v_norm
    ) then g := 1; end if;

  elsif v_type = 'match' then
    p := greatest(1, coalesce(jsonb_array_length(v_choices), 0));
    begin v_map := p_selected::jsonb; exception when others then v_map := '{}'::jsonb; end;
    if v_map is null or jsonb_typeof(v_map) <> 'object' then v_map := '{}'::jsonb; end if;
    select count(*) into g
      from jsonb_array_elements(v_choices) e
      where normalize_text(e->>'right') <> ''
        and normalize_text(v_map ->> (e->>'key')) = normalize_text(e->>'right');

  else -- mc
    p := 1;
    if v_correct is not null and v_correct = p_selected then g := 1; end if;
  end if;

  return jsonb_build_object('gained', g, 'possible', p, 'is_correct', (p > 0 and g >= p));
end;
$$;

-- ตัวเลือกที่ "ปลอดภัย" สำหรับส่งให้หน้าทำข้อสอบ (ไม่หลุดเฉลย)
create or replace function safe_choices(p_q_type text, p_choices jsonb)
returns jsonb
language plpgsql volatile as $$
begin
  if coalesce(p_q_type, 'mc') = 'match' then
    return jsonb_build_object(
      'left', coalesce((
        select jsonb_agg(jsonb_build_object('key', e->>'key', 'text', e->>'left') order by ord)
        from jsonb_array_elements(p_choices) with ordinality as t(e, ord)
      ), '[]'::jsonb),
      'right', coalesce((
        select jsonb_agg(jsonb_build_object('text', e->>'right') order by random())
        from jsonb_array_elements(p_choices) e
      ), '[]'::jsonb)
    );
  elsif coalesce(p_q_type, 'mc') = 'fill' then
    return '[]'::jsonb;
  else
    return coalesce(p_choices, '[]'::jsonb);
  end if;
end;
$$;
grant execute on function normalize_text(text) to anon, authenticated;
grant execute on function question_points(text, jsonb) to anon, authenticated;
grant execute on function grade_answer(uuid, text) to anon, authenticated;
grant execute on function safe_choices(text, jsonb) to anon, authenticated;

-- โหลดข้อสอบ "ชุดรายวัน" แบบปลอดภัย (ไม่หลุดเฉลย match)
create or replace function get_set_quiz(p_exam_set_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', q.id, 'question_text', q.question_text, 'image_url', q.image_url,
      'category', q.category, 'q_type', coalesce(q.q_type, 'mc'),
      'choices', safe_choices(coalesce(q.q_type, 'mc'), q.choices)
    ) order by q.order_index), '[]'::jsonb)
  into v
  from questions q
  where q.exam_set_id = p_exam_set_id;
  return v;
end;
$$;
grant execute on function get_set_quiz(uuid) to anon, authenticated;

-- ผู้ใช้ส่งคำตอบ -> ระบบตรวจให้คะแนน (เฉลยไม่หลุดออกไปฝั่ง client)
-- p_duration = เวลาที่ใช้ทำทั้งชุด (วินาที)
drop function if exists submit_attempt(uuid, uuid, jsonb);
drop function if exists submit_attempt(uuid, uuid, jsonb, int);
create function submit_attempt(
  p_user_id uuid, p_exam_set_id uuid, p_answers jsonb, p_duration int default 0
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_attempt_id uuid; v_total int; v_score int := 0; rec jsonb; v_sel text; v_g jsonb; v_game jsonb;
begin
  if exists (select 1 from profiles where id = p_user_id and suspended) then
    raise exception 'suspended: บัญชีนี้ถูกระงับการใช้งาน';
  end if;

  select coalesce(sum(question_points(q_type, choices)), 0) into v_total
    from questions where exam_set_id = p_exam_set_id;

  insert into attempts(user_id, exam_set_id, score, total, completed, duration_seconds)
  values (p_user_id, p_exam_set_id, 0, v_total, true, greatest(0, coalesce(p_duration, 0)))
  returning id into v_attempt_id;

  for rec in select * from jsonb_array_elements(p_answers) loop
    v_sel := rec->>'selected_choice';
    v_g := grade_answer((rec->>'question_id')::uuid, v_sel);
    v_score := v_score + (v_g->>'gained')::int;

    insert into answers(attempt_id, question_id, user_id, selected_choice, reason, is_correct)
    values (v_attempt_id, (rec->>'question_id')::uuid, p_user_id,
            v_sel, rec->>'reason', (v_g->>'is_correct')::boolean);
  end loop;

  update attempts set score = v_score where id = v_attempt_id;
  v_game := register_activity(p_user_id, v_score); -- หยดน้ำ + streak + เป้าหมายรายวัน
  return jsonb_build_object('attempt_id', v_attempt_id, 'score', v_score, 'total', v_total, 'game', v_game);
end;
$$;

-- ดูเฉลย — ได้เฉพาะคนที่ "เคยทำชุดนี้เสร็จแล้ว" เท่านั้น
create or replace function get_review(
  p_user_id uuid, p_exam_set_id uuid
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_attempt attempts%rowtype;
  v_items jsonb;
begin
  select * into v_attempt from attempts
    where user_id = p_user_id and exam_set_id = p_exam_set_id and completed = true
    order by created_at desc limit 1;

  if not found then
    raise exception 'locked: must complete this exam first';
  end if;

  select jsonb_agg(jsonb_build_object(
      'question_id', q.id,
      'question_text', q.question_text,
      'image_url', q.image_url,
      'category', q.category,
      'q_type', coalesce(q.q_type, 'mc'),
      'choices', q.choices,
      'correct_choice', k.correct_choice,
      'explanation', k.explanation,
      'explanation_images', coalesce(k.explanation_images, '[]'::jsonb),
      'your_choice', a.selected_choice,
      'your_reason', a.reason,
      'is_correct', coalesce(a.is_correct, false)
    ) order by q.order_index)
  into v_items
  from questions q
  join question_keys k on k.question_id = q.id
  left join answers a on a.question_id = q.id and a.attempt_id = v_attempt.id
  where q.exam_set_id = p_exam_set_id;

  return jsonb_build_object(
    'score', v_attempt.score, 'total', v_attempt.total,
    'duration_seconds', v_attempt.duration_seconds,
    'items', coalesce(v_items, '[]'::jsonb)
  );
end;
$$;

-- พรีวิวสำหรับแอดมิน — ตรวจคะแนนชุดนี้ "โดยไม่บันทึก" attempts/answers
create or replace function preview_attempt(p_exam_set_id uuid, p_answers jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_total int := 0; v_score int := 0; v_items jsonb;
begin
  if auth.uid() is null then
    raise exception 'unauthorized: admin only';
  end if;

  select coalesce(sum(question_points(q_type, choices)), 0) into v_total
    from questions where exam_set_id = p_exam_set_id;

  with graded as (
    select q.order_index as ord, q.id as qid, q.question_text, q.image_url, q.category,
           coalesce(q.q_type, 'mc') as q_type, q.choices, k.correct_choice, k.explanation,
           coalesce(k.explanation_images, '[]'::jsonb) as explanation_images,
           ans.sel as your_choice, grade_answer(q.id, ans.sel) as g
    from questions q
    join question_keys k on k.question_id = q.id
    left join lateral (
      select (a->>'selected_choice') as sel
      from jsonb_array_elements(p_answers) a
      where (a->>'question_id') = q.id::text
      limit 1
    ) ans on true
    where q.exam_set_id = p_exam_set_id
  )
  select coalesce(sum((g->>'gained')::int), 0),
         jsonb_agg(jsonb_build_object(
           'question_id', qid, 'question_text', question_text, 'image_url', image_url,
           'category', category, 'q_type', q_type, 'choices', choices,
           'correct_choice', correct_choice, 'explanation', explanation,
           'explanation_images', explanation_images, 'your_choice', your_choice,
           'is_correct', (g->>'is_correct')::boolean
         ) order by ord)
  into v_score, v_items
  from graded;

  return jsonb_build_object('score', v_score, 'total', v_total, 'items', coalesce(v_items, '[]'::jsonb));
end;
$$;
grant execute on function preview_attempt(uuid, jsonb) to authenticated;
create or replace function get_exam_results(p_exam_set_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_items jsonb;
begin
  if auth.uid() is null then
    raise exception 'unauthorized: admin only';
  end if;

  select jsonb_agg(att order by att_created desc) into v_items
  from (
    select a.created_at as att_created,
      jsonb_build_object(
        'attempt_id', a.id,
        'username', p.username,
        'score', a.score,
        'total', a.total,
        'duration_seconds', a.duration_seconds,
        'created_at', a.created_at,
        'answers', coalesce((
          select jsonb_agg(jsonb_build_object(
            'order_index', q.order_index,
            'question_text', q.question_text,
            'selected_choice', ans.selected_choice,
            'correct_choice', k.correct_choice,
            'is_correct', ans.is_correct,
            'reason', ans.reason
          ) order by q.order_index)
          from answers ans
          join questions q on q.id = ans.question_id
          left join question_keys k on k.question_id = q.id
          where ans.attempt_id = a.id
        ), '[]'::jsonb)
      ) as att
    from attempts a
    join profiles p on p.id = a.user_id
    where a.exam_set_id = p_exam_set_id and a.completed = true
      and not coalesce(p.exclude_stats, false)
  ) sub;

  return jsonb_build_object('items', coalesce(v_items, '[]'::jsonb));
end;
$$;

-- ดึงกระทู้ Private — ผู้ใช้เห็นเฉพาะของตัวเอง, แอดมิน (login) เห็นทั้งหมด พร้อมชื่อผู้ถาม
create or replace function get_private_threads(p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_is_admin boolean := auth.uid() is not null;
begin
  return coalesce((
    select jsonb_agg(thread_json order by created_at desc)
    from (
      select th.created_at,
        jsonb_build_object(
          'id', th.id,
          'user_id', th.user_id,
          'username', p.username,
          'body', th.body,
          'is_public', th.is_public,
          'created_at', th.created_at,
          'replies', coalesce((
            select jsonb_agg(jsonb_build_object(
              'id', r.id, 'body', r.body, 'is_admin', r.is_admin, 'created_at', r.created_at
            ) order by r.created_at)
            from qa_replies r where r.thread_id = th.id
          ), '[]'::jsonb)
        ) as thread_json
      from qa_threads th
      left join profiles p on p.id = th.user_id
      where th.is_public = false
        and (v_is_admin or th.user_id = p_user_id)
    ) sub
  ), '[]'::jsonb);
end;
$$;

grant execute on function create_exam_set(int, text, boolean, jsonb, text) to authenticated;
grant execute on function add_question(uuid, jsonb) to authenticated;
grant execute on function get_private_threads(uuid) to anon, authenticated;
grant execute on function submit_attempt(uuid, uuid, jsonb, int) to anon, authenticated;
grant execute on function get_review(uuid, uuid) to anon, authenticated;
grant execute on function get_exam_results(uuid) to authenticated;

-- แอดมินลบผลการทำข้อสอบ (attempt + answers จะถูกลบตาม cascade)
create or replace function delete_attempt(p_attempt_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'unauthorized: admin only'; end if;
  delete from attempts where id = p_attempt_id;
end;
$$;
grant execute on function delete_attempt(uuid) to authenticated;

-- แอดมินลบผลทั้งหมดของผู้ใช้ในชุดหนึ่ง
create or replace function delete_user_set_attempts(p_user_id uuid, p_exam_set_id uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  if auth.uid() is null then raise exception 'unauthorized: admin only'; end if;
  with d as (delete from attempts where user_id = p_user_id and exam_set_id = p_exam_set_id returning 1)
  select count(*) into v_n from d;
  return v_n;
end;
$$;
grant execute on function delete_user_set_attempts(uuid, uuid) to authenticated;

-- ตารางคะแนน: ผู้ใช้ x ชุด (คะแนนสูงสุดของแต่ละคนในแต่ละชุด) — สำหรับ heatmap/กราฟ
create or replace function get_score_matrix()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_users jsonb; v_sets jsonb; v_cells jsonb;
begin
  if auth.uid() is null then raise exception 'unauthorized: admin only'; end if;

  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'username', username) order by username), '[]'::jsonb)
    into v_users
  from profiles p
  where not coalesce(p.exclude_stats, false)
    and exists (select 1 from attempts a where a.user_id = p.id and a.completed);

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'title', s.title, 'day_number', s.day_number,
      'total', coalesce((select sum(question_points(q.q_type, q.choices)) from questions q where q.exam_set_id = s.id), 0)
    ) order by s.day_number), '[]'::jsonb)
    into v_sets
  from exam_sets s
  where exists (
    select 1 from attempts a join profiles pr on pr.id = a.user_id
    where a.exam_set_id = s.id and a.completed and not coalesce(pr.exclude_stats, false)
  );

  select coalesce(jsonb_agg(jsonb_build_object(
      'user_id', user_id, 'exam_set_id', exam_set_id,
      'best', best, 'best_total', best_total, 'attempts', cnt, 'last_at', last_at)), '[]'::jsonb)
    into v_cells
  from (
    select a.user_id, a.exam_set_id, max(a.score) as best,
           (array_agg(a.total order by a.score desc, a.created_at desc))[1] as best_total,
           count(*) as cnt, max(a.created_at) as last_at
    from attempts a join profiles p on p.id = a.user_id
    where a.completed and not coalesce(p.exclude_stats, false)
    group by a.user_id, a.exam_set_id
  ) t;

  return jsonb_build_object('users', v_users, 'sets', v_sets, 'cells', v_cells);
end;
$$;
grant execute on function get_score_matrix() to authenticated;

-- สถิติรายข้อของชุดหนึ่ง: ข้อไหนคนตอบผิดเยอะสุด
create or replace function get_question_stats(p_exam_set_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_items jsonb;
begin
  if auth.uid() is null then raise exception 'unauthorized: admin only'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'question_id', q.id, 'order_index', q.order_index, 'question_text', q.question_text,
      'q_type', coalesce(q.q_type, 'mc'),
      'answered', coalesce(st.answered, 0), 'wrong', coalesce(st.wrong, 0),
      'wrong_pct', case when coalesce(st.answered, 0) > 0
                        then round(100.0 * st.wrong / st.answered)::int else 0 end
    ) order by case when coalesce(st.answered, 0) > 0 then 1.0 * st.wrong / st.answered else -1 end desc, q.order_index), '[]'::jsonb)
  into v_items
  from questions q
  left join (
    select an.question_id, count(*) as answered, count(*) filter (where not an.is_correct) as wrong
    from answers an join profiles p on p.id = an.user_id
    where not coalesce(p.exclude_stats, false)
    group by an.question_id
  ) st on st.question_id = q.id
  where q.exam_set_id = p_exam_set_id;
  return jsonb_build_object('items', coalesce(v_items, '[]'::jsonb));
end;
$$;
grant execute on function get_question_stats(uuid) to authenticated;


-- ===== ศูนย์ฝึกซ้อม (สถิติ/จุดอ่อน/ทบทวนข้อผิด/ติวแยกหมวด/streak) =====
create or replace function get_user_stats(p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_completed int;
  v_answered int;
  v_correct int;
  v_by_cat jsonb;
  v_recent jsonb;
  v_streak int := 0;
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
  v_expected date;
  v_first boolean := true;
  r record;
begin
  select count(*) into v_completed from attempts where user_id = p_user_id and completed;

  select count(*), count(*) filter (where is_correct)
    into v_answered, v_correct
  from answers where user_id = p_user_id;

  select coalesce(jsonb_agg(
           jsonb_build_object('category', cat, 'answered', answered, 'correct', correct)
           order by (correct::numeric / nullif(answered, 0)) asc nulls last, cat
         ), '[]'::jsonb)
    into v_by_cat
  from (
    select coalesce(nullif(btrim(q.category), ''), 'อื่น ๆ') as cat,
           count(*) as answered,
           count(*) filter (where a.is_correct) as correct
    from answers a
    join questions q on q.id = a.question_id
    where a.user_id = p_user_id
    group by 1
  ) s;

  select coalesce(jsonb_agg(
           jsonb_build_object('exam_set_id', exam_set_id, 'title', title,
                              'score', score, 'total', total, 'created_at', created_at)
           order by created_at desc
         ), '[]'::jsonb)
    into v_recent
  from (
    select a.exam_set_id, es.title, a.score, a.total, a.created_at
    from attempts a
    join exam_sets es on es.id = a.exam_set_id
    where a.user_id = p_user_id and a.completed
    order by a.created_at desc
    limit 10
  ) t;

  for r in
    select distinct (created_at at time zone 'Asia/Bangkok')::date as d
    from attempts where user_id = p_user_id and completed
    order by d desc
  loop
    if v_first then
      if r.d = v_today or r.d = v_today - 1 then
        v_streak := 1; v_expected := r.d - 1; v_first := false;
      else
        exit;
      end if;
    elsif r.d = v_expected then
      v_streak := v_streak + 1; v_expected := r.d - 1;
    else
      exit;
    end if;
  end loop;

  return jsonb_build_object(
    'completed_count', v_completed,
    'answered', coalesce(v_answered, 0),
    'correct', coalesce(v_correct, 0),
    'by_category', v_by_cat,
    'recent', v_recent,
    'streak', v_streak
  );
end;
$$;
grant execute on function get_user_stats(uuid) to anon, authenticated;

create or replace function get_wrong_questions(p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_items jsonb;
begin
  with latest as (
    select distinct on (a.question_id) a.question_id, a.is_correct
    from answers a
    where a.user_id = p_user_id
    order by a.question_id, a.created_at desc
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'question_id', q.id, 'question_text', q.question_text, 'image_url', q.image_url,
      'category', q.category, 'q_type', coalesce(q.q_type, 'mc'), 'choices', q.choices,
      'correct_choice', k.correct_choice,
      'explanation', k.explanation, 'explanation_images', coalesce(k.explanation_images, '[]'::jsonb)
    ) order by random()), '[]'::jsonb)
  into v_items
  from latest l
  join questions q on q.id = l.question_id
  join question_keys k on k.question_id = q.id
  where l.is_correct = false;
  return v_items;
end;
$$;
grant execute on function get_wrong_questions(uuid) to anon, authenticated;

create or replace function get_practice_categories()
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object('category', cat, 'count', cnt) order by cat)
    from (
      select coalesce(nullif(btrim(q.category), ''), 'อื่น ๆ') as cat, count(*) as cnt
      from questions q
      join exam_sets es on es.id = q.exam_set_id and es.published = true
      group by 1
    ) s
  ), '[]'::jsonb);
end;
$$;
grant execute on function get_practice_categories() to anon, authenticated;

create or replace function get_category_questions(p_category text, p_limit int default 10)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_items jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
      'question_id', q_id, 'question_text', question_text, 'image_url', image_url,
      'category', category, 'q_type', q_type, 'choices', choices, 'correct_choice', correct_choice,
      'explanation', explanation, 'explanation_images', explanation_images
    )), '[]'::jsonb)
  into v_items
  from (
    select q.id as q_id, q.question_text, q.image_url, q.category, coalesce(q.q_type, 'mc') as q_type,
           q.choices, k.correct_choice, k.explanation,
           coalesce(k.explanation_images, '[]'::jsonb) as explanation_images
    from questions q
    join question_keys k on k.question_id = q.id
    join exam_sets es on es.id = q.exam_set_id and es.published = true
    where coalesce(nullif(btrim(q.category), ''), 'อื่น ๆ') = p_category
    order by random()
    limit greatest(1, least(coalesce(p_limit, 10), 50))
  ) sub;
  return v_items;
end;
$$;
grant execute on function get_category_questions(text, int) to anon, authenticated;

-- ===== ข้อสอบรายหมวด (รวมข้อจากทุกชุด เก็บคะแนน + ดูเฉลยทีหลัง) =====
-- ตารางเก็บการทำข้อสอบรายหมวด (แยกจาก attempts ที่ผูกกับชุด)
create table if not exists category_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  category text not null,
  score int not null default 0,
  total int not null default 0,
  duration_seconds int not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists category_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references category_attempts(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  selected_choice text,
  is_correct boolean not null default false,
  created_at timestamptz not null default now()
);
alter table category_attempts enable row level security;
alter table category_answers enable row level security;
create index if not exists idx_cat_attempts_user on category_attempts(user_id, category);
create index if not exists idx_cat_answers_attempt on category_answers(attempt_id);

-- โหลดคำถามรายหมวด (ไม่มีเฉลย — เหมือนทำข้อสอบจริง) รวมจากทุกชุดที่เผยแพร่
create or replace function get_category_quiz(p_category text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', q.id, 'question_text', q.question_text, 'image_url', q.image_url,
      'category', q.category, 'q_type', coalesce(q.q_type, 'mc'),
      'choices', safe_choices(coalesce(q.q_type, 'mc'), q.choices)
    ) order by es.day_number, q.order_index), '[]'::jsonb)
  into v
  from questions q
  join exam_sets es on es.id = q.exam_set_id and es.published = true
  where coalesce(nullif(btrim(q.category), ''), 'อื่น ๆ') = p_category;
  return v;
end;
$$;
grant execute on function get_category_quiz(text) to anon, authenticated;

-- ส่งคำตอบข้อสอบรายหมวด -> ตรวจ + เก็บคะแนน
create or replace function submit_category_attempt(
  p_user_id uuid, p_category text, p_answers jsonb, p_duration int default 0
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_attempt_id uuid; v_total int := 0; v_score int := 0; rec jsonb; v_sel text; v_g jsonb; v_game jsonb;
begin
  if exists (select 1 from profiles where id = p_user_id and suspended) then
    raise exception 'suspended: บัญชีนี้ถูกระงับการใช้งาน';
  end if;
  insert into category_attempts(user_id, category, score, total, duration_seconds)
  values (p_user_id, p_category, 0, 0, greatest(0, coalesce(p_duration, 0)))
  returning id into v_attempt_id;

  for rec in select * from jsonb_array_elements(p_answers) loop
    v_sel := rec->>'selected_choice';
    v_g := grade_answer((rec->>'question_id')::uuid, v_sel);
    v_score := v_score + (v_g->>'gained')::int;
    v_total := v_total + (v_g->>'possible')::int;
    insert into category_answers(attempt_id, question_id, user_id, selected_choice, is_correct)
    values (v_attempt_id, (rec->>'question_id')::uuid, p_user_id, v_sel, (v_g->>'is_correct')::boolean);
  end loop;

  update category_attempts set score = v_score, total = v_total where id = v_attempt_id;
  v_game := register_activity(p_user_id, v_score); -- หยดน้ำ + streak + เป้าหมายรายวัน
  return jsonb_build_object('attempt_id', v_attempt_id, 'score', v_score, 'total', v_total, 'game', v_game);
end;
$$;
grant execute on function submit_category_attempt(uuid, text, jsonb, int) to anon, authenticated;

-- เฉลยข้อสอบรายหมวด (เฉพาะเจ้าของ attempt)
create or replace function get_category_review(p_user_id uuid, p_attempt_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_att category_attempts%rowtype; v_items jsonb;
begin
  select * into v_att from category_attempts where id = p_attempt_id and user_id = p_user_id;
  if not found then
    raise exception 'locked: must complete this category exam first';
  end if;

  select jsonb_agg(jsonb_build_object(
      'question_id', q.id, 'question_text', q.question_text, 'image_url', q.image_url,
      'category', q.category, 'q_type', coalesce(q.q_type, 'mc'), 'choices', q.choices,
      'correct_choice', k.correct_choice,
      'explanation', k.explanation, 'explanation_images', coalesce(k.explanation_images, '[]'::jsonb),
      'your_choice', a.selected_choice, 'is_correct', coalesce(a.is_correct, false)
    ) order by a.created_at)
  into v_items
  from category_answers a
  join questions q on q.id = a.question_id
  join question_keys k on k.question_id = q.id
  where a.attempt_id = v_att.id;

  return jsonb_build_object(
    'score', v_att.score, 'total', v_att.total, 'category', v_att.category,
    'duration_seconds', v_att.duration_seconds, 'items', coalesce(v_items, '[]'::jsonb)
  );
end;
$$;
grant execute on function get_category_review(uuid, uuid) to anon, authenticated;

-- ความคืบหน้ารายหมวดของผู้ใช้ (คะแนนสูงสุด + attempt ล่าสุดไว้กดดูเฉลย)
create or replace function get_category_progress(p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  return coalesce((
    select jsonb_object_agg(category, info)
    from (
      select category, jsonb_build_object(
          'best_score', max(score),
          'attempts', count(*),
          'last_attempt_id', (array_agg(id order by created_at desc))[1],
          'last_total', (array_agg(total order by created_at desc))[1]
        ) as info
      from category_attempts
      where user_id = p_user_id
      group by category
    ) s
  ), '{}'::jsonb);
end;
$$;
grant execute on function get_category_progress(uuid) to anon, authenticated;

-- แอดมินแก้ไขคำถามเดิม + เฉลย
create or replace function update_question(p_question_id uuid, p_question jsonb)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'unauthorized: admin only';
  end if;

  update questions set
    question_text = p_question->>'question_text',
    q_type = coalesce(nullif(p_question->>'q_type', ''), 'mc'),
    choices = p_question->'choices',
    image_url = nullif(p_question->>'image_url', ''),
    category = nullif(btrim(p_question->>'category'), '')
  where id = p_question_id;

  if exists (select 1 from question_keys where question_id = p_question_id) then
    update question_keys set
      correct_choice = p_question->>'correct_choice',
      explanation = p_question->>'explanation',
      explanation_images = coalesce(p_question->'explanation_images', '[]'::jsonb)
    where question_id = p_question_id;
  else
    insert into question_keys(question_id, correct_choice, explanation, explanation_images)
    values (p_question_id, p_question->>'correct_choice', p_question->>'explanation',
            coalesce(p_question->'explanation_images', '[]'::jsonb));
  end if;
end;
$$;
grant execute on function update_question(uuid, jsonb) to authenticated;

-- แอดมินลบคำถามเดิม
create or replace function delete_question(p_question_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_set uuid;
begin
  if auth.uid() is null then
    raise exception 'unauthorized: admin only';
  end if;
  select exam_set_id into v_set from questions where id = p_question_id;
  delete from questions where id = p_question_id;
  if v_set is not null then
    update exam_sets set question_count = greatest(0, question_count - 1) where id = v_set;
  end if;
end;
$$;
grant execute on function delete_question(uuid) to authenticated;

-- บันทึกการแก้ไขทั้งชุดในคราวเดียวแบบ atomic (upsert ตาม id — กดบันทึกซ้ำก็ไม่เกิดข้อซ้ำ)
create or replace function save_exam_set(
  p_set_id uuid, p_title text, p_questions jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  rec jsonb;
  idx int := 0;
  qid uuid;
  v_updated int := 0;
  v_added int := 0;
begin
  if auth.uid() is null then
    raise exception 'unauthorized: admin only';
  end if;

  update exam_sets set title = nullif(btrim(p_title), '') where id = p_set_id;

  for rec in select * from jsonb_array_elements(p_questions) loop
    qid := nullif(rec->>'id', '')::uuid;

    if qid is not null
       and exists (select 1 from questions where id = qid and exam_set_id = p_set_id) then
      update questions set
        order_index = idx,
        question_text = rec->>'question_text',
        q_type = coalesce(nullif(rec->>'q_type', ''), 'mc'),
        choices = rec->'choices',
        image_url = nullif(rec->>'image_url', ''),
        category = nullif(btrim(rec->>'category'), '')
      where id = qid;

      if exists (select 1 from question_keys where question_id = qid) then
        update question_keys set
          correct_choice = rec->>'correct_choice',
          explanation = rec->>'explanation',
          explanation_images = coalesce(rec->'explanation_images', '[]'::jsonb)
        where question_id = qid;
      else
        insert into question_keys(question_id, correct_choice, explanation, explanation_images)
        values (qid, rec->>'correct_choice', rec->>'explanation',
                coalesce(rec->'explanation_images', '[]'::jsonb));
      end if;

      v_updated := v_updated + 1;
    else
      insert into questions(exam_set_id, order_index, question_text, q_type, choices, image_url, category)
      values (p_set_id, idx, rec->>'question_text', coalesce(nullif(rec->>'q_type', ''), 'mc'),
              rec->'choices', nullif(rec->>'image_url', ''), nullif(btrim(rec->>'category'), ''))
      returning id into qid;

      insert into question_keys(question_id, correct_choice, explanation, explanation_images)
      values (qid, rec->>'correct_choice', rec->>'explanation',
              coalesce(rec->'explanation_images', '[]'::jsonb));

      v_added := v_added + 1;
    end if;

    idx := idx + 1;
  end loop;

  update exam_sets
    set question_count = (select count(*) from questions where exam_set_id = p_set_id)
    where id = p_set_id;

  return jsonb_build_object('updated', v_updated, 'added', v_added);
end;
$$;
grant execute on function save_exam_set(uuid, text, jsonb) to authenticated;

-- เพิ่มยอดเข้าอ่านบทความ +1
create or replace function increment_article_views(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update articles set views = views + 1 where id = p_id and published = true;
end;
$$;
grant execute on function increment_article_views(uuid) to anon, authenticated;

-- ===== บันทึก "อ่านบทความจบแล้ว" รายผู้ใช้ (ให้ดาว/รางวัล) =====
create table if not exists article_reads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  article_id uuid not null references articles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, article_id)
);
alter table article_reads enable row level security;
create index if not exists idx_article_reads_user on article_reads(user_id);

-- ทำเครื่องหมายว่าอ่านจบ (คืน first_time=true เฉพาะครั้งแรก เพื่อโชว์รางวัล)
create or replace function mark_article_read(p_user_id uuid, p_article_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_new boolean := false; v_total int;
begin
  insert into article_reads(user_id, article_id) values (p_user_id, p_article_id)
  on conflict (user_id, article_id) do nothing;
  v_new := found;
  select count(*) into v_total from article_reads where user_id = p_user_id;
  return jsonb_build_object('first_time', v_new, 'total_read', v_total);
end;
$$;
grant execute on function mark_article_read(uuid, uuid) to anon, authenticated;

-- รายการ id บทความที่ผู้ใช้อ่านจบแล้ว (ไว้โชว์ดาวในลิสต์)
create or replace function get_read_articles(p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  return coalesce((select jsonb_agg(article_id) from article_reads where user_id = p_user_id), '[]'::jsonb);
end;
$$;
grant execute on function get_read_articles(uuid) to anon, authenticated;

-- ===== นับ "ผู้เข้าอ่าน" แบบไม่ซ้ำคน (1 user/บทความ นับ 1) =====
create table if not exists article_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  article_id uuid not null references articles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, article_id)
);
alter table article_views enable row level security;
create index if not exists idx_article_views_article on article_views(article_id);

-- บันทึกว่า user เข้าดูบทความ (ไม่ซ้ำ)
create or replace function mark_article_view(p_user_id uuid, p_article_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into article_views(user_id, article_id) values (p_user_id, p_article_id)
  on conflict (user_id, article_id) do nothing;
end;
$$;
grant execute on function mark_article_view(uuid, uuid) to anon, authenticated;

-- สถิติต่อบทความ: viewers = จำนวนผู้เข้าอ่าน (ไม่ซ้ำ), stars = จำนวนดาวที่กดเก็บ (อ่านจบ)
create or replace function get_article_stats()
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  return coalesce((
    select jsonb_object_agg(article_id, info)
    from (
      select a.id as article_id, jsonb_build_object(
          'viewers', (select count(*) from article_views v where v.article_id = a.id),
          'stars', (select count(*) from article_reads r where r.article_id = a.id)
        ) as info
      from articles a
    ) s
  ), '{}'::jsonb);
end;
$$;
grant execute on function get_article_stats() to anon, authenticated;

-- ===== 🌳 เกมปลูกต้นไม้: ตอบถูก 1 ข้อ = 1 หยดน้ำ · รด 5 หยด = อัป 1 เลเวล =====
create table if not exists garden (
  user_id uuid primary key references profiles(id) on delete cascade,
  drops int not null default 0,   -- หยดน้ำที่มีไว้ใช้รด (ยังไม่ได้รด)
  growth int not null default 0,  -- จำนวนหยดที่รดไปแล้วสะสม (level = growth/5 + 1)
  updated_at timestamptz not null default now()
);
alter table garden enable row level security;

-- ให้หยดน้ำ (เรียกตอน submit ข้อสอบ)
create or replace function add_drops(p_user_id uuid, p_n int)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(p_n, 0) <= 0 then return; end if;
  insert into garden(user_id, drops) values (p_user_id, p_n)
  on conflict (user_id) do update set drops = garden.drops + p_n, updated_at = now();
end;
$$;
grant execute on function add_drops(uuid, int) to anon, authenticated;

-- อ่านสถานะสวน
create or replace function get_garden(p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_drops int := 0; v_growth int := 0;
begin
  select drops, growth into v_drops, v_growth from garden where user_id = p_user_id;
  v_drops := coalesce(v_drops, 0); v_growth := coalesce(v_growth, 0);
  return jsonb_build_object('drops', v_drops, 'growth', v_growth,
    'level', v_growth / 5 + 1, 'in_level', v_growth % 5, 'per_level', 5);
end;
$$;
grant execute on function get_garden(uuid) to anon, authenticated;

-- รดน้ำ p_count หยด (ใช้ได้ไม่เกินที่มี) -> โตขึ้น + อัปเลเวล
create or replace function water_tree(p_user_id uuid, p_count int default 1)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_drops int; v_growth int; v_use int; v_old_level int; v_new_level int;
begin
  insert into garden(user_id) values (p_user_id) on conflict (user_id) do nothing;
  select drops, growth into v_drops, v_growth from garden where user_id = p_user_id for update;
  v_use := least(greatest(coalesce(p_count, 1), 0), v_drops);
  v_old_level := v_growth / 5 + 1;
  update garden set drops = drops - v_use, growth = growth + v_use, updated_at = now()
    where user_id = p_user_id
    returning drops, growth into v_drops, v_growth;
  v_new_level := v_growth / 5 + 1;
  return jsonb_build_object('drops', v_drops, 'growth', v_growth, 'level', v_new_level,
    'in_level', v_growth % 5, 'per_level', 5, 'used', v_use, 'leveled_up', v_new_level - v_old_level);
end;
$$;
grant execute on function water_tree(uuid, int) to anon, authenticated;

-- ===== 🔥 เฟส 1: streak ต่อเนื่อง + เป้าหมายรายวัน =====
create table if not exists game_stats (
  user_id uuid primary key references profiles(id) on delete cascade,
  current_streak int not null default 0,   -- ทำข้อสอบติดต่อกันกี่วัน
  longest_streak int not null default 0,
  last_active date,                          -- วันล่าสุดที่ทำข้อสอบ (เวลาไทย)
  daily_goal int not null default 5,        -- เป้าหมายตอบถูกต่อวัน
  goal_date date,                            -- วันของเป้าหมายที่กำลังนับ
  goal_correct int not null default 0,       -- ตอบถูกวันนี้
  goal_claimed boolean not null default false, -- รับโบนัสเป้าหมายวันนี้แล้ว
  updated_at timestamptz not null default now()
);
alter table game_stats enable row level security;

-- เรียกตอน submit ข้อสอบ: อัปเดต streak + เป้าหมาย + แจกหยดน้ำ (ฐาน + โบนัส)
create or replace function register_activity(p_user_id uuid, p_correct int)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
  v_last date; v_streak int; v_longest int; v_goal int; v_gdate date; v_gcorrect int; v_gclaimed boolean;
  v_new_day boolean := false; v_streak_bonus int := 0; v_goal_bonus int := 0; v_goal_done boolean := false; v_bonus int := 0;
begin
  insert into game_stats(user_id) values (p_user_id) on conflict (user_id) do nothing;
  select current_streak, longest_streak, last_active, daily_goal, goal_date, goal_correct, goal_claimed
    into v_streak, v_longest, v_last, v_goal, v_gdate, v_gcorrect, v_gclaimed
    from game_stats where user_id = p_user_id for update;
  v_goal := coalesce(v_goal, 5);

  -- streak: ทำซ้ำวันเดิม=คงเดิม, ต่อจากเมื่อวาน=+1, ขาด=เริ่มใหม่
  if v_last = v_today then
    null;
  elsif v_last = v_today - 1 then
    v_streak := coalesce(v_streak, 0) + 1; v_new_day := true;
  else
    v_streak := 1; v_new_day := true;
  end if;
  v_longest := greatest(coalesce(v_longest, 0), v_streak);

  if v_new_day then
    v_streak_bonus := case
      when v_streak % 30 = 0 then 30
      when v_streak % 7 = 0 then 10
      when v_streak >= 3 then 3
      else 0 end;
  end if;

  -- เป้าหมายรายวัน
  if v_gdate is distinct from v_today then
    v_gdate := v_today; v_gcorrect := 0; v_gclaimed := false;
  end if;
  v_gcorrect := coalesce(v_gcorrect, 0) + greatest(coalesce(p_correct, 0), 0);
  if v_gcorrect >= v_goal and not coalesce(v_gclaimed, false) then
    v_goal_done := true; v_gclaimed := true; v_goal_bonus := 5;
  end if;

  update game_stats set current_streak = v_streak, longest_streak = v_longest, last_active = v_today,
    daily_goal = v_goal, goal_date = v_gdate, goal_correct = v_gcorrect, goal_claimed = v_gclaimed, updated_at = now()
    where user_id = p_user_id;

  v_bonus := v_streak_bonus + v_goal_bonus;
  perform add_drops(p_user_id, greatest(coalesce(p_correct, 0), 0) + v_bonus);

  return jsonb_build_object('streak', v_streak, 'new_day', v_new_day, 'streak_bonus', v_streak_bonus,
    'goal', v_goal, 'goal_correct', v_gcorrect, 'goal_done', v_goal_done, 'goal_bonus', v_goal_bonus,
    'base_drops', greatest(coalesce(p_correct, 0), 0), 'bonus_drops', v_bonus);
end;
$$;
grant execute on function register_activity(uuid, int) to anon, authenticated;

-- สถานะเกมทั้งหมด (streak, เป้าหมาย, ตัวเลขสำหรับ achievement)
create or replace function get_game_stats(p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
  v_streak int; v_longest int; v_last date; v_goal int; v_gdate date; v_gcorrect int; v_gclaimed boolean;
  v_total_correct int; v_exams int; v_growth int; v_articles int; v_perfect int;
begin
  select current_streak, longest_streak, last_active, daily_goal, goal_date, goal_correct, goal_claimed
    into v_streak, v_longest, v_last, v_goal, v_gdate, v_gcorrect, v_gclaimed
    from game_stats where user_id = p_user_id;
  v_goal := coalesce(v_goal, 5);
  if v_last is null or v_last < v_today - 1 then v_streak := 0; end if;   -- streak ขาดแล้ว
  if v_gdate is distinct from v_today then v_gcorrect := 0; v_gclaimed := false; end if;

  select coalesce(sum(score), 0) into v_total_correct from (
    select score from attempts where user_id = p_user_id and completed
    union all select score from category_attempts where user_id = p_user_id
  ) z;
  select count(*) into v_exams from (
    select id from attempts where user_id = p_user_id and completed
    union all select id from category_attempts where user_id = p_user_id
  ) z2;
  select coalesce(growth, 0) into v_growth from garden where user_id = p_user_id;
  select count(*) into v_articles from article_reads where user_id = p_user_id;
  select count(*) into v_perfect from (
    select 1 from attempts where user_id = p_user_id and completed and total > 0 and score = total
    union all select 1 from category_attempts where user_id = p_user_id and total > 0 and score = total
  ) z3;

  return jsonb_build_object(
    'streak', coalesce(v_streak, 0), 'longest_streak', coalesce(v_longest, 0),
    'daily_goal', v_goal, 'goal_correct', coalesce(v_gcorrect, 0), 'goal_done', coalesce(v_gclaimed, false),
    'total_correct', coalesce(v_total_correct, 0), 'exams_done', coalesce(v_exams, 0),
    'tree_level', coalesce(v_growth, 0) / 5 + 1, 'articles_read', coalesce(v_articles, 0),
    'perfect_count', coalesce(v_perfect, 0)
  );
end;
$$;
grant execute on function get_game_stats(uuid) to anon, authenticated;

-- ---------- ที่เก็บรูปคำถาม (Supabase Storage) ----------
insert into storage.buckets (id, name, public)
values ('question-images', 'question-images', true)
on conflict (id) do nothing;

drop policy if exists qimg_public_read on storage.objects;
create policy qimg_public_read on storage.objects for select
  using (bucket_id = 'question-images');

drop policy if exists qimg_admin_insert on storage.objects;
create policy qimg_admin_insert on storage.objects for insert
  with check (bucket_id = 'question-images' and auth.uid() is not null);

drop policy if exists qimg_admin_delete on storage.objects;
create policy qimg_admin_delete on storage.objects for delete
  using (bucket_id = 'question-images' and auth.uid() is not null);

-- ---------- Realtime (แจ้งเตือนข้อสอบใหม่ + บทความใหม่ + ถาม-ตอบสด) ----------
do $$ begin alter publication supabase_realtime add table exam_sets; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table qa_threads; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table qa_replies; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table articles; exception when duplicate_object then null; end $$;
