-- أجهزة الإشعارات (FCM) وإعلانات التطبيق، وحذف بيانات المدرس

create table if not exists public.devices (
  token text primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  platform text not null default 'android',
  app_version text,
  updated_at timestamptz not null default now()
);
alter table public.devices enable row level security;
drop policy if exists owner_all on public.devices;
create policy owner_all on public.devices for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create index if not exists devices_owner on public.devices (owner_id);

-- إعلانات عامة تظهر في التطبيق (تُكتب من لوحة Supabase أو دالة push)
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  url text,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);
alter table public.announcements enable row level security;
drop policy if exists read_all on public.announcements;
create policy read_all on public.announcements for select to anon, authenticated
  using (expires_at is null or expires_at > now());

-- يحذف كل بيانات المدرس الحالي (قبل حذف الحساب أو «ابدأ من جديد»)
create or replace function public.delete_my_data() returns void
language plpgsql security invoker set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in'; end if;
  delete from public.grades where owner_id = uid;
  delete from public.attendance where owner_id = uid;
  delete from public.student_notes where owner_id = uid;
  delete from public.students where owner_id = uid;
  delete from public.gradebooks where owner_id = uid;
  delete from public.slots where owner_id = uid;
  delete from public.tasks where owner_id = uid;
  delete from public.lesson_plans where owner_id = uid;
  delete from public.sections where owner_id = uid;
  delete from public.classes where owner_id = uid;
  delete from public.teacher_settings where owner_id = uid;
  delete from public.devices where owner_id = uid;
end $$;
revoke all on function public.delete_my_data() from public, anon;
grant execute on function public.delete_my_data() to authenticated;
