-- ============================================================
--  Migration 004 — บทความความรู้จากแอดมิน (อ่านได้ + แจ้งเตือนเมื่อมีใหม่)
--  วิธีใช้: Supabase Dashboard -> SQL Editor -> วางทั้งไฟล์นี้ -> Run
--  (รันซ้ำได้ ปลอดภัย ไม่ลบข้อมูลเดิม)
-- ============================================================

create table if not exists articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  cover_url text, -- รูปปกบทความ (ไม่บังคับ)
  published boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_articles_pub on articles(published, created_at desc);

alter table articles enable row level security;

-- อ่านได้: บทความที่เผยแพร่แล้ว (ทุกคน) หรือแอดมินเห็นทั้งหมด
drop policy if exists p_articles_sel on articles;
create policy p_articles_sel on articles for select
  using (published = true or auth.uid() is not null);

-- เพิ่ม/แก้ไข/ลบ ได้เฉพาะแอดมิน (login ผ่าน Supabase Auth)
drop policy if exists p_articles_ins on articles;
create policy p_articles_ins on articles for insert with check (auth.uid() is not null);
drop policy if exists p_articles_upd on articles;
create policy p_articles_upd on articles for update
  using (auth.uid() is not null) with check (auth.uid() is not null);
drop policy if exists p_articles_del on articles;
create policy p_articles_del on articles for delete using (auth.uid() is not null);

-- Realtime: ให้แอปเด้งแจ้งเตือนเมื่อมีบทความใหม่ (กันerror ถ้าเพิ่มซ้ำ)
do $$ begin
  alter publication supabase_realtime add table articles;
exception when duplicate_object then null;
end $$;
