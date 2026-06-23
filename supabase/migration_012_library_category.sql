-- ============================================================
--  Migration 012 — คลังข้อสอบ: ดึงเฉพาะข้อในหมวดนั้นของแต่ละชุด (ไม่ใช่ทั้งชุด)
--  วิธีใช้: Supabase Dashboard -> SQL Editor -> วางทั้งไฟล์นี้ -> Run
-- ============================================================

create or replace function get_set_category_questions(p_exam_set_id uuid, p_category text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_items jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
      'question_id', q.id,
      'question_text', q.question_text,
      'image_url', q.image_url,
      'category', q.category,
      'choices', q.choices,
      'correct_choice', k.correct_choice,
      'explanation', k.explanation,
      'explanation_images', coalesce(k.explanation_images, '[]'::jsonb)
    ) order by q.order_index), '[]'::jsonb)
  into v_items
  from questions q
  join question_keys k on k.question_id = q.id
  join exam_sets es on es.id = q.exam_set_id and es.published = true
  where q.exam_set_id = p_exam_set_id
    and coalesce(nullif(btrim(q.category), ''), 'อื่น ๆ') = p_category;
  return v_items;
end;
$$;
grant execute on function get_set_category_questions(uuid, text) to anon, authenticated;
