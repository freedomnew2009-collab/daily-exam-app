-- ============================================================
--  Migration 020 — 🌳 เกมปลูกต้นไม้
--  ตอบข้อสอบถูก 1 ข้อ = 1 หยดน้ำ · รดน้ำครบ 5 หยด = อัป 1 เลเวล
--  วิธีใช้: Supabase Dashboard -> SQL Editor -> วางทั้งไฟล์นี้ -> Run
--  (รันซ้ำได้ ปลอดภัย · ต้องรัน migration_014 มาก่อน)
-- ============================================================

create table if not exists garden (
  user_id uuid primary key references profiles(id) on delete cascade,
  drops int not null default 0,
  growth int not null default 0,
  updated_at timestamptz not null default now()
);
alter table garden enable row level security;

create or replace function add_drops(p_user_id uuid, p_n int)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(p_n, 0) <= 0 then return; end if;
  insert into garden(user_id, drops) values (p_user_id, p_n)
  on conflict (user_id) do update set drops = garden.drops + p_n, updated_at = now();
end;
$$;
grant execute on function add_drops(uuid, int) to anon, authenticated;

create or replace function get_garden(p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_drops int := 0; v_growth int := 0;
begin
  select drops, growth into v_drops, v_growth from garden where user_id = p_user_id;
  v_drops := coalesce(v_drops, 0); v_growth := coalesce(v_growth, 0);
  return jsonb_build_object('drops', v_drops, 'growth', v_growth,
    'level', v_growth / 5 + 1, 'in_level', v_growth % 5, 'per_level', 5);
end;
$$;
grant execute on function get_garden(uuid) to anon, authenticated;

create or replace function water_tree(p_user_id uuid, p_count int default 1)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_drops int; v_growth int; v_use int; v_old_level int; v_new_level int;
begin
  insert into garden(user_id) values (p_user_id) on conflict (user_id) do nothing;
  select drops, growth into v_drops, v_growth from garden where user_id = p_user_id for update;
  v_use := least(greatest(coalesce(p_count, 1), 0), v_drops);
  v_old_level := v_growth / 5 + 1;
  update garden set drops = drops - v_use, growth = growth + v_use, updated_at = now()
    where user_id = p_user_id
    returning drops, growth into v_drops, v_growth;
  v_new_level := v_growth / 5 + 1;
  return jsonb_build_object('drops', v_drops, 'growth', v_growth, 'level', v_new_level,
    'in_level', v_growth % 5, 'per_level', 5, 'used', v_use, 'leveled_up', v_new_level - v_old_level);
end;
$$;
grant execute on function water_tree(uuid, int) to anon, authenticated;

-- ให้ submit ข้อสอบมอบหยดน้ำ (= จำนวนข้อที่ตอบถูก)
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
  perform add_drops(p_user_id, v_score);
  return jsonb_build_object('attempt_id', v_attempt_id, 'score', v_score, 'total', v_total);
end;
$$;
grant execute on function submit_attempt(uuid, uuid, jsonb, int) to anon, authenticated;

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
  perform add_drops(p_user_id, v_score);
  return jsonb_build_object('attempt_id', v_attempt_id, 'score', v_score, 'total', v_total);
end;
$$;
grant execute on function submit_category_attempt(uuid, text, jsonb, int) to anon, authenticated;
