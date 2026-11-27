-- نَهج — سجل نقل الطالب بين الشعب ([{from_section_id, from, to, date}])
alter table public.students add column if not exists history jsonb;
