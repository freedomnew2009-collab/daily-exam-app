-- ============================================================
--  Migration 005 — บทความหลายรูป + นับยอดเข้าอ่าน
--  วิธีใช้: Supabase Dashboard -> SQL Editor -> วางทั้งไฟล์นี้ -> Run
--  (รันซ้ำได้ ปลอดภัย ไม่ลบข้อมูลเดิม)
-- ============================================================

-- หลายรูปต่อบทความ (เก็บเป็น array ของ url)
alter table articles add column if not exists images jsonb not null default '[]'::jsonb;

-- ยอดเข้าอ่าน
alter table articles add column if not exists views int not null default 0;

-- เพิ่มยอดเข้าอ่าน +1 (ให้ทุกคนเรียกได้ ผ่านฟังก์ชันเท่านั้น เพื่อไม่ต้องเปิดสิทธิ์ update ตรง ๆ)
create or replace function increment_article_views(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update articles set views = views + 1 where id = p_id and published = true;
end;
$$;
grant execute on function increment_article_views(uuid) to anon, authenticated;
