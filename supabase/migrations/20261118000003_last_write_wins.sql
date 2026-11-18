-- آخر تعديل يفوز على الخادم أيضاً:
-- إن رفع جهاز (كان بلا إنترنت) نسخة أقدم من الموجودة، لا تُستبدل الأحدث.
-- بل يُحدَّث synced_at فقط حتى يسحب ذلك الجهاز النسخة الأحدث في مزامنته التالية.
create or replace function public.touch_synced_at() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    old.synced_at := clock_timestamp();
    return old;
  end if;
  new.synced_at := clock_timestamp();
  if new.owner_id is null then new.owner_id := auth.uid(); end if;
  return new;
end $$;
