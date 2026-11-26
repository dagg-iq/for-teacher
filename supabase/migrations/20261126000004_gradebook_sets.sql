-- سجلات السنة: كل امتحان في سجل، والسعي يُحسب من السجلات المرتبطة.
-- group_id يجمع سجلات السنة لشعبة واحدة، role دورها (month/term/mid/annual/final/custom)، ord ترتيبها.
alter table public.gradebooks add column if not exists group_id uuid;
alter table public.gradebooks add column if not exists role text check (role is null or role in ('month', 'term', 'mid', 'annual', 'final', 'custom'));
alter table public.gradebooks add column if not exists ord integer;
create index if not exists gradebooks_group on public.gradebooks (owner_id, group_id);
