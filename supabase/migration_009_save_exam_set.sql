-- ============================================================
--  Migration 009 — บันทึกการแก้ไขชุดข้อสอบแบบ atomic (กันข้อซ้ำ)
--  วิธีใช้: Supabase Dashboard -> SQL Editor -> วางทั้งไฟล์นี้ -> Run
--  ต้องรันหลัง migration_006/007/008 (รันซ้ำได้ ปลอดภัย)
--
--  ทำไมถึงต้องมี: เดิมหน้าแอดมินบันทึกการแก้ไขทีละข้อ ถ้ากดบันทึกซ้ำ
--  ข้อที่เพิ่งเพิ่มใหม่ (ยังไม่มี id ในฟอร์ม) จะถูกเพิ่มซ้ำกลายเป็นข้อซ้ำ
--  ฟังก์ชันนี้ทำ upsert ตาม id ในคราวเดียว เรียกซ้ำกี่ครั้งก็ไม่ซ้ำ
-- ============================================================

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

    -- มี id และเป็นข้อของชุดนี้จริง -> แก้ไขที่เดิม (ไม่สร้างใหม่)
    if qid is not null
       and exists (select 1 from questions where id = qid and exam_set_id = p_set_id) then
      update questions set
        order_index = idx,
        question_text = rec->>'question_text',
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
      -- ไม่มี id -> เพิ่มข้อใหม่
      insert into questions(exam_set_id, order_index, question_text, choices, image_url, category)
      values (p_set_id, idx, rec->>'question_text', rec->'choices',
              nullif(rec->>'image_url', ''), nullif(btrim(rec->>'category'), ''))
      returning id into qid;

      insert into question_keys(question_id, correct_choice, explanation, explanation_images)
      values (qid, rec->>'correct_choice', rec->>'explanation',
              coalesce(rec->'explanation_images', '[]'::jsonb));

      v_added := v_added + 1;
    end if;

    idx := idx + 1;
  end loop;

  -- ปรับจำนวนข้อให้ตรงกับความจริงเสมอ
  update exam_sets
    set question_count = (select count(*) from questions where exam_set_id = p_set_id)
    where id = p_set_id;

  return jsonb_build_object('updated', v_updated, 'added', v_added);
end;
$$;
grant execute on function save_exam_set(uuid, text, jsonb) to authenticated;
