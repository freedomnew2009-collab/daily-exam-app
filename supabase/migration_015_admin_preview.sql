-- ============================================================
--  Migration 015 — หน้าทดสอบข้อสอบสำหรับแอดมิน (พรีวิว ไม่บันทึกคะแนน)
--  วิธีใช้: Supabase Dashboard -> SQL Editor -> วางทั้งไฟล์นี้ -> Run
--  (รันซ้ำได้ ปลอดภัย · ต้องรัน migration_014 ก่อน เพราะใช้ grade_answer/question_points)
-- ============================================================

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
