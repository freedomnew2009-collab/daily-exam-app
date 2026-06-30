-- ============================================================
--  Migration 021 — 🔥 เฟส 1: Streak ต่อเนื่อง + เป้าหมายรายวัน + Achievement
--  ตอบถูกได้หยดน้ำ + ทำติดกันหลายวันได้โบนัส + เป้าหมายตอบถูกต่อวัน
--  วิธีใช้: Supabase Dashboard -> SQL Editor -> วางทั้งไฟล์นี้ -> Run
--  (รันซ้ำได้ ปลอดภัย · ต้องรัน migration_020 มาก่อน)
-- ============================================================

create table if not exists game_stats (
  user_id uuid primary key references profiles(id) on delete cascade,
  current_streak int not null default 0,
  longest_streak int not null default 0,
  last_active date,
  daily_goal int not null default 10,
  goal_date date,
  goal_correct int not null default 0,
  goal_claimed boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table game_stats enable row level security;

create or replace function register_activity(p_user_id uuid, p_correct int)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
  v_last date; v_streak int; v_longest int; v_goal int; v_gdate date; v_gcorrect int; v_gclaimed boolean;
  v_new_day boolean := false; v_streak_bonus int := 0; v_goal_bonus int := 0; v_goal_done boolean := false; v_bonus int := 0;
begin
  insert into game_stats(user_id) values (p_user_id) on conflict (user_id) do nothing;
  select current_streak, longest_streak, last_active, daily_goal, goal_date, goal_correct, goal_claimed
    into v_streak, v_longest, v_last, v_goal, v_gdate, v_gcorrect, v_gclaimed
    from game_stats where user_id = p_user_id for update;
  v_goal := coalesce(v_goal, 10);

  if v_last = v_today then
    null;
  elsif v_last = v_today - 1 then
    v_streak := coalesce(v_streak, 0) + 1; v_new_day := true;
  else
    v_streak := 1; v_new_day := true;
  end if;
  v_longest := greatest(coalesce(v_longest, 0), v_streak);

  if v_new_day then
    v_streak_bonus := case
      when v_streak % 30 = 0 then 30
      when v_streak % 7 = 0 then 10
      when v_streak >= 3 then 3
      else 0 end;
  end if;

  if v_gdate is distinct from v_today then
    v_gdate := v_today; v_gcorrect := 0; v_gclaimed := false;
  end if;
  v_gcorrect := coalesce(v_gcorrect, 0) + greatest(coalesce(p_correct, 0), 0);
  if v_gcorrect >= v_goal and not coalesce(v_gclaimed, false) then
    v_goal_done := true; v_gclaimed := true; v_goal_bonus := 5;
  end if;

  update game_stats set current_streak = v_streak, longest_streak = v_longest, last_active = v_today,
    daily_goal = v_goal, goal_date = v_gdate, goal_correct = v_gcorrect, goal_claimed = v_gclaimed, updated_at = now()
    where user_id = p_user_id;

  v_bonus := v_streak_bonus + v_goal_bonus;
  perform add_drops(p_user_id, greatest(coalesce(p_correct, 0), 0) + v_bonus);

  return jsonb_build_object('streak', v_streak, 'new_day', v_new_day, 'streak_bonus', v_streak_bonus,
    'goal', v_goal, 'goal_correct', v_gcorrect, 'goal_done', v_goal_done, 'goal_bonus', v_goal_bonus,
    'base_drops', greatest(coalesce(p_correct, 0), 0), 'bonus_drops', v_bonus);
end;
$$;
grant execute on function register_activity(uuid, int) to anon, authenticated;

create or replace function get_game_stats(p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
  v_streak int; v_longest int; v_last date; v_goal int; v_gdate date; v_gcorrect int; v_gclaimed boolean;
  v_total_correct int; v_exams int; v_growth int; v_articles int; v_perfect int;
begin
  select current_streak, longest_streak, last_active, daily_goal, goal_date, goal_correct, goal_claimed
    into v_streak, v_longest, v_last, v_goal, v_gdate, v_gcorrect, v_gclaimed
    from game_stats where user_id = p_user_id;
  v_goal := coalesce(v_goal, 10);
  if v_last is null or v_last < v_today - 1 then v_streak := 0; end if;
  if v_gdate is distinct from v_today then v_gcorrect := 0; v_gclaimed := false; end if;

  select coalesce(sum(score), 0) into v_total_correct from (
    select score from attempts where user_id = p_user_id and completed
    union all select score from category_attempts where user_id = p_user_id
  ) z;
  select count(*) into v_exams from (
    select id from attempts where user_id = p_user_id and completed
    union all select id from category_attempts where user_id = p_user_id
  ) z2;
  select coalesce(growth, 0) into v_growth from garden where user_id = p_user_id;
  select count(*) into v_articles from article_reads where user_id = p_user_id;
  select count(*) into v_perfect from (
    select 1 from attempts where user_id = p_user_id and completed and total > 0 and score = total
    union all select 1 from category_attempts where user_id = p_user_id and total > 0 and score = total
  ) z3;

  return jsonb_build_object(
    'streak', coalesce(v_streak, 0), 'longest_streak', coalesce(v_longest, 0),
    'daily_goal', v_goal, 'goal_correct', coalesce(v_gcorrect, 0), 'goal_done', coalesce(v_gclaimed, false),
    'total_correct', coalesce(v_total_correct, 0), 'exams_done', coalesce(v_exams, 0),
    'tree_level', coalesce(v_growth, 0) / 5 + 1, 'articles_read', coalesce(v_articles, 0),
    'perfect_count', coalesce(v_perfect, 0)
  );
end;
$$;
grant execute on function get_game_stats(uuid) to anon, authenticated;

-- ให้ submit ข้อสอบเรียก register_activity (หยดน้ำ + streak + เป้าหมาย) แล้วส่ง game กลับ
create or replace function submit_attempt(
  p_user_id uuid, p_exam_set_id uuid, p_answers jsonb, p_duration int default 0
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_attempt_id uuid; v_total int; v_score int := 0; rec jsonb; v_sel text; v_g jsonb; v_game jsonb;
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
  v_game := register_activity(p_user_id, v_score);
  return jsonb_build_object('attempt_id', v_attempt_id, 'score', v_score, 'total', v_total, 'game', v_game);
end;
$$;
grant execute on function submit_attempt(uuid, uuid, jsonb, int) to anon, authenticated;

create or replace function submit_category_attempt(
  p_user_id uuid, p_category text, p_answers jsonb, p_duration int default 0
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_attempt_id uuid; v_total int := 0; v_score int := 0; rec jsonb; v_sel text; v_g jsonb; v_game jsonb;
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
  v_game := register_activity(p_user_id, v_score);
  return jsonb_build_object('attempt_id', v_attempt_id, 'score', v_score, 'total', v_total, 'game', v_game);
end;
$$;
grant execute on function submit_category_attempt(uuid, text, jsonb, int) to anon, authenticated;
