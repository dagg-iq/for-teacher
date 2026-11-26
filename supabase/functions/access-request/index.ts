// يُستدعى من التطبيق بعد إنشاء حساب ينتظر الموافقة: يُشعر المدير على هاتفه (إن كان له حساب في التطبيق بنفس البريد).
// مرة واحدة لكل حساب (notified_at).
import { handler, json } from '../_shared/cors.ts';
import { fcmConfigured, sendFcm } from '../_shared/fcm.ts';
import { admin, requireUser } from '../_shared/supabase.ts';

Deno.serve(handler(async (req) => {
  const user = await requireUser(req);
  const db = admin();
  const { data: acc } = await db.from('teacher_accounts').select('status, notified_at').eq('id', user.id).maybeSingle();
  if (!acc || acc.status !== 'pending' || acc.notified_at) return json({ ok: true, sent: 0 });
  await db.from('teacher_accounts').update({ notified_at: new Date().toISOString() }).eq('id', user.id);
  if (!fcmConfigured()) return json({ ok: true, sent: 0 });
  const env = (Deno.env.get('ADMIN_EMAILS') ?? '').split(/[,\s]+/).map((e) => e.trim().toLowerCase()).filter(Boolean);
  const { data: extra } = await db.from('admin_emails').select('email');
  const emails = [...new Set([...env, ...((extra ?? []) as { email: string }[]).map((r) => r.email)])];
  if (!emails.length) return json({ ok: true, sent: 0 });
  const { data: owners } = await db.from('teacher_accounts').select('id').in('email', emails);
  const ids = ((owners ?? []) as { id: string }[]).map((r) => r.id);
  if (!ids.length) return json({ ok: true, sent: 0 });
  const { data: devs } = await db.from('devices').select('token').in('owner_id', ids);
  const tokens = ((devs ?? []) as { token: string }[]).map((d) => d.token);
  if (!tokens.length) return json({ ok: true, sent: 0 });
  const dead = await sendFcm(tokens.map((token) => ({
    token, title: 'طلب حساب جديد', body: `${user.email ?? 'مدرّس'} ينتظر موافقتك في لوحة الإدارة`, data: { route: '/' }, channelId: 'news',
  })));
  if (dead.length) await db.from('devices').delete().in('token', dead);
  return json({ ok: true, sent: tokens.length - dead.length });
}));
