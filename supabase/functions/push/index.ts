// إرسال إشعار لكل المدرسين أو لمدرس واحد (إعلان، تحديث جديد…)
// محمي بالسر PUSH_SECRET في الترويسة x-push-secret — يُستدعى من سير عمل GitHub أو من لوحة Supabase.
//   POST { title, body, url?, owner_id?, announce?: true }
import { HttpError, handler, json } from '../_shared/cors.ts';
import { fcmConfigured, sendFcm } from '../_shared/fcm.ts';
import { admin } from '../_shared/supabase.ts';

Deno.serve(handler(async (req) => {
  const secret = Deno.env.get('PUSH_SECRET');
  if (!secret || req.headers.get('x-push-secret') !== secret) throw new HttpError(401, 'غير مصرّح');
  const { title, body, url, owner_id, announce } = await req.json().catch(() => ({}));
  if (typeof title !== 'string' || typeof body !== 'string' || !title.trim()) throw new HttpError(400, 'العنوان والنص مطلوبان');
  const db = admin();
  if (announce) await db.from('announcements').insert({ title, body, url: url ?? null });
  if (!fcmConfigured()) return json({ ok: true, sent: 0, note: 'FCM_SERVICE_ACCOUNT غير مضبوط' });
  let q = db.from('devices').select('token');
  if (owner_id) q = q.eq('owner_id', owner_id);
  const { data, error } = await q;
  if (error) throw error;
  const tokens = (data ?? []).map((d: { token: string }) => d.token);
  const dead = await sendFcm(tokens.map((token) => ({ token, title, body, data: { route: url ?? '/' }, channelId: 'news' })));
  if (dead.length) await db.from('devices').delete().in('token', dead);
  return json({ ok: true, sent: tokens.length - dead.length, removed: dead.length });
}));
