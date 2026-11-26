// حذف الحساب نهائياً مع كل بياناته (متطلب Google Play)
import { handler, json } from '../_shared/cors.ts';
import { admin, requireUser } from '../_shared/supabase.ts';

Deno.serve(handler(async (req) => {
  const user = await requireUser(req);
  const db = admin();
  // النسخ الاحتياطية السحابية (الملفات لا تُحذف تلقائياً مع المستخدم)
  const bucket = db.storage.from('backups');
  for (;;) {
    const { data, error } = await bucket.list(user.id, { limit: 100 });
    if (error || !data?.length) break;
    const { error: rm } = await bucket.remove(data.map((f) => `${user.id}/${f.name}`));
    if (rm) throw rm;
  }
  // الجداول تُحذف تلقائياً (on delete cascade) عند حذف المستخدم
  const { error } = await db.auth.admin.deleteUser(user.id);
  if (error) throw error;
  return json({ ok: true });
}));
