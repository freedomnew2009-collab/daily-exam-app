-- ============================================================
--  Migration 002 — จับเวลาทั้งชุด + ผลตรวจสำหรับแอดมิน + รูปในคำถาม
--  วิธีใช้: Supabase Dashboard -> SQL Editor -> วางทั้งไฟล์นี้ -> Run
--  (รันซ้ำได้ ปลอดภัย ไม่ลบข้อมูลเดิม)
-- ============================================================

-- ---------- 1) รูปภาพในคำถาม ----------
alter table questions add column if not exists image_url text;

-- ---------- 2) เวลาที่ใช้ทำข้อสอบทั้งชุด (วินาที) ----------
alter table attempts add column if not exists duration_seconds int not null default 0;

-- ---------- 3) สร้างชุดข้อสอบ (รองรับรูป) ----------
create or replace function create_exam_set(
  p_day int, p_title text, p_published boolean, p_questions jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_set_id uuid;
  rec jsonb;
  v_q_id uuid;
  v_idx int := 0;
begin
  if auth.uid() is null then
    raise exception 'unauthorized: admin only';
  end if;

  insert into exam_sets(day_number, title, published, question_count, created_by)
  values (p_day, p_title, p_published, jsonb_array_length(p_questions), auth.uid())
  returning id into v_set_id;

  for rec in select * from jsonb_array_elements(p_questions) loop
    insert into questions(exam_set_id, order_index, question_text, choices, image_url)
    values (v_set_id, v_idx, rec->>'question_text', rec->'choices',
            nullif(rec->>'image_url', ''))
    returning id into v_q_id;

    insert into question_keys(question_id, correct_choice, explanation)
    values (v_q_id, rec->>'correct_choice', rec->>'explanation');

    v_idx := v_idx + 1;
  end loop;

  return v_set_id;
end;
$$;

-- ---------- 4) เพิ่มคำถามทีละข้อเข้าชุดเดิม (รองรับรูป) ----------
create or replace function add_question(
  p_exam_set_id uuid, p_question jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_q_id uuid;
  v_idx int;
begin
  if auth.uid() is null then
    raise exception 'unauthorized: admin only';
  end if;

  select coalesce(max(order_index), -1) + 1 into v_idx
    from questions where exam_set_id = p_exam_set_id;

  insert into questions(exam_set_id, order_index, question_text, choices, image_url)
  values (p_exam_set_id, v_idx, p_question->>'question_text', p_question->'choices',
          nullif(p_question->>'image_url', ''))
  returning id into v_q_id;

  insert into question_keys(question_id, correct_choice, explanation)
  values (v_q_id, p_question->>'correct_choice', p_question->>'explanation');

  update exam_sets set question_count = question_count + 1 where id = p_exam_set_id;

  return v_q_id;
end;
$$;

-- ---------- 5) ส่งคำตอบ + บันทึกเวลาที่ใช้ทั้งชุด ----------
-- เปลี่ยน signature (เพิ่ม p_duration) จึงต้อง drop ของเดิมก่อน
drop function if exists submit_attempt(uuid, uuid, jsonb);
drop function if exists submit_attempt(uuid, uuid, jsonb, int);
create function submit_attempt(
  p_user_id uuid, p_exam_set_id uuid, p_answers jsonb, p_duration int default 0
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_attempt_id uuid;
  v_total int;
  v_score int := 0;
  rec jsonb;
  v_correct text;
  v_ok boolean;
begin
  if exists (select 1 from profiles where id = p_user_id and suspended) then
    raise exception 'suspended: บัญชีนี้ถูกระงับการใช้งาน';
  end if;

  select count(*) into v_total from questions where exam_set_id = p_exam_set_id;

  insert into attempts(user_id, exam_set_id, score, total, completed, duration_seconds)
  values (p_user_id, p_exam_set_id, 0, v_total, true, greatest(0, coalesce(p_duration, 0)))
  returning id into v_attempt_id;

  for rec in select * from jsonb_array_elements(p_answers) loop
    select correct_choice into v_correct
      from question_keys where question_id = (rec->>'question_id')::uuid;
    v_ok := (v_correct is not null and v_correct = (rec->>'selected_choice'));
    if v_ok then v_score := v_score + 1; end if;

    insert into answers(attempt_id, question_id, user_id, selected_choice, reason, is_correct)
    values (v_attempt_id, (rec->>'question_id')::uuid, p_user_id,
            rec->>'selected_choice', rec->>'reason', v_ok);
  end loop;

  update attempts set score = v_score where id = v_attempt_id;
  return jsonb_build_object('attempt_id', v_attempt_id, 'score', v_score, 'total', v_total);
end;
$$;
grant execute on function submit_attempt(uuid, uuid, jsonb, int) to anon, authenticated;

-- ---------- 6) ดูเฉลย (รวมรูป + เวลาที่ใช้) ----------
create or replace function get_review(
  p_user_id uuid, p_exam_set_id uuid
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_attempt attempts%rowtype;
  v_items jsonb;
begin
  select * into v_attempt from attempts
    where user_id = p_user_id and exam_set_id = p_exam_set_id and completed = true
    order by created_at desc limit 1;

  if not found then
    raise exception 'locked: must complete this exam first';
  end if;

  select jsonb_agg(jsonb_build_object(
      'question_id', q.id,
      'question_text', q.question_text,
      'image_url', q.image_url,
      'choices', q.choices,
      'correct_choice', k.correct_choice,
      'explanation', k.explanation,
      'your_choice', a.selected_choice,
      'your_reason', a.reason,
      'is_correct', coalesce(a.is_correct, false)
    ) order by q.order_index)
  into v_items
  from questions q
  join question_keys k on k.question_id = q.id
  left join answers a on a.question_id = q.id and a.attempt_id = v_attempt.id
  where q.exam_set_id = p_exam_set_id;

  return jsonb_build_object(
    'score', v_attempt.score, 'total', v_attempt.total,
    'duration_seconds', v_attempt.duration_seconds,
    'items', coalesce(v_items, '[]'::jsonb)
  );
end;
$$;

-- ---------- 7) ผลตรวจสำหรับแอดมิน (เห็นคำตอบ + เหตุผลของทุกคน) ----------
create or replace function get_exam_results(p_exam_set_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_items jsonb;
begin
  if auth.uid() is null then
    raise exception 'unauthorized: admin only';
  end if;

  select jsonb_agg(att order by att_created desc) into v_items
  from (
    select a.created_at as att_created,
      jsonb_build_object(
        'attempt_id', a.id,
        'username', p.username,
        'score', a.score,
        'total', a.total,
        'duration_seconds', a.duration_seconds,
        'created_at', a.created_at,
        'answers', coalesce((
          select jsonb_agg(jsonb_build_object(
            'order_index', q.order_index,
            'question_text', q.question_text,
            'selected_choice', ans.selected_choice,
            'correct_choice', k.correct_choice,
            'is_correct', ans.is_correct,
            'reason', ans.reason
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
  ) sub;

  return jsonb_build_object('items', coalesce(v_items, '[]'::jsonb));
end;
$$;
grant execute on function get_exam_results(uuid) to authenticated;

-- ---------- 8) ที่เก็บรูปคำถาม (Supabase Storage) ----------
insert into storage.buckets (id, name, public)
values ('question-images', 'question-images', true)
on conflict (id) do nothing;

-- อ่านรูปได้ทุกคน (bucket สาธารณะ)
drop policy if exists qimg_public_read on storage.objects;
create policy qimg_public_read on storage.objects for select
  using (bucket_id = 'question-images');

-- อัปโหลด/ลบรูปได้เฉพาะแอดมิน (ผู้ที่ login ผ่าน Supabase Auth)
drop policy if exists qimg_admin_insert on storage.objects;
create policy qimg_admin_insert on storage.objects for insert
  with check (bucket_id = 'question-images' and auth.uid() is not null);

drop policy if exists qimg_admin_delete on storage.objects;
create policy qimg_admin_delete on storage.objects for delete
  using (bucket_id = 'question-images' and auth.uid() is not null);
