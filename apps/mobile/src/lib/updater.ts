import AsyncStorage from '@react-native-async-storage/async-storage';
import { DownloadTask, File, Paths } from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { BUILD_NUMBER, SITE_URL } from './config';

/**
 * التحديثات بطريقتين:
 *  ١. تحديث فوري بلا تنزيل (OTA عبر expo-updates): تعديلات الواجهة والمنطق تصل وحدها
 *     وتُطبَّق عند الفتح التالي، أو فوراً من «عن التطبيق». يعمل بعد ربط EAS (docs/SETUP_TODO.md).
 *  ٢. نسخة APK جديدة (عند تغيير الطبقة الأصلية): الموقع ينشر download.json بالرقم والرابط،
 *     والتطبيق يحمّل الملف بنفسه مع شريط تقدّم ثم يفتح شاشة التثبيت. يُثبَّت فوق القديم ولا تضيع البيانات.
 */

// ───────────────────────────── ١. OTA ─────────────────────────────
type UpdatesMod = typeof import('expo-updates');
let Updates: UpdatesMod | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Updates = require('expo-updates') as UpdatesMod;
} catch {
  Updates = null;
}

export function otaEnabled(): boolean {
  try {
    return Platform.OS !== 'web' && !!Updates?.isEnabled;
  } catch {
    return false;
  }
}

/** معرّف التحديث الحالي (مختصر) لعرضه في «عن التطبيق» */
export function otaLabel(): string | null {
  if (!otaEnabled() || !Updates) return null;
  if (Updates.isEmbeddedLaunch) return null;
  const d = Updates.createdAt;
  return d ? `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}` : (Updates.updateId?.slice(0, 8) ?? null);
}

export type OtaResult = 'none' | 'downloaded' | 'disabled';

/** يفحص عن تحديث فوري وينزّله؛ يُرجع «downloaded» إن صار جاهزاً للتطبيق */
export async function fetchOta(): Promise<OtaResult> {
  if (!otaEnabled() || !Updates) return 'disabled';
  const r = await Updates.checkForUpdateAsync();
  if (!r.isAvailable) return 'none';
  const f = await Updates.fetchUpdateAsync();
  return f.isNew ? 'downloaded' : 'none';
}

/** يعيد تشغيل التطبيق على التحديث الجديد */
export async function applyOta() {
  if (!Updates) return;
  await Updates.reloadAsync();
}

// ───────────────────────────── ٢. APK ─────────────────────────────
const SKIP_KEY = 'nahj.update.skip';

export interface UpdateInfo { version: number; url: string; sizeMb: number | null; notes?: string }

export async function checkForApk(force = false): Promise<UpdateInfo | null> {
  if (Platform.OS !== 'android' || !BUILD_NUMBER) return null;
  const res = await fetch(`${SITE_URL}/download.json`, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
  if (!res.ok) return null;
  const d = (await res.json()) as { url?: string; version?: string | number; size_mb?: string | number; notes?: string };
  const version = Number(d.version);
  if (!d.url || !version || version <= BUILD_NUMBER) return null;
  if (!force) {
    // «لاحقاً»: لا نزعجه بنفس النسخة قبل يوم
    const skip = await AsyncStorage.getItem(SKIP_KEY).catch(() => null);
    if (skip) {
      const [v, at] = skip.split(':').map(Number);
      if (v === version && Date.now() - at < 86400000) return null;
    }
  }
  return { version, url: d.url, sizeMb: Number(d.size_mb) || null, notes: d.notes };
}

export function skipApk(version: number) {
  AsyncStorage.setItem(SKIP_KEY, `${version}:${Date.now()}`).catch(() => {});
}

export interface DownloadState {
  status: 'idle' | 'downloading' | 'ready' | 'error';
  version: number;
  received: number;
  total: number;
  error?: string;
}

let state: DownloadState = { status: 'idle', version: 0, received: 0, total: 0 };
const listeners = new Set<() => void>();
let task: DownloadTask | null = null;
let cancelled = false;

function setState(next: Partial<DownloadState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

/** حالة التحميل عامة: تبقى إن أُغلقت النافذة أو انتقل المدرس لشاشة أخرى */
export function useDownload(): DownloadState {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => state, () => state);
}

const apkFile = (v: number) => new File(Paths.cache, `nahj-${v}.apk`);
// التحميل إلى ملف مؤقت ثم النقل عند الاكتمال: لا يُعدّ تحميل منقطع ملفاً جاهزاً
const partFile = (v: number) => new File(Paths.cache, `nahj-${v}.apk.part`);

export async function startDownload(info: UpdateInfo): Promise<void> {
  if (state.status === 'downloading') return;
  const dest = apkFile(info.version);
  if (dest.exists && (dest.size ?? 0) > 1_000_000) {
    setState({ status: 'ready', version: info.version, received: dest.size ?? 0, total: dest.size ?? 0, error: undefined });
    return;
  }
  if (dest.exists) dest.delete();
  const part = partFile(info.version);
  if (part.exists) part.delete();
  cancelled = false;
  setState({ status: 'downloading', version: info.version, received: 0, total: info.sizeMb ? info.sizeMb * 1048576 : 0, error: undefined });
  let serverTotal = 0;
  try {
    task = new DownloadTask(info.url, part, {
      onProgress: ({ bytesWritten, totalBytes }) => {
        if (totalBytes > 0) serverTotal = totalBytes;
        setState({ received: bytesWritten, total: totalBytes > 0 ? totalBytes : state.total });
      },
    });
    await task.downloadAsync();
    task = null;
    if (cancelled) return;
    const size = part.exists ? (part.size ?? 0) : 0;
    // ملف ناقص ولو قليلاً يظهر عند التثبيت «الحزمة غير صالحة»: نتحقق قبل عرضه
    if (size < 1_000_000 || (serverTotal > 0 && size !== serverTotal) || !isCompleteZip(part)) throw new Error('الملف المحمّل ناقص، أعد التحميل');
    part.move(dest);
    setState({ status: 'ready', received: dest.size ?? 0, total: dest.size ?? 0 });
  } catch (e) {
    task = null;
    try { if (part.exists) part.delete(); } catch { /* */ }
    if (cancelled) return;
    setState({ status: 'error', error: e instanceof Error ? e.message : 'تعذّر التحميل' });
  }
}

/** APK = ملف ZIP ينتهي بسجل «نهاية الدليل» (PK\x05\x06)؛ غيابه يعني أن التحميل انقطع */
function isCompleteZip(file: File): boolean {
  let h: ReturnType<File['open']> | null = null;
  try {
    h = file.open();
    const size = h.size ?? file.size ?? 0;
    const n = Math.min(size, 1024);
    h.offset = size - n;
    const b = h.readBytes(n);
    for (let i = b.length - 22; i >= 0; i--) {
      if (b[i] === 0x50 && b[i + 1] === 0x4b && b[i + 2] === 0x05 && b[i + 3] === 0x06) return true;
    }
    return false;
  } catch {
    return true;
  } finally {
    try { h?.close(); } catch { /* */ }
  }
}

export function cancelDownload() {
  cancelled = true;
  try { task?.cancel(); } catch { /* */ }
  task = null;
  setState({ status: 'idle', received: 0, total: 0, error: undefined });
}

/** يفتح شاشة تثبيت أندرويد للملف المحمّل */
export async function installDownloaded(version = state.version): Promise<void> {
  const file = apkFile(version);
  if (!file.exists) throw new Error('ملف التحديث غير موجود، حمّله من جديد.');
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: file.contentUri,
    flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
    type: 'application/vnd.android.package-archive',
  });
}

/** يحذف ملفات التحديث القديمة من الذاكرة المؤقتة (بعد التثبيت) */
export function cleanOldApks() {
  if (Platform.OS !== 'android') return;
  try {
    for (const v of [BUILD_NUMBER, BUILD_NUMBER - 1, BUILD_NUMBER - 2]) {
      const f = apkFile(v);
      if (v > 0 && f.exists) f.delete();
    }
  } catch { /* */ }
}
