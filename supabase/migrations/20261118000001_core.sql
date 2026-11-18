-- نَهج — الجداول الأساسية (محلي أولاً + مزامنة)
-- كل جدول: معرّف من الهاتف، owner_id = المدرس، updated_at من الهاتف (آخر تعديل يفوز)،
-- deleted حذف ناعم، synced_at يضبطه الخادم (للسحب التزايدي).
-- آمن لإعادة التشغيل.

create extension if not exists pgcrypto;

-- يضبط synced_at عند كل إضافة/تعديل
create or replace function public.touch_synced_at() returns trigger
language plpgsql as $$
begin
  new.synced_at := clock_timestamp();
  if new.owner_id is null then new.owner_id := auth.uid(); end if;
  return new;
end $$;

-- أعمدة مشتركة تُكرَّر في كل جدول
-- id, owner_id, created_at, updated_at, deleted, synced_at

create table if not exists public.classes (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  stage text not null default 'other',
  subject text not null default '',
  hue int not null default 0,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  synced_at timestamptz not null default clock_timestamp()
);

create table if not exists public.sections (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  class_id uuid not null,
  name text not null check (char_length(name) between 1 and 40),
  room text,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  synced_at timestamptz not null default clock_timestamp()
);

create table if not exists public.students (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  section_id uuid not null,
  name text not null check (char_length(name) between 1 and 160),
  number int,
  parent_phone text,
  notes text,
  gender text,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  synced_at timestamptz not null default clock_timestamp()
);

create table if not exists public.gradebooks (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  section_id uuid not null,
  title text not null check (char_length(title) between 1 and 160),
  template text,
  columns jsonb not null default '[]'::jsonb,
  result jsonb not null default '{}'::jsonb,
  year text,
  note text,
  archived boolean not null default false,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  synced_at timestamptz not null default clock_timestamp()
);

-- المعرّف = gradebook|student|column
create table if not exists public.grades (
  id text primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  gradebook_id uuid not null,
  student_id uuid not null,
  column_id text not null,
  value double precision,
  mark text check (mark is null or mark in ('absent', 'exempt', 'cheat')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  synced_at timestamptz not null default clock_timestamp()
);

-- المعرّف = section|date|student
create table if not exists public.attendance (
  id text primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  section_id uuid not null,
  student_id uuid not null,
  date date not null,
  status text not null check (status in ('present', 'absent', 'late', 'excused')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  synced_at timestamptz not null default clock_timestamp()
);

create table if not exists public.slots (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day smallint not null check (day between 0 and 6),
  period smallint not null check (period between 0 and 15),
  section_id uuid,
  label text,
  room text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  synced_at timestamptz not null default clock_timestamp()
);

create table if not exists public.tasks (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 300),
  note text,
  kind text not null default 'task',
  due timestamptz,
  remind int,
  done boolean not null default false,
  section_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  synced_at timestamptz not null default clock_timestamp()
);

create table if not exists public.lesson_plans (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  class_id uuid,
  section_ids text[] not null default '{}',
  title text not null check (char_length(title) between 1 and 300),
  objectives text,
  materials text,
  method text,
  steps text,
  evaluation text,
  homework text,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  synced_at timestamptz not null default clock_timestamp()
);

create table if not exists public.student_notes (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  student_id uuid not null,
  kind text not null default 'note' check (kind in ('positive', 'negative', 'note')),
  text text not null check (char_length(text) between 1 and 2000),
  date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  synced_at timestamptz not null default clock_timestamp()
);

-- إعدادات المدرس (الملف، أوقات الدوام، التفضيلات): صف واحد لكل مدرس
create table if not exists public.teacher_settings (
  owner_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  profile jsonb,
  timetable jsonb,
  prefs jsonb,
  updated_at timestamptz not null default now(),
  synced_at timestamptz not null default clock_timestamp()
);

-- فهارس السحب التزايدي والبحث
do $$
declare t text;
begin
  foreach t in array array['classes','sections','students','gradebooks','grades','attendance','slots','tasks','lesson_plans','student_notes'] loop
    execute format('create index if not exists %I on public.%I (owner_id, synced_at)', t || '_owner_synced', t);
    execute format('drop trigger if exists touch_synced on public.%I', t);
    execute format('create trigger touch_synced before insert or update on public.%I for each row execute function public.touch_synced_at()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists owner_all on public.%I', t);
    execute format('create policy owner_all on public.%I for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))', t);
  end loop;
end $$;

drop trigger if exists touch_synced on public.teacher_settings;
create trigger touch_synced before insert or update on public.teacher_settings for each row execute function public.touch_synced_at();
alter table public.teacher_settings enable row level security;
drop policy if exists owner_all on public.teacher_settings;
create policy owner_all on public.teacher_settings for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create index if not exists students_section on public.students (section_id);
create index if not exists grades_book on public.grades (gradebook_id);
create index if not exists attendance_section_date on public.attendance (section_id, date);
