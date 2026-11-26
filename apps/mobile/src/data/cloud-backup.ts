/**
 * النسخ الاحتياطية السحابية في Supabase Storage (الحاوية «backups»، مجلد لكل مدرّس).
 * المزامنة تحفظ «آخر حالة» فقط؛ هذه لقطات كاملة بتاريخها تُستعاد إن حُذف شيء بالخطأ.
 *  - نسخة تلقائية مرة كل يوم (بعد مزامنة ناجحة)، ونسخة يدوية في أي وقت.
 *  - تُبقى آخر KEEP نسخ وتُحذف الأقدم.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SYNC_BACKEND } from '@/lib/config';
import { isConfigured, supabase } from '@/lib/supabase';
import { exportBackup, importBackup, type Backup } from './db';

const BUCKET = 'backups';
const KEEP = 30;
const DAY = 24 * 60 * 60 * 1000;
const LAST_AUTO = (uid: string) => `nahj.cloudBackup.${uid}`;

/** النسخ السحابية متاحة؟ (Supabase مضبوط، والمزامنة عليه لا على خادم Oracle) */
export const cloudBackupAvailable = isConfigured && SYNC_BACKEND === 'supabase';

export interface CloudBackup { path: string; at: Date; size: number; auto: boolean }

/** اسم الملف: 2026-11-26T19-30-05-123Z[.auto].json (قابل للترتيب ولا يحوي «:») */
const fileName = (d: Date, auto: boolean) => `${d.toISOString().replace(/[:.]/g, '-')}${auto ? '.auto' : ''}.json`;
function parseName(name: string): { at: Date; auto: boolean } | null {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z(\.auto)?\.json$/.exec(name);
  if (!m) return null;
  const at = new Date(`${m[1]}T${m[2]}:${m[3]}:${m[4]}.${m[5]}Z`);
  return Number.isNaN(at.getTime()) ? null : { at, auto: !!m[6] };
}

/** النسخ المحفوظة، الأحدث أولاً */
export async function listCloudBackups(uid: string): Promise<CloudBackup[]> {
  const { data, error } = await supabase.storage.from(BUCKET).list(uid, { limit: 1000 });
  if (error) throw error;
  const out: CloudBackup[] = [];
  for (const f of data ?? []) {
    const p = parseName(f.name);
    if (p) out.push({ path: `${uid}/${f.name}`, at: p.at, auto: p.auto, size: Number((f.metadata as { size?: number } | null)?.size ?? 0) });
  }
  return out.sort((a, b) => b.at.getTime() - a.at.getTime());
}

/** يرفع نسخة كاملة الآن ويحذف ما زاد عن KEEP */
export async function uploadCloudBackup(uid: string, auto = false): Promise<CloudBackup> {
  const at = new Date();
  const body = JSON.stringify(exportBackup());
  const path = `${uid}/${fileName(at, auto)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, { contentType: 'application/json', upsert: true });
  if (error) throw error;
  await AsyncStorage.setItem(LAST_AUTO(uid), at.toISOString()).catch(() => {});
  prune(uid).catch(() => {});
  return { path, at, size: body.length, auto };
}

async function prune(uid: string) {
  const all = await listCloudBackups(uid);
  const old = all.slice(KEEP).map((b) => b.path);
  if (old.length) await supabase.storage.from(BUCKET).remove(old);
}

/** ينزّل نسخة ويدمجها مع البيانات الحالية (الأحدث من كل سجل يبقى). يعيد عدد السجلات المستعادة */
export async function restoreCloudBackup(path: string): Promise<number> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) throw error ?? new Error('تعذّر تنزيل النسخة');
  const b = JSON.parse(await data.text()) as Backup;
  return importBackup(b);
}

export async function deleteCloudBackup(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}

/** نسخة تلقائية إن مرّ يوم على آخر نسخة (يُستدعى بعد مزامنة ناجحة؛ الأخطاء تُتجاهل بصمت) */
let autoRunning = false;
export async function maybeAutoBackup(uid: string): Promise<void> {
  if (!cloudBackupAvailable || autoRunning) return;
  autoRunning = true;
  try {
    const last = await AsyncStorage.getItem(LAST_AUTO(uid)).catch(() => null);
    if (last && Date.now() - Date.parse(last) < DAY) return;
    // لا نرفع نسخة فارغة (هاتف جديد قبل أن تُسحب البيانات)
    const b = exportBackup();
    const rows = Object.values(b.tables).reduce((n, t) => n + (t?.length ?? 0), 0);
    if (!rows) return;
    await uploadCloudBackup(uid, true);
  } catch { /* بلا إنترنت أو الحاوية غير منشأة بعد — نحاول في المرة القادمة */ } finally {
    autoRunning = false;
  }
}
