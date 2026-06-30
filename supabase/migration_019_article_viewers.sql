-- ============================================================
--  Migration 019 — นับผู้เข้าอ่านบทความเป็น "จำนวน User (ไม่ซ้ำ)" + จำนวนดาว
--  วิธีใช้: Supabase Dashboard -> SQL Editor -> วางทั้งไฟล์นี้ -> Run
--  (รันซ้ำได้ ปลอดภัย · ต้องรัน migration_018 มาก่อน)
-- ============================================================

create table if not exists article_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  article_id uuid not null references articles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, article_id)
);
alter table article_views enable row level security;
create index if not exists idx_article_views_article on article_views(article_id);

-- backfill: คนที่เคยอ่านจบ (มีดาว) ถือว่าเคยเข้าดูด้วย
insert into article_views (user_id, article_id)
select user_id, article_id from article_reads
on conflict (user_id, article_id) do nothing;

-- บันทึกว่า user เข้าดูบทความ (ไม่ซ้ำ)
create or replace function mark_article_view(p_user_id uuid, p_article_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into article_views(user_id, article_id) values (p_user_id, p_article_id)
  on conflict (user_id, article_id) do nothing;
end;
$$;
grant execute on function mark_article_view(uuid, uuid) to anon, authenticated;

-- สถิติต่อบทความ: viewers = จำนวนผู้เข้าอ่าน (ไม่ซ้ำ), stars = จำนวนดาวที่กดเก็บ (อ่านจบ)
create or replace function get_article_stats()
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  return coalesce((
    select jsonb_object_agg(article_id, info)
    from (
      select a.id as article_id, jsonb_build_object(
          'viewers', (select count(*) from article_views v where v.article_id = a.id),
          'stars', (select count(*) from article_reads r where r.article_id = a.id)
        ) as info
      from articles a
    ) s
  ), '{}'::jsonb);
end;
$$;
grant execute on function get_article_stats() to anon, authenticated;
