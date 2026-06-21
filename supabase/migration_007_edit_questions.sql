-- ============================================================
--  Migration 007 — แอดมินแก้ไข/ลบคำถามรายข้อในชุดเดิมได้
--  วิธีใช้: Supabase Dashboard -> SQL Editor -> วางทั้งไฟล์นี้ -> Run
--  (รันซ้ำได้ ปลอดภัย)
-- ============================================================

-- แก้ไขคำถามเดิม + เฉลย
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
      explanation = p_question->>'explanation'
    where question_id = p_question_id;
  else
    insert into question_keys(question_id, correct_choice, explanation)
    values (p_question_id, p_question->>'correct_choice', p_question->>'explanation');
  end if;
end;
$$;
grant execute on function update_question(uuid, jsonb) to authenticated;

-- ลบคำถามเดิม (ลด question_count ของชุดให้ด้วย)
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
