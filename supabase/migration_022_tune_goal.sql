-- ============================================================
--  Migration 022 — ปรับเป้าหมายรายวันเหลือ 5 (ข้อสอบมีวันละ 5 ข้อ)
--  วิธีใช้: Supabase Dashboard -> SQL Editor -> วางทั้งไฟล์นี้ -> Run
--  (รันซ้ำได้ ปลอดภัย · ต้องรัน migration_021 มาก่อน)
-- ============================================================

alter table game_stats alter column daily_goal set default 5;
update game_stats set daily_goal = 5 where daily_goal = 10;

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
  v_goal := coalesce(v_goal, 5);

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
  v_goal := coalesce(v_goal, 5);
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
