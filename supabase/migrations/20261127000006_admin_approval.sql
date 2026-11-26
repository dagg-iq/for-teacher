-- نَهج — لوحة الإدارة وموافقة المدير على الحسابات الجديدة
--  • teacher_accounts: حالة كل حساب (بانتظار الموافقة / مفعّل / موقوف / مرفوض) — تُنشأ تلقائياً عند التسجيل.
--  • المزامنة والنسخ السحابية لا تعمل إلا للحساب المفعّل (RLS)؛ البيانات تبقى على الهاتف حتى الموافقة.
--  • admin_emails / app_config: للوحة الإدارة فقط (بلا سياسات = لا يصلها إلا الخادم بمفتاح الخدمة).
-- آمن لإعادة التشغيل.

create table if not exists public.teacher_accounts (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'suspended', 'rejected')),
  note text,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  notified_at timestamptz
);
create index if not exists teacher_accounts_status on public.teacher_accounts (status, created_at desc);
alter table public.teacher_accounts enable row level security;
drop policy if exists read_own on public.teacher_accounts;
create policy read_own on public.teacher_accounts for select to authenticated using (id = (select auth.uid()));

create table if not exists public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.app_config enable row level security;
insert into public.app_config (key, value) values ('require_approval', 'true') on conflict (key) do nothing;

create table if not exists public.admin_emails (
  email text primary key check (email = lower(email)),
  added_at timestamptz not null default now()
);
alter table public.admin_emails enable row level security;

-- كل حساب جديد: بانتظار الموافقة (إلا إن أُوقف شرط الموافقة أو كان بريد مدير)
create or replace function public.on_auth_user_created() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  need boolean := coalesce((select (value)::text::boolean from public.app_config where key = 'require_approval'), true);
  is_admin boolean := exists (select 1 from public.admin_emails where email = lower(new.email));
begin
  insert into public.teacher_accounts (id, email, status, decided_at)
  values (new.id, lower(new.email), case when need and not is_admin then 'pending' else 'approved' end,
          case when need and not is_admin then null else now() end)
  on conflict (id) do nothing;
  return new;
end $$;
revoke all on function public.on_auth_user_created() from public, anon, authenticated;

drop trigger if exists nahj_on_auth_user_created on auth.users;
create trigger nahj_on_auth_user_created after insert on auth.users
  for each row execute function public.on_auth_user_created();

-- البريد يتغير من اللوحة أو من المستخدم: نُبقي النسخة المحلية متطابقة
create or replace function public.on_auth_user_email() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.teacher_accounts set email = lower(new.email) where id = new.id;
  return new;
end $$;
revoke all on function public.on_auth_user_email() from public, anon, authenticated;
drop trigger if exists nahj_on_auth_user_email on auth.users;
create trigger nahj_on_auth_user_email after update of email on auth.users
  for each row when (old.email is distinct from new.email) execute function public.on_auth_user_email();

-- الحسابات الموجودة قبل هذا التحديث: مفعّلة
insert into public.teacher_accounts (id, email, status, decided_at)
select id, lower(email), 'approved', now() from auth.users
on conflict (id) do nothing;

-- هل المستخدم الحالي مفعّل؟ (تُستعمل في كل سياسات البيانات)
create or replace function public.is_approved() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.teacher_accounts where id = auth.uid() and status = 'approved')
$$;
revoke all on function public.is_approved() from public, anon;
grant execute on function public.is_approved() to authenticated;

-- سياسات البيانات: صاحبها فقط، وبشرط أن يكون حسابه مفعّلاً
do $$
declare t text;
begin
  foreach t in array array['classes','sections','students','gradebooks','grades','attendance','slots','tasks','lesson_plans','student_notes','teacher_settings'] loop
    execute format('drop policy if exists owner_all on public.%I', t);
    execute format('create policy owner_all on public.%I for all to authenticated using (owner_id = (select auth.uid()) and (select public.is_approved())) with check (owner_id = (select auth.uid()) and (select public.is_approved()))', t);
  end loop;
end $$;

-- النسخ السحابية: للحساب المفعّل فقط
do $$
begin
  if to_regclass('storage.objects') is null then return; end if;
  execute 'drop policy if exists "backups: read own" on storage.objects';
  execute 'drop policy if exists "backups: insert own" on storage.objects';
  execute 'drop policy if exists "backups: update own" on storage.objects';
  execute 'drop policy if exists "backups: delete own" on storage.objects';
  execute $p$create policy "backups: read own" on storage.objects for select to authenticated
    using (bucket_id = 'backups' and (storage.foldername(name))[1] = (select auth.uid())::text and (select public.is_approved()))$p$;
  execute $p$create policy "backups: insert own" on storage.objects for insert to authenticated
    with check (bucket_id = 'backups' and (storage.foldername(name))[1] = (select auth.uid())::text and (select public.is_approved()))$p$;
  execute $p$create policy "backups: update own" on storage.objects for update to authenticated
    using (bucket_id = 'backups' and (storage.foldername(name))[1] = (select auth.uid())::text and (select public.is_approved()))$p$;
  execute $p$create policy "backups: delete own" on storage.objects for delete to authenticated
    using (bucket_id = 'backups' and (storage.foldername(name))[1] = (select auth.uid())::text and (select public.is_approved()))$p$;
end $$;

-- ───────────── للوحة الإدارة فقط (مفتاح الخدمة) ─────────────

-- إحصاءات كل مدرّس: عدد الصفوف والطلاب والدرجات… وآخر مزامنة
create or replace function public.admin_teacher_stats(uid uuid default null)
returns table (owner_id uuid, classes bigint, sections bigint, students bigint, gradebooks bigint, grades bigint,
               attendance bigint, plans bigint, tasks bigint, last_sync timestamptz)
language sql stable security definer set search_path = public as $$
  with r as (
    select c.owner_id, 'classes' k, count(*) n, max(c.synced_at) s from public.classes c where not c.deleted and (uid is null or c.owner_id = uid) group by 1
    union all select x.owner_id, 'sections', count(*), max(x.synced_at) from public.sections x where not x.deleted and (uid is null or x.owner_id = uid) group by 1
    union all select x.owner_id, 'students', count(*), max(x.synced_at) from public.students x where not x.deleted and (uid is null or x.owner_id = uid) group by 1
    union all select x.owner_id, 'gradebooks', count(*), max(x.synced_at) from public.gradebooks x where not x.deleted and (uid is null or x.owner_id = uid) group by 1
    union all select x.owner_id, 'grades', count(*), max(x.synced_at) from public.grades x where not x.deleted and (uid is null or x.owner_id = uid) group by 1
    union all select x.owner_id, 'attendance', count(*), max(x.synced_at) from public.attendance x where not x.deleted and (uid is null or x.owner_id = uid) group by 1
    union all select x.owner_id, 'plans', count(*), max(x.synced_at) from public.lesson_plans x where not x.deleted and (uid is null or x.owner_id = uid) group by 1
    union all select x.owner_id, 'tasks', count(*), max(x.synced_at) from public.tasks x where not x.deleted and (uid is null or x.owner_id = uid) group by 1
    union all select x.owner_id, 'settings', 0, max(x.synced_at) from public.teacher_settings x where (uid is null or x.owner_id = uid) group by 1
  )
  select r.owner_id,
    coalesce(sum(n) filter (where k = 'classes'), 0), coalesce(sum(n) filter (where k = 'sections'), 0),
    coalesce(sum(n) filter (where k = 'students'), 0), coalesce(sum(n) filter (where k = 'gradebooks'), 0),
    coalesce(sum(n) filter (where k = 'grades'), 0), coalesce(sum(n) filter (where k = 'attendance'), 0),
    coalesce(sum(n) filter (where k = 'plans'), 0), coalesce(sum(n) filter (where k = 'tasks'), 0),
    max(s)
  from r group by r.owner_id
$$;
revoke all on function public.admin_teacher_stats(uuid) from public, anon, authenticated;

-- حجم النسخ السحابية لكل مدرّس
create or replace function public.admin_backup_stats()
returns table (owner_id text, files bigint, bytes bigint, last_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if to_regclass('storage.objects') is null then return; end if;
  return query execute $q$
    select split_part(name, '/', 1), count(*), coalesce(sum((metadata->>'size')::bigint), 0)::bigint, max(created_at)
    from storage.objects where bucket_id = 'backups' group by 1
  $q$;
end $$;
revoke all on function public.admin_backup_stats() from public, anon, authenticated;

-- إنهاء كل جلسات مستخدم (يخرج من كل أجهزته عند انتهاء رمزه الحالي)
create or replace function public.admin_revoke_sessions(uid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if to_regclass('auth.sessions') is not null then
    execute 'delete from auth.sessions where user_id = $1' using uid;
  end if;
  if to_regclass('auth.refresh_tokens') is not null then
    execute 'update auth.refresh_tokens set revoked = true where user_id = $1::text' using uid;
  end if;
end $$;
revoke all on function public.admin_revoke_sessions(uuid) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.admin_teacher_stats(uuid) to service_role';
    execute 'grant execute on function public.admin_backup_stats() to service_role';
    execute 'grant execute on function public.admin_revoke_sessions(uuid) to service_role';
    execute 'grant all on public.teacher_accounts, public.app_config, public.admin_emails to service_role';
  end if;
end $$;
