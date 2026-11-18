// حذف الحساب نهائياً مع كل بياناته (متطلب Google Play)
import { handler, json } from '../_shared/cors.ts';
import { admin, requireUser } from '../_shared/supabase.ts';

Deno.serve(handler(async (req) => {
  const user = await requireUser(req);
  const db = admin();
  // الجداول تُحذف تلقائياً (on delete cascade) عند حذف المستخدم
  const { error } = await db.auth.admin.deleteUser(user.id);
  if (error) throw error;
  return json({ ok: true });
}));
