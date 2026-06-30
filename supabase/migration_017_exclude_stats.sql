-- ============================================================
--  Migration 017 — กำหนดบัญชีที่ "ไม่นับในสถิติ" (บัญชีทดสอบ/แอดมิน)
--  วิธีใช้: Supabase Dashboard -> SQL Editor -> วางทั้งไฟล์นี้ -> Run
--  (รันซ้ำได้ ปลอดภัย · ต้องรัน migration_014/016 มาก่อน)
-- ============================================================

alter table profiles add column if not exists exclude_stats boolean not null default false;

-- ผลตรวจ: ตัดบัญชีที่ไม่นับสถิติออก
create or replace function get_exam_results(p_exam_set_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_items jsonb;
begin
  if auth.uid() is null then raise exception 'unauthorized: admin only'; end if;
  select jsonb_agg(att order by att_created desc) into v_items
  from (
    select a.created_at as att_created,
      jsonb_build_object(
        'attempt_id', a.id, 'username', p.username, 'score', a.score, 'total', a.total,
        'duration_seconds', a.duration_seconds, 'created_at', a.created_at,
        'answers', coalesce((
          select jsonb_agg(jsonb_build_object(
            'order_index', q.order_index, 'question_text', q.question_text,
            'selected_choice', ans.selected_choice, 'correct_choice', k.correct_choice,
            'is_correct', ans.is_correct, 'reason', ans.reason
          ) order by q.order_index)
          from answers ans
          join questions q on q.id = ans.question_id
          left join question_keys k on k.question_id = q.id
          where ans.attempt_id = a.id
        ), '[]'::jsonb)
      ) as att
    from attempts a
    join profiles p on p.id = a.user_id
    where a.exam_set_id = p_exam_set_id and a.completed = true
      and not coalesce(p.exclude_stats, false)
  ) sub;
  return jsonb_build_object('items', coalesce(v_items, '[]'::jsonb));
end;
$$;
grant execute on function get_exam_results(uuid) to authenticated;

-- ตารางคะแนน: ตัดบัญชีที่ไม่นับสถิติออก
create or replace function get_score_matrix()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_users jsonb; v_sets jsonb; v_cells jsonb;
begin
  if auth.uid() is null then raise exception 'unauthorized: admin only'; end if;

  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'username', username) order by username), '[]'::jsonb)
    into v_users
  from profiles p
  where not coalesce(p.exclude_stats, false)
    and exists (select 1 from attempts a where a.user_id = p.id and a.completed);

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'title', s.title, 'day_number', s.day_number,
      'total', coalesce((select sum(question_points(q.q_type, q.choices)) from questions q where q.exam_set_id = s.id), 0)
    ) order by s.day_number), '[]'::jsonb)
    into v_sets
  from exam_sets s
  where exists (
    select 1 from attempts a join profiles pr on pr.id = a.user_id
    where a.exam_set_id = s.id and a.completed and not coalesce(pr.exclude_stats, false)
  );

  select coalesce(jsonb_agg(jsonb_build_object(
      'user_id', user_id, 'exam_set_id', exam_set_id,
      'best', best, 'best_total', best_total, 'attempts', cnt, 'last_at', last_at)), '[]'::jsonb)
    into v_cells
  from (
    select a.user_id, a.exam_set_id, max(a.score) as best,
           (array_agg(a.total order by a.score desc, a.created_at desc))[1] as best_total,
           count(*) as cnt, max(a.created_at) as last_at
    from attempts a join profiles p on p.id = a.user_id
    where a.completed and not coalesce(p.exclude_stats, false)
    group by a.user_id, a.exam_set_id
  ) t;

  return jsonb_build_object('users', v_users, 'sets', v_sets, 'cells', v_cells);
end;
$$;
grant execute on function get_score_matrix() to authenticated;

-- สถิติรายข้อ: ตัดบัญชีที่ไม่นับสถิติออก
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
    select an.question_id, count(*) as answered, count(*) filter (where not an.is_correct) as wrong
    from answers an join profiles p on p.id = an.user_id
    where not coalesce(p.exclude_stats, false)
    group by an.question_id
  ) st on st.question_id = q.id
  where q.exam_set_id = p_exam_set_id;
  return jsonb_build_object('items', coalesce(v_items, '[]'::jsonb));
end;
$$;
grant execute on function get_question_stats(uuid) to authenticated;
