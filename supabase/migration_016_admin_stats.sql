-- ============================================================
--  Migration 016 — แอดมิน: ลบผลทำข้อสอบ + สรุป/กราฟสถิติ
--  วิธีใช้: Supabase Dashboard -> SQL Editor -> วางทั้งไฟล์นี้ -> Run
--  (รันซ้ำได้ ปลอดภัย · ต้องรัน migration_014 ก่อน เพราะใช้ question_points)
-- ============================================================

-- ลบผลการทำข้อสอบ 1 ครั้ง (answers ถูกลบตาม cascade)
create or replace function delete_attempt(p_attempt_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'unauthorized: admin only'; end if;
  delete from attempts where id = p_attempt_id;
end;
$$;
grant execute on function delete_attempt(uuid) to authenticated;

-- ลบผลทั้งหมดของผู้ใช้ในชุดหนึ่ง
create or replace function delete_user_set_attempts(p_user_id uuid, p_exam_set_id uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  if auth.uid() is null then raise exception 'unauthorized: admin only'; end if;
  with d as (delete from attempts where user_id = p_user_id and exam_set_id = p_exam_set_id returning 1)
  select count(*) into v_n from d;
  return v_n;
end;
$$;
grant execute on function delete_user_set_attempts(uuid, uuid) to authenticated;

-- ตารางคะแนน: ผู้ใช้ x ชุด (คะแนนสูงสุดของแต่ละคนในแต่ละชุด)
create or replace function get_score_matrix()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_users jsonb; v_sets jsonb; v_cells jsonb;
begin
  if auth.uid() is null then raise exception 'unauthorized: admin only'; end if;

  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'username', username) order by username), '[]'::jsonb)
    into v_users
  from profiles p
  where exists (select 1 from attempts a where a.user_id = p.id and a.completed);

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'title', s.title, 'day_number', s.day_number,
      'total', coalesce((select sum(question_points(q.q_type, q.choices)) from questions q where q.exam_set_id = s.id), 0)
    ) order by s.day_number), '[]'::jsonb)
    into v_sets
  from exam_sets s
  where exists (select 1 from attempts a where a.exam_set_id = s.id and a.completed);

  select coalesce(jsonb_agg(jsonb_build_object(
      'user_id', user_id, 'exam_set_id', exam_set_id,
      'best', best, 'best_total', best_total, 'attempts', cnt, 'last_at', last_at)), '[]'::jsonb)
    into v_cells
  from (
    select user_id, exam_set_id, max(score) as best,
           (array_agg(total order by score desc, created_at desc))[1] as best_total,
           count(*) as cnt, max(created_at) as last_at
    from attempts where completed
    group by user_id, exam_set_id
  ) t;

  return jsonb_build_object('users', v_users, 'sets', v_sets, 'cells', v_cells);
end;
$$;
grant execute on function get_score_matrix() to authenticated;

-- สถิติรายข้อของชุดหนึ่ง: ข้อไหนคนตอบผิดเยอะสุด
create or replace function get_question_stats(p_exam_set_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_items jsonb;
begin
  if auth.uid() is null then raise exception 'unauthorized: admin only'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'question_id', q.id, 'order_index', q.order_index, 'question_text', q.question_text,
      'q_type', coalesce(q.q_type, 'mc'),
      'answered', coalesce(st.answered, 0), 'wrong', coalesce(st.wrong, 0),
      'wrong_pct', case when coalesce(st.answered, 0) > 0
                        then round(100.0 * st.wrong / st.answered)::int else 0 end
    ) order by case when coalesce(st.answered, 0) > 0 then 1.0 * st.wrong / st.answered else -1 end desc, q.order_index), '[]'::jsonb)
  into v_items
  from questions q
  left join (
    select question_id, count(*) as answered, count(*) filter (where not is_correct) as wrong
    from answers group by question_id
  ) st on st.question_id = q.id
  where q.exam_set_id = p_exam_set_id;
  return jsonb_build_object('items', coalesce(v_items, '[]'::jsonb));
end;
$$;
grant execute on function get_question_stats(uuid) to authenticated;
