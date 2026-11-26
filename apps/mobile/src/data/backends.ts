/**
 * طبقة السحابة القابلة للتبديل: محرك المزامنة (sync.ts) لا يعرف أين تُحفظ البيانات.
 *  - supabaseBackend: Supabase مباشرة (Postgres + RLS).
 *  - restBackend: خادم نَهج (server/) المتصل بـ Oracle، بنفس العقد.
 * كلاهما «آخر تعديل يفوز» على الخادم، والسحب تزايدي بـ synced_at.
 */
import { type TableName } from '@nahj/shared';
import { API_URL, SYNC_BACKEND } from '@/lib/config';
import { supabase } from '@/lib/supabase';

export interface RemoteSettings { profile: unknown; timetable: unknown; prefs: unknown; updated_at: string }

export interface SyncBackend {
  name: 'supabase' | 'rest';
  pushSettings(uid: string, s: RemoteSettings): Promise<void>;
  pullSettings(uid: string): Promise<RemoteSettings | null>;
  /** يرفع صفوفاً (مع owner_id) — الخادم يحتفظ بالأحدث */
  push(table: TableName, rows: Record<string, unknown>[]): Promise<void>;
  /** الصفوف التي تغيّرت بعد since، مرتبة بـ synced_at تصاعدياً */
  pull(table: TableName, since: string, limit: number): Promise<Record<string, unknown>[]>;
  deleteAccount(): Promise<void>;
}

export const supabaseBackend: SyncBackend = {
  name: 'supabase',
  async pushSettings(uid, s) {
    const { error } = await supabase.from('teacher_settings').upsert({ owner_id: uid, ...s });
    if (error) throw error;
  },
  async pullSettings(uid) {
    const { data, error } = await supabase.from('teacher_settings').select('*').eq('owner_id', uid).maybeSingle();
    if (error) throw error;
    return (data as RemoteSettings | null) ?? null;
  },
  async push(table, rows) {
    // الحقول غير الموجودة تأخذ القيمة الافتراضية في الخادم (لا null) — وإلا رُفضت الأعمدة الإلزامية
    const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id', defaultToNull: false });
    if (error) throw error;
  },
  async pull(table, since, limit) {
    const { data, error } = await supabase.from(table).select('*').gt('synced_at', since).order('synced_at', { ascending: true }).limit(limit);
    if (error) throw error;
    return (data ?? []) as Record<string, unknown>[];
  },
  async deleteAccount() {
    const { error } = await supabase.functions.invoke('delete-account', { body: {} });
    if (error) throw error;
  },
};

async function api(path: string, init: RequestInit = {}) {
  if (!API_URL) throw new Error('لم يُضبط عنوان خادم المزامنة (EXPO_PUBLIC_API_URL)');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('سجّل الدخول أولاً');
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error || `خطأ من الخادم (${res.status})`);
  return body as Record<string, unknown>;
}

export const restBackend: SyncBackend = {
  name: 'rest',
  async pushSettings(_uid, s) { await api('/v1/settings', { method: 'PUT', body: JSON.stringify(s) }); },
  async pullSettings() { return ((await api('/v1/settings')).settings as RemoteSettings | null) ?? null; },
  async push(table, rows) {
    // owner_id يضبطه الخادم من رمز الدخول، فلا يُرسل
    await api('/v1/sync/push', { method: 'POST', body: JSON.stringify({ table, rows: rows.map(({ owner_id: _o, ...r }) => r) }) });
  },
  async pull(table, since, limit) {
    const q = new URLSearchParams({ table, since, limit: String(limit) });
    return ((await api(`/v1/sync/pull?${q}`)).rows as Record<string, unknown>[]) ?? [];
  },
  async deleteAccount() { await api('/v1/account/delete', { method: 'POST', body: '{}' }); },
};

export const backend: SyncBackend = SYNC_BACKEND === 'rest' ? restBackend : supabaseBackend;
