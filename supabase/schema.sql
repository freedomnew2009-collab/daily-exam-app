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
  created_at timestamptz not null default now()
);
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
  choices jsonb not null default '[]'::jsonb, -- [{key,text}]
  created_at timestamptz not null default now()
);
-- เผื่อ DB เดิมที่สร้างก่อนมีคอลัมน์นี้
alter table questions add column if not exists image_url text;
alter table questions add column if not exists category text;

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
    insert into questions(exam_set_id, order_index, question_text, choices, image_url, category)
    values (v_set_id, v_idx, rec->>'question_text', rec->'choices',
            nullif(rec->>'image_url', ''), nullif(btrim(rec->>'category'), ''))
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

  insert into questions(exam_set_id, order_index, question_text, choices, image_url, category)
  values (p_exam_set_id, v_idx, p_question->>'question_text', p_question->'choices',
          nullif(p_question->>'image_url', ''), nullif(btrim(p_question->>'category'), ''))
  returning id into v_q_id;

  insert into question_keys(question_id, correct_choice, explanation, explanation_images)
  values (v_q_id, p_question->>'correct_choice', p_question->>'explanation',
          coalesce(p_question->'explanation_images', '[]'::jsonb));

  update exam_sets set question_count = question_count + 1 where id = p_exam_set_id;

  return v_q_id;
end;
$$;

-- ผู้ใช้ส่งคำตอบ -> ระบบตรวจให้คะแนน (เฉลยไม่หลุดออกไปฝั่ง client)
-- p_duration = เวลาที่ใช้ทำทั้งชุด (วินาที)
drop function if exists submit_attempt(uuid, uuid, jsonb);
drop function if exists submit_attempt(uuid, uuid, jsonb, int);
create function submit_attempt(
  p_user_id uuid, p_exam_set_id uuid, p_answers jsonb, p_duration int default 0
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_attempt_id uuid;
  v_total int;
  v_score int := 0;
  rec jsonb;
  v_correct text;
  v_ok boolean;
begin
  if exists (select 1 from profiles where id = p_user_id and suspended) then
    raise exception 'suspended: บัญชีนี้ถูกระงับการใช้งาน';
  end if;

  select count(*) into v_total from questions where exam_set_id = p_exam_set_id;

  insert into attempts(user_id, exam_set_id, score, total, completed, duration_seconds)
  values (p_user_id, p_exam_set_id, 0, v_total, true, greatest(0, coalesce(p_duration, 0)))
  returning id into v_attempt_id;

  for rec in select * from jsonb_array_elements(p_answers) loop
    select correct_choice into v_correct
      from question_keys where question_id = (rec->>'question_id')::uuid;
    v_ok := (v_correct is not null and v_correct = (rec->>'selected_choice'));
    if v_ok then v_score := v_score + 1; end if;

    insert into answers(attempt_id, question_id, user_id, selected_choice, reason, is_correct)
    values (v_attempt_id, (rec->>'question_id')::uuid, p_user_id,
            rec->>'selected_choice', rec->>'reason', v_ok);
  end loop;

  update attempts set score = v_score where id = v_attempt_id;
  return jsonb_build_object('attempt_id', v_attempt_id, 'score', v_score, 'total', v_total);
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

-- ผลตรวจสำหรับแอดมิน — เห็นคำตอบ + เหตุผลของผู้ใช้ทุกคนในชุดนั้น
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

-- เพิ่มยอดเข้าอ่านบทความ +1
create or replace function increment_article_views(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update articles set views = views + 1 where id = p_id and published = true;
end;
$$;
grant execute on function increment_article_views(uuid) to anon, authenticated;

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
