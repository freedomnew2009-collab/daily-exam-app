-- ============================================================
--  Migration 018 — ให้ดาว/รางวัลเมื่ออ่านบทความจบ (รายผู้ใช้)
--  วิธีใช้: Supabase Dashboard -> SQL Editor -> วางทั้งไฟล์นี้ -> Run
--  (รันซ้ำได้ ปลอดภัย)
-- ============================================================

create table if not exists article_reads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  article_id uuid not null references articles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, article_id)
);
alter table article_reads enable row level security;
create index if not exists idx_article_reads_user on article_reads(user_id);

-- ทำเครื่องหมายว่าอ่านจบ (คืน first_time=true เฉพาะครั้งแรก เพื่อโชว์รางวัล)
create or replace function mark_article_read(p_user_id uuid, p_article_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_new boolean := false; v_total int;
begin
  insert into article_reads(user_id, article_id) values (p_user_id, p_article_id)
  on conflict (user_id, article_id) do nothing;
  v_new := found;
  select count(*) into v_total from article_reads where user_id = p_user_id;
  return jsonb_build_object('first_time', v_new, 'total_read', v_total);
end;
$$;
grant execute on function mark_article_read(uuid, uuid) to anon, authenticated;

-- รายการ id บทความที่ผู้ใช้อ่านจบแล้ว (ไว้โชว์ดาวในลิสต์)
create or replace function get_read_articles(p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  return coalesce((select jsonb_agg(article_id) from article_reads where user_id = p_user_id), '[]'::jsonb);
end;
$$;
grant execute on function get_read_articles(uuid) to anon, authenticated;
