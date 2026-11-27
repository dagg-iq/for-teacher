-- نَهج — مزامنة فورية بين الأجهزة: تغيّر على الهاتف يصل للحاسوب خلال ثوانٍ (Supabase Realtime، يحترم RLS)
do $$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then return; end if;
  foreach t in array array['classes','sections','students','gradebooks','grades','attendance','slots','tasks','lesson_plans','student_notes','teacher_settings'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
