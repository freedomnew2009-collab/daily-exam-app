-- ============================================================
--  Migration 023 — รางวัลเกม (หยดน้ำ/streak/เป้าหมาย) นับเฉพาะ "ครั้งแรก" ของแต่ละชุด
--  ทำซ้ำชุดเดิม = ไม่ได้รางวัลเพิ่ม (กันฟาร์ม)
--  วิธีใช้: Supabase Dashboard -> SQL Editor -> วางทั้งไฟล์นี้ -> Run
--  (รันซ้ำได้ ปลอดภัย · ต้องรัน migration_021 มาก่อน)
-- ============================================================

create or replace function submit_attempt(
  p_user_id uuid, p_exam_set_id uuid, p_answers jsonb, p_duration int default 0
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_attempt_id uuid; v_total int; v_score int := 0; rec jsonb; v_sel text; v_g jsonb; v_game jsonb; v_first boolean;
begin
  if exists (select 1 from profiles where id = p_user_id and suspended) then
    raise exception 'suspended: บัญชีนี้ถูกระงับการใช้งาน';
  end if;

  v_first := not exists (
    select 1 from attempts where user_id = p_user_id and exam_set_id = p_exam_set_id and completed
  );

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
  if v_first then
    v_game := register_activity(p_user_id, v_score);
  else
    v_game := jsonb_build_object('repeat', true);
  end if;
  return jsonb_build_object('attempt_id', v_attempt_id, 'score', v_score, 'total', v_total, 'game', v_game);
end;
$$;
grant execute on function submit_attempt(uuid, uuid, jsonb, int) to anon, authenticated;

create or replace function submit_category_attempt(
  p_user_id uuid, p_category text, p_answers jsonb, p_duration int default 0
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_attempt_id uuid; v_total int := 0; v_score int := 0; rec jsonb; v_sel text; v_g jsonb; v_game jsonb; v_first boolean;
begin
  if exists (select 1 from profiles where id = p_user_id and suspended) then
    raise exception 'suspended: บัญชีนี้ถูกระงับการใช้งาน';
  end if;

  v_first := not exists (select 1 from category_attempts where user_id = p_user_id and category = p_category);

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
  if v_first then
    v_game := register_activity(p_user_id, v_score);
  else
    v_game := jsonb_build_object('repeat', true);
  end if;
  return jsonb_build_object('attempt_id', v_attempt_id, 'score', v_score, 'total', v_total, 'game', v_game);
end;
$$;
grant execute on function submit_category_attempt(uuid, text, jsonb, int) to anon, authenticated;
