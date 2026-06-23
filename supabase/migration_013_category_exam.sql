-- ============================================================
--  Migration 013 — ข้อสอบรายหมวด (รวมข้อจากทุกชุด เก็บคะแนน + ดูเฉลยทีหลัง)
--  วิธีใช้: Supabase Dashboard -> SQL Editor -> วางทั้งไฟล์นี้ -> Run
--  (รันซ้ำได้ ปลอดภัย)
-- ============================================================

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
      'category', q.category, 'choices', q.choices
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
declare v_attempt_id uuid; v_total int; v_score int := 0; rec jsonb; v_correct text; v_ok boolean;
begin
  if exists (select 1 from profiles where id = p_user_id and suspended) then
    raise exception 'suspended: บัญชีนี้ถูกระงับการใช้งาน';
  end if;
  v_total := coalesce(jsonb_array_length(p_answers), 0);
  insert into category_attempts(user_id, category, score, total, duration_seconds)
  values (p_user_id, p_category, 0, v_total, greatest(0, coalesce(p_duration, 0)))
  returning id into v_attempt_id;

  for rec in select * from jsonb_array_elements(p_answers) loop
    select correct_choice into v_correct
      from question_keys where question_id = (rec->>'question_id')::uuid;
    v_ok := (v_correct is not null and v_correct = (rec->>'selected_choice'));
    if v_ok then v_score := v_score + 1; end if;
    insert into category_answers(attempt_id, question_id, user_id, selected_choice, is_correct)
    values (v_attempt_id, (rec->>'question_id')::uuid, p_user_id, rec->>'selected_choice', v_ok);
  end loop;

  update category_attempts set score = v_score where id = v_attempt_id;
  return jsonb_build_object('attempt_id', v_attempt_id, 'score', v_score, 'total', v_total);
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
      'category', q.category, 'choices', q.choices, 'correct_choice', k.correct_choice,
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
