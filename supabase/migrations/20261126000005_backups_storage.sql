-- نَهج — نسخ احتياطية سحابية في Supabase Storage
-- حاوية خاصة «backups»: كل مدرّس يرى ويكتب في مجلده فقط  backups/<uid>/<الوقت>.json
-- آمن لإعادة التشغيل، ويتخطّى نفسه إن لم توجد خدمة التخزين (Postgres عادي في الاختبارات).

do $$
begin
  if to_regclass('storage.buckets') is null or to_regclass('storage.objects') is null then
    raise notice 'storage schema not found — skipping backups bucket';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('backups', 'backups', false, 52428800, array['application/json'])
  on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

  execute 'drop policy if exists "backups: read own" on storage.objects';
  execute 'drop policy if exists "backups: insert own" on storage.objects';
  execute 'drop policy if exists "backups: update own" on storage.objects';
  execute 'drop policy if exists "backups: delete own" on storage.objects';

  execute $p$create policy "backups: read own" on storage.objects for select to authenticated
    using (bucket_id = 'backups' and (storage.foldername(name))[1] = (select auth.uid())::text)$p$;
  execute $p$create policy "backups: insert own" on storage.objects for insert to authenticated
    with check (bucket_id = 'backups' and (storage.foldername(name))[1] = (select auth.uid())::text)$p$;
  execute $p$create policy "backups: update own" on storage.objects for update to authenticated
    using (bucket_id = 'backups' and (storage.foldername(name))[1] = (select auth.uid())::text)$p$;
  execute $p$create policy "backups: delete own" on storage.objects for delete to authenticated
    using (bucket_id = 'backups' and (storage.foldername(name))[1] = (select auth.uid())::text)$p$;
end $$;
