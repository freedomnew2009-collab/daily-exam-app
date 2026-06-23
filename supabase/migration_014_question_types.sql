-- ============================================================
--  Migration 014 — รูปแบบข้อสอบใหม่: เติมคำ (fill) + จับคู่ (match)
--  วิธีใช้: Supabase Dashboard -> SQL Editor -> วางทั้งไฟล์นี้ -> Run
--  (รันซ้ำได้ ปลอดภัย)
--
--  การเก็บข้อมูลแต่ละชนิด (questions.q_type):
--   • 'mc'   ปรนัย   : choices=[{key,text}], correct_choice = key (เช่น "A")
--   • 'fill' เติมคำ  : choices=[],           correct_choice = JSON array ของคำตอบที่ยอมรับ เช่น ["2","สอง"]
--   • 'match' จับคู่ : choices=[{key,left,right}], correct_choice='match'
--                      คำตอบผู้ใช้ = JSON {leftKey: ข้อความฝั่งขวาที่เลือก}
-- ============================================================

alter table questions add column if not exists q_type text not null default 'mc';

-- ---------- ตัวช่วยตรวจคำตอบ ----------

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
--  • mc   : ส่ง choices ตามเดิม (ไม่มีเฉลยอยู่แล้ว)
--  • fill : ส่ง []
--  • match: ส่ง { left:[{key,text}] เรียงตามเดิม, right:[{text}] สลับลำดับ } — ไม่บอกว่าคู่ไหนกับคู่ไหน
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

-- ---------- โหลดข้อสอบ "ชุดรายวัน" แบบปลอดภัย (แทนการ select ตรงจากตาราง) ----------
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

-- ---------- ส่งคำตอบ "ชุดรายวัน" (ตรวจด้วย grade_answer + คะแนนเต็มตามชนิดข้อ) ----------
create or replace function submit_attempt(
  p_user_id uuid, p_exam_set_id uuid, p_answers jsonb, p_duration int default 0
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_attempt_id uuid; v_total int; v_score int := 0; rec jsonb; v_sel text; v_g jsonb;
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
  return jsonb_build_object('attempt_id', v_attempt_id, 'score', v_score, 'total', v_total);
end;
$$;
grant execute on function submit_attempt(uuid, uuid, jsonb, int) to anon, authenticated;

-- ---------- ส่งคำตอบ "ข้อสอบรายหมวด" ----------
create or replace function submit_category_attempt(
  p_user_id uuid, p_category text, p_answers jsonb, p_duration int default 0
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_attempt_id uuid; v_total int := 0; v_score int := 0; rec jsonb; v_sel text; v_g jsonb;
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
  return jsonb_build_object('attempt_id', v_attempt_id, 'score', v_score, 'total', v_total);
end;
$$;
grant execute on function submit_category_attempt(uuid, text, jsonb, int) to anon, authenticated;

-- ---------- โหลดข้อสอบรายหมวด (ปลอดภัย ไม่หลุดเฉลย) ----------
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

-- ---------- เฉลย "ชุดรายวัน" (เพิ่ม q_type) ----------
create or replace function get_review(p_user_id uuid, p_exam_set_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_attempt attempts%rowtype; v_items jsonb;
begin
  select * into v_attempt from attempts
    where user_id = p_user_id and exam_set_id = p_exam_set_id and completed = true
    order by created_at desc limit 1;
  if not found then raise exception 'locked: must complete this exam first'; end if;

  select jsonb_agg(jsonb_build_object(
      'question_id', q.id, 'question_text', q.question_text, 'image_url', q.image_url,
      'category', q.category, 'q_type', coalesce(q.q_type, 'mc'), 'choices', q.choices,
      'correct_choice', k.correct_choice, 'explanation', k.explanation,
      'explanation_images', coalesce(k.explanation_images, '[]'::jsonb),
      'your_choice', a.selected_choice, 'your_reason', a.reason,
      'is_correct', coalesce(a.is_correct, false)
    ) order by q.order_index)
  into v_items
  from questions q
  join question_keys k on k.question_id = q.id
  left join answers a on a.question_id = q.id and a.attempt_id = v_attempt.id
  where q.exam_set_id = p_exam_set_id;

  return jsonb_build_object('score', v_attempt.score, 'total', v_attempt.total,
    'duration_seconds', v_attempt.duration_seconds, 'items', coalesce(v_items, '[]'::jsonb));
end;
$$;
grant execute on function get_review(uuid, uuid) to anon, authenticated;

-- ---------- เฉลย "รายหมวด" (เพิ่ม q_type) ----------
create or replace function get_category_review(p_user_id uuid, p_attempt_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_att category_attempts%rowtype; v_items jsonb;
begin
  select * into v_att from category_attempts where id = p_attempt_id and user_id = p_user_id;
  if not found then raise exception 'locked: must complete this category exam first'; end if;

  select jsonb_agg(jsonb_build_object(
      'question_id', q.id, 'question_text', q.question_text, 'image_url', q.image_url,
      'category', q.category, 'q_type', coalesce(q.q_type, 'mc'), 'choices', q.choices,
      'correct_choice', k.correct_choice, 'explanation', k.explanation,
      'explanation_images', coalesce(k.explanation_images, '[]'::jsonb),
      'your_choice', a.selected_choice, 'is_correct', coalesce(a.is_correct, false)
    ) order by a.created_at)
  into v_items
  from category_answers a
  join questions q on q.id = a.question_id
  join question_keys k on k.question_id = q.id
  where a.attempt_id = v_att.id;

  return jsonb_build_object('score', v_att.score, 'total', v_att.total, 'category', v_att.category,
    'duration_seconds', v_att.duration_seconds, 'items', coalesce(v_items, '[]'::jsonb));
end;
$$;
grant execute on function get_category_review(uuid, uuid) to anon, authenticated;

-- ---------- ฝึกซ้อม: ติวแยกหมวด (เพิ่ม q_type) ----------
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

-- ---------- ฝึกซ้อม: ทบทวนข้อที่ตอบผิด (เพิ่ม q_type) ----------
create or replace function get_wrong_questions(p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_items jsonb;
begin
  with latest as (
    select distinct on (a.question_id) a.question_id, a.is_correct
    from answers a where a.user_id = p_user_id
    order by a.question_id, a.created_at desc
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'question_id', q.id, 'question_text', q.question_text, 'image_url', q.image_url,
      'category', q.category, 'q_type', coalesce(q.q_type, 'mc'), 'choices', q.choices,
      'correct_choice', k.correct_choice, 'explanation', k.explanation,
      'explanation_images', coalesce(k.explanation_images, '[]'::jsonb)
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

-- ---------- แอดมิน: บันทึก q_type ตอนสร้าง/แก้ไข ----------
create or replace function create_exam_set(
  p_day int, p_title text, p_published boolean, p_questions jsonb, p_category text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_set_id uuid; v_q_id uuid; v_idx int := 0; rec jsonb;
begin
  if auth.uid() is null then raise exception 'unauthorized: admin only'; end if;

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
grant execute on function create_exam_set(int, text, boolean, jsonb, text) to authenticated;

create or replace function add_question(p_exam_set_id uuid, p_question jsonb)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_q_id uuid; v_idx int;
begin
  if auth.uid() is null then raise exception 'unauthorized: admin only'; end if;
  select coalesce(max(order_index), -1) + 1 into v_idx from questions where exam_set_id = p_exam_set_id;

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
grant execute on function add_question(uuid, jsonb) to authenticated;

create or replace function update_question(p_question_id uuid, p_question jsonb)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'unauthorized: admin only'; end if;

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

create or replace function save_exam_set(p_set_id uuid, p_title text, p_questions jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare rec jsonb; idx int := 0; qid uuid; v_updated int := 0; v_added int := 0;
begin
  if auth.uid() is null then raise exception 'unauthorized: admin only'; end if;
  update exam_sets set title = nullif(btrim(p_title), '') where id = p_set_id;

  for rec in select * from jsonb_array_elements(p_questions) loop
    qid := nullif(rec->>'id', '')::uuid;
    if qid is not null and exists (select 1 from questions where id = qid and exam_set_id = p_set_id) then
      update questions set
        order_index = idx, question_text = rec->>'question_text',
        q_type = coalesce(nullif(rec->>'q_type', ''), 'mc'),
        choices = rec->'choices', image_url = nullif(rec->>'image_url', ''),
        category = nullif(btrim(rec->>'category'), '')
      where id = qid;

      if exists (select 1 from question_keys where question_id = qid) then
        update question_keys set correct_choice = rec->>'correct_choice',
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

  update exam_sets set question_count = (select count(*) from questions where exam_set_id = p_set_id)
    where id = p_set_id;
  return jsonb_build_object('updated', v_updated, 'added', v_added);
end;
$$;
grant execute on function save_exam_set(uuid, text, jsonb) to authenticated;
