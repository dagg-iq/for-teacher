-- نَهج — آخر خطأ مزامنة لكل مدرّس (يظهر للمدير في لوحة الإدارة لتشخيص المشاكل دون الوصول لهاتفه)
alter table public.teacher_accounts add column if not exists last_error text;
alter table public.teacher_accounts add column if not exists last_error_at timestamptz;

-- المدرّس يكتب خطأه هو فقط (أو يمسحه بـ null بعد مزامنة ناجحة)
create or replace function public.report_sync_error(msg text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  update public.teacher_accounts
     set last_error = case when msg is null or msg = '' then null else left(msg, 600) end,
         last_error_at = case when msg is null or msg = '' then null else now() end
   where id = auth.uid();
end $$;
revoke all on function public.report_sync_error(text) from public, anon;
grant execute on function public.report_sync_error(text) to authenticated;
