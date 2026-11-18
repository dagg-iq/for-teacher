import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.49.4';
import { HttpError } from './cors.ts';

/** عميل بصلاحيات الخادم (يتجاوز RLS) — للاستخدام داخل الدوال فقط */
export function admin(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
}

/** المستخدم صاحب الطلب (من رمز الدخول) */
export async function requireUser(req: Request): Promise<{ id: string; email?: string }> {
  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'سجّل الدخول أولاً');
  const { data, error } = await admin().auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'انتهت الجلسة، سجّل الدخول من جديد');
  return { id: data.user.id, email: data.user.email ?? undefined };
}
