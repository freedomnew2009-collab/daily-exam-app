-- ============================================================
--  Migration 011 — ศูนย์ฝึกซ้อม: สถิติ, จุดอ่อนรายหมวด, ทบทวนข้อผิด, ติวแยกหมวด, streak
--  วิธีใช้: Supabase Dashboard -> SQL Editor -> วางทั้งไฟล์นี้ -> Run
--  (รันซ้ำได้ ปลอดภัย)
-- ============================================================

-- สถิติของผู้ใช้: ความแม่นรวม, แยกตามหมวด (จุดอ่อน), คะแนนล่าสุด, streak รายวัน
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

  -- แยกตามหมวด เรียงจุดอ่อนก่อน (ความแม่นต่ำสุดขึ้นก่อน)
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

  -- คะแนนล่าสุด 10 ครั้ง
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

  -- streak: จำนวนวันติดต่อกันที่ทำข้อสอบ (เวลาไทย) นับจากวันนี้/เมื่อวานย้อนหลัง
  for r in
    select distinct (created_at at time zone 'Asia/Bangkok')::date as d
    from attempts where user_id = p_user_id and completed
    order by d desc
  loop
    if v_first then
      if r.d = v_today or r.d = v_today - 1 then
        v_streak := 1;
        v_expected := r.d - 1;
        v_first := false;
      else
        exit;
      end if;
    elsif r.d = v_expected then
      v_streak := v_streak + 1;
      v_expected := r.d - 1;
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

-- ข้อที่ผู้ใช้ "ตอบผิดครั้งล่าสุด" (ถ้าภายหลังตอบถูกแล้วจะไม่นับ) — สำหรับโหมดทบทวน
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
      'question_id', q.id,
      'question_text', q.question_text,
      'image_url', q.image_url,
      'category', q.category,
      'choices', q.choices,
      'correct_choice', k.correct_choice,
      'explanation', k.explanation,
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

-- รายชื่อหมวดที่มีข้อสอบ (จากชุดที่เผยแพร่แล้ว) + จำนวนข้อ
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

-- สุ่มข้อจากหมวดหนึ่ง (ข้ามชุด) สำหรับติวแยกหมวด — รวมเฉลยไว้เผยหลังตอบ
create or replace function get_category_questions(p_category text, p_limit int default 10)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_items jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
      'question_id', q_id,
      'question_text', question_text,
      'image_url', image_url,
      'category', category,
      'choices', choices,
      'correct_choice', correct_choice,
      'explanation', explanation,
      'explanation_images', explanation_images
    )), '[]'::jsonb)
  into v_items
  from (
    select q.id as q_id, q.question_text, q.image_url, q.category, q.choices,
           k.correct_choice, k.explanation,
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
