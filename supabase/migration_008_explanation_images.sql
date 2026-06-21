-- ============================================================
--  Migration 008 — รูปประกอบในคำอธิบาย/เฉลย
--  วิธีใช้: Supabase Dashboard -> SQL Editor -> วางทั้งไฟล์นี้ -> Run
--  ต้องรันหลัง migration_006 และ 007 แล้ว (รันซ้ำได้ ปลอดภัย)
-- ============================================================

alter table question_keys add column if not exists explanation_images jsonb not null default '[]'::jsonb;

-- สร้างชุดข้อสอบ (เก็บรูปคำอธิบายด้วย)
create or replace function create_exam_set(
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
grant execute on function create_exam_set(int, text, boolean, jsonb, text) to authenticated;

-- เพิ่มคำถามทีละข้อ
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

-- แก้ไขคำถามเดิม
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

-- ดูเฉลย (ส่งรูปคำอธิบายกลับด้วย)
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
