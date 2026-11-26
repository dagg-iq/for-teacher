-- اختبار الصلاحيات: كل مدرس يرى ويعدّل بياناته فقط
\set ON_ERROR_STOP 1
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@x.iq'),
  ('22222222-2222-2222-2222-222222222222', 'b@x.iq')
on conflict do nothing;
-- الحسابات الجديدة بانتظار موافقة المدير؛ نفعّلها للاختبار
do $$ begin
  if (select count(*) from public.teacher_accounts where status = 'pending' and id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')) <> 2 then raise exception 'new users not pending'; end if;
end $$;
update public.teacher_accounts set status = 'approved' where id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');

set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);

insert into public.classes (id, name, stage, subject, hue, sort, updated_at)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'الخامس العلمي', 'preparatory', 'الفيزياء', 0, 0, now());
insert into public.sections (id, class_id, name, sort) values ('aaaaaaaa-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'أ', 0);
insert into public.students (id, section_id, name, sort) values ('aaaaaaaa-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000002', 'أحمد علي', 0);
insert into public.gradebooks (id, section_id, title, columns, result) values ('aaaaaaaa-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000002', 'سجل', '[{"id":"c1","name":"الدرجة","kind":"input","max":100}]', '{"column_id":"c1","pass":50,"bands":[]}');
insert into public.grades (id, gradebook_id, student_id, column_id, value) values ('b|s|c1', 'aaaaaaaa-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000003', 'c1', 85.5);
insert into public.attendance (id, section_id, student_id, date, status) values ('s|2026-11-18|st', 'aaaaaaaa-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000003', '2026-11-18', 'absent');
insert into public.lesson_plans (id, date, title, section_ids) values ('aaaaaaaa-0000-0000-0000-000000000005', '2026-11-18', 'درس', array['aaaaaaaa-0000-0000-0000-000000000002']);
insert into public.teacher_settings (profile) values ('{"name":"أ"}');

-- owner_id يُملأ تلقائياً، و synced_at يضبطه الخادم
do $$ begin
  if (select owner_id from public.classes limit 1) <> '11111111-1111-1111-1111-111111111111' then raise exception 'owner not set'; end if;
  if (select count(*) from public.grades where value = 85.5) <> 1 then raise exception 'grade not stored'; end if;
end $$;

-- مدرس آخر لا يرى شيئاً
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
do $$ begin
  if (select count(*) from public.classes) <> 0 then raise exception 'B sees A classes'; end if;
  if (select count(*) from public.grades) <> 0 then raise exception 'B sees A grades'; end if;
  if (select count(*) from public.teacher_settings) <> 0 then raise exception 'B sees A settings'; end if;
end $$;

-- ولا يستطيع تعديل صفوف غيره (حتى لو عرف المعرّف)
update public.classes set name = 'اختراق' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
do $$ begin
  begin
    insert into public.classes (id, owner_id, name) values ('aaaaaaaa-0000-0000-0000-000000000009', '11111111-1111-1111-1111-111111111111', 'باسم غيري');
    raise exception 'B inserted row owned by A';
  exception when insufficient_privilege then null; -- متوقع: RLS يرفض
  end;
  begin
    insert into public.classes (id, name) values ('aaaaaaaa-0000-0000-0000-000000000001', 'نفس المعرف') on conflict (id) do update set name = excluded.name;
    raise exception 'B overwrote A row by upsert';
  exception when insufficient_privilege then null;
  end;
end $$;

-- B يحذف بياناته فقط
select public.delete_my_data();
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
do $$ begin
  if (select name from public.classes where id = 'aaaaaaaa-0000-0000-0000-000000000001') <> 'الخامس العلمي' then raise exception 'A row changed by B'; end if;
  if (select count(*) from public.grades) <> 1 then raise exception 'A grades lost'; end if;
end $$;

-- الحذف الكامل لبيانات A
select public.delete_my_data();
do $$ begin
  if (select count(*) from public.classes) <> 0 then raise exception 'delete_my_data failed'; end if;
end $$;

-- الزائر بلا حساب لا يرى شيئاً ولا يكتب
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$ begin
  begin
    insert into public.classes (id, name) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'زائر');
    raise exception 'anon inserted';
  exception when insufficient_privilege or not_null_violation then null;
  end;
end $$;
reset role;

-- آخر تعديل يفوز: رفع نسخة أقدم لا يستبدل الأحدث، لكنه يحدّث synced_at ليسحبها الجهاز القديم
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
insert into public.classes (id, name, updated_at) values ('aaaaaaaa-0000-0000-0000-0000000000b1', 'الأحدث', '2026-11-18T12:00:00Z');
do $$
declare s1 timestamptz; s2 timestamptz;
begin
  select synced_at into s1 from public.classes where id = 'aaaaaaaa-0000-0000-0000-0000000000b1';
  perform pg_sleep(0.01);
  insert into public.classes (id, name, updated_at) values ('aaaaaaaa-0000-0000-0000-0000000000b1', 'الأقدم', '2026-11-18T10:00:00Z')
    on conflict (id) do update set name = excluded.name, updated_at = excluded.updated_at;
  select synced_at into s2 from public.classes where id = 'aaaaaaaa-0000-0000-0000-0000000000b1';
  if (select name from public.classes where id = 'aaaaaaaa-0000-0000-0000-0000000000b1') <> 'الأحدث' then raise exception 'older write replaced newer'; end if;
  if s2 <= s1 then raise exception 'synced_at not bumped'; end if;
  update public.classes set name = 'أحدث وأحدث', updated_at = '2026-11-18T13:00:00Z' where id = 'aaaaaaaa-0000-0000-0000-0000000000b1';
  if (select name from public.classes where id = 'aaaaaaaa-0000-0000-0000-0000000000b1') <> 'أحدث وأحدث' then raise exception 'newer write rejected'; end if;
end $$;
reset role;

-- حساب بانتظار الموافقة: لا يقرأ ولا يكتب شيئاً، ويرى حالته فقط
insert into auth.users (id, email) values ('33333333-3333-3333-3333-333333333333', 'C@x.iq') on conflict do nothing;
set role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
do $$ begin
  if (select status from public.teacher_accounts) <> 'pending' then raise exception 'pending user cannot see own status'; end if;
  if (select count(*) from public.teacher_accounts) <> 1 then raise exception 'user sees other accounts'; end if;
  if (select email from public.teacher_accounts) <> 'c@x.iq' then raise exception 'email not lower-cased'; end if;
  begin
    insert into public.classes (id, name) values ('aaaaaaaa-0000-0000-0000-0000000000c1', 'بانتظار');
    raise exception 'pending user inserted';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.teacher_accounts set status = 'approved';
    if (select status from public.teacher_accounts) = 'approved' then raise exception 'user approved himself'; end if;
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.admin_emails;
    if found then raise exception 'user reads admin_emails'; end if;
  exception when insufficient_privilege then null;
  end;
end $$;
-- موقوف: نفس الشيء
reset role;
update public.teacher_accounts set status = 'suspended' where id = '11111111-1111-1111-1111-111111111111';
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
do $$ begin
  if (select count(*) from public.classes) <> 0 then raise exception 'suspended user reads data'; end if;
end $$;
reset role;
-- الإحصاءات لا يصلها المستخدم العادي
set role authenticated;
do $$ begin
  begin
    perform * from public.admin_teacher_stats();
    raise exception 'user called admin_teacher_stats';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select count(*) > 0 as stats_ok from public.admin_teacher_stats();
