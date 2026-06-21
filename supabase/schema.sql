-- ============================================================
--  ข้อสอบรายวัน — Supabase schema
--  วิธีใช้: เปิด Supabase Dashboard -> SQL Editor -> วางทั้งไฟล์นี้ -> Run
-- ============================================================

-- ---------- ตาราง ----------

-- ผู้ใช้ (ไม่ต้องยืนยันตัวตน — แค่ตั้งชื่อ)
create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  created_at timestamptz not null default now()
);

-- ชุดข้อสอบ (วันละ ~5 ข้อ, ไม่อ้างอิงวันที่จริง ใช้ day_number)
create table if not exists exam_sets (
  id uuid primary key default gen_random_uuid(),
  day_number int not null,
  title text,
  question_count int not null default 0,
  published boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now()
);

-- คำถาม (ไม่มีคำตอบ/เฉลย เพื่อกันผู้ใช้ดึงไปดูก่อนทำ)
create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  exam_set_id uuid not null references exam_sets(id) on delete cascade,
  order_index int not null default 0,
  question_text text not null,
  choices jsonb not null default '[]'::jsonb, -- [{key,text}]
  created_at timestamptz not null default now()
);

-- เฉลย (แยกตาราง — อ่านได้เฉพาะแอดมิน / ผ่าน RPC หลังทำเสร็จ)
create table if not exists question_keys (
  question_id uuid primary key references questions(id) on delete cascade,
  correct_choice text not null,
  explanation text
);

-- การทำข้อสอบแต่ละครั้ง
create table if not exists attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  exam_set_id uuid not null references exam_sets(id) on delete cascade,
  score int not null default 0,
  total int not null default 0,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

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

create index if not exists idx_questions_set on questions(exam_set_id);
create index if not exists idx_attempts_user on attempts(user_id, exam_set_id);
create index if not exists idx_replies_thread on qa_replies(thread_id);

-- ---------- เปิด Row Level Security ----------
alter table profiles enable row level security;
alter table exam_sets enable row level security;
alter table questions enable row level security;
alter table question_keys enable row level security;
alter table attempts enable row level security;
alter table answers enable row level security;
alter table qa_threads enable row level security;
alter table qa_replies enable row level security;

-- profiles: ใครก็อ่าน/สร้างได้ (ระบบไม่ต้องยืนยันตัวตน)
drop policy if exists p_profiles_sel on profiles;
create policy p_profiles_sel on profiles for select using (true);
drop policy if exists p_profiles_ins on profiles;
create policy p_profiles_ins on profiles for insert with check (true);

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

-- qa: เขียนได้ทุกคน แต่การอ่านแยกระหว่าง public กับ private
drop policy if exists p_threads_ins on qa_threads;
create policy p_threads_ins on qa_threads for insert with check (true);
drop policy if exists p_replies_ins on qa_replies;
create policy p_replies_ins on qa_replies for insert with check (true);

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

-- ---------- ฟังก์ชัน (RPC) ----------

-- แอดมินสร้างชุดข้อสอบ + คำถาม + เฉลย ในครั้งเดียว
create or replace function create_exam_set(
  p_day int, p_title text, p_published boolean, p_questions jsonb
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

  insert into exam_sets(day_number, title, published, question_count, created_by)
  values (p_day, p_title, p_published, jsonb_array_length(p_questions), auth.uid())
  returning id into v_set_id;

  for rec in select * from jsonb_array_elements(p_questions) loop
    insert into questions(exam_set_id, order_index, question_text, choices)
    values (v_set_id, v_idx, rec->>'question_text', rec->'choices')
    returning id into v_q_id;

    insert into question_keys(question_id, correct_choice, explanation)
    values (v_q_id, rec->>'correct_choice', rec->>'explanation');

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

  insert into questions(exam_set_id, order_index, question_text, choices)
  values (p_exam_set_id, v_idx, p_question->>'question_text', p_question->'choices')
  returning id into v_q_id;

  insert into question_keys(question_id, correct_choice, explanation)
  values (v_q_id, p_question->>'correct_choice', p_question->>'explanation');

  update exam_sets set question_count = question_count + 1 where id = p_exam_set_id;

  return v_q_id;
end;
$$;

-- ผู้ใช้ส่งคำตอบ -> ระบบตรวจให้คะแนน (เฉลยไม่หลุดออกไปฝั่ง client)
create or replace function submit_attempt(
  p_user_id uuid, p_exam_set_id uuid, p_answers jsonb
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
  select count(*) into v_total from questions where exam_set_id = p_exam_set_id;

  insert into attempts(user_id, exam_set_id, score, total, completed)
  values (p_user_id, p_exam_set_id, 0, v_total, true)
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
      'choices', q.choices,
      'correct_choice', k.correct_choice,
      'explanation', k.explanation,
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
    'items', coalesce(v_items, '[]'::jsonb)
  );
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

grant execute on function create_exam_set(int, text, boolean, jsonb) to authenticated;
grant execute on function add_question(uuid, jsonb) to authenticated;
grant execute on function get_private_threads(uuid) to anon, authenticated;
grant execute on function submit_attempt(uuid, uuid, jsonb) to anon, authenticated;
grant execute on function get_review(uuid, uuid) to anon, authenticated;

-- ---------- Realtime (แจ้งเตือนข้อสอบใหม่ + ถาม-ตอบสด) ----------
alter publication supabase_realtime add table exam_sets;
alter publication supabase_realtime add table qa_threads;
alter publication supabase_realtime add table qa_replies;
