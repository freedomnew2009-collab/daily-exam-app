-- ============================================================
--  Migration 024 — แอดมินดูรายชื่อผู้เข้าอ่านบทความ
--  วิธีใช้: Supabase Dashboard -> SQL Editor -> วางทั้งไฟล์นี้ -> Run
--  (รันซ้ำได้ ปลอดภัย · ต้องรัน migration_019 มาก่อน)
-- ============================================================

create or replace function get_article_viewers(p_article_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'unauthorized: admin only'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
        'username', p.username,
        'viewed_at', v.created_at,
        'read', exists (select 1 from article_reads r where r.article_id = p_article_id and r.user_id = v.user_id)
      ) order by v.created_at desc)
    from article_views v join profiles p on p.id = v.user_id
    where v.article_id = p_article_id
  ), '[]'::jsonb);
end;
$$;
grant execute on function get_article_viewers(uuid) to authenticated;
