/**
 * محرك المزامنة مع Supabase.
 * يرفع ما تغيّر على الهاتف ثم يسحب ما تغيّر على الخادم (synced_at يضبطه الخادم).
 * يعمل عند فتح التطبيق، وعند العودة إليه، وبعد كل تعديل بثوانٍ، ويدوياً من «الحساب».
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { chunk, fromServerRow, SYNC_TABLES, toServerRow, type Base, type TableName, type TableRow } from '@nahj/shared';
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { SYNC_BACKEND } from '@/lib/config';
import { isConfigured, supabase } from '@/lib/supabase';
import { backend } from './backends';
import { maybeAutoBackup } from './cloud-backup';
import { getSettings, onLocalChange, syncState } from './db';

export type AccountStatus = 'pending' | 'approved' | 'suspended' | 'rejected';
/** waiting: الحساب لم يُفعّله المدير بعد (أو موقوف) — البيانات تبقى على الجهاز حتى التفعيل */
export type SyncStatus = { state: 'off' | 'idle' | 'syncing' | 'error' | 'waiting'; lastSync: string | null; error?: string; pending: number; account?: AccountStatus };

let status: SyncStatus = { state: isConfigured ? 'idle' : 'off', lastSync: null, pending: 0 };
const listeners = new Set<() => void>();
const set = (s: Partial<SyncStatus>) => { status = { ...status, ...s, pending: syncState.pendingCount() }; listeners.forEach((l) => l()); };

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => status, () => status);
}

const CURSOR = 'nahj.sync.cursor';
const LAST = 'nahj.sync.last';


let running: Promise<void> | null = null;
let userId: string | null = null;
/** يتغير عند الخروج أو تبديل الحساب: أي مزامنة قديمة جارية تتوقف قبل أن تكتب شيئاً */
let generation = 0;
class Stale extends Error {}

export function syncNow(): Promise<void> {
  if (!isConfigured || !userId) return Promise.resolve();
  if (running) return running;
  running = run().finally(() => { running = null; });
  return running;
}

async function run() {
  const uid = userId;
  if (!uid) return;
  const gen = generation;
  const alive = () => { if (gen !== generation || userId !== uid) throw new Stale(); };
  set({ state: 'syncing', error: undefined });
  try {
    // ٠) هل فعّل المدير الحساب؟ (بلا تفعيل يرفض الخادم كل شيء، فلا نحاول)
    const account = await accountStatus(uid);
    alive();
    if (account !== 'approved') {
      set({ state: 'waiting', account, error: undefined });
      if (account === 'pending') requestAccess(uid);
      return;
    }
    set({ account });
    const cursor: Record<string, string> = JSON.parse((await AsyncStorage.getItem(`${CURSOR}.${uid}`)) || '{}');

    // ١) الإعدادات
    if (syncState.settingsDirty()) {
      const s = getSettings();
      await backend.pushSettings(uid, { profile: s.profile, timetable: s.timetable, prefs: s.prefs, updated_at: s.updated_at });
      alive();
      syncState.markSettingsClean(s.updated_at);
    }

    // ٢) الرفع: الآباء قبل الأبناء. صفّ يرفضه الخادم لا يوقف البقية: يُعزل ويبقى «بحاجة لرفع» ويُبلَّغ عنه
    const rejected: { table: TableName; count: number; msg: string }[] = [];
    for (const t of SYNC_TABLES) {
      const ids = syncState.dirtyIds(t);
      if (!ids.length) continue;
      for (const part of chunk(ids, 400)) {
        const rows = syncState.rowsByIds(t, part);
        if (!rows.length) continue;
        const bad = await pushIsolating(t, rows, uid, alive);
        if (bad.length) rejected.push({ table: t, count: bad.length, msg: bad[0].msg });
      }
    }

    // ٣) السحب
    const sRow = await backend.pullSettings(uid);
    alive();
    if (sRow) syncState.applyRemoteSettings(sRow as never);

    for (const t of SYNC_TABLES) {
      let since = cursor[t] ?? '1970-01-01T00:00:00Z';
      for (let page = 0; page < 50; page++) {
        // الصفحة الأولى تتداخل ١٠ ثوانٍ مع السحب السابق (معاملات انتهت متأخرة) — الدمج لا يتأثر بالتكرار
        const from = page === 0 && cursor[t] ? new Date(Date.parse(since) - 10000).toISOString() : since;
        const data = await backend.pull(t, from, 1000);
        alive();
        if (!data?.length) break;
        syncState.applyRemote(t as TableName, data.map((r) => fromServerRow<Base>(r as Record<string, unknown>)) as TableRow[TableName][]);
        since = String((data[data.length - 1] as { synced_at: string }).synced_at);
        cursor[t] = since;
        if (data.length < 1000) break;
      }
    }
    alive();
    await AsyncStorage.setItem(`${CURSOR}.${uid}`, JSON.stringify(cursor));
    const at = new Date().toISOString();
    await AsyncStorage.setItem(LAST, at);
    if (rejected.length) {
      const n = rejected.reduce((a, r) => a + r.count, 0);
      const text = `تعذّر رفع ${n} سجل (${rejected.map((r) => `${TABLE_LABEL[r.table]} ${r.count}`).join('، ')}) — ${rejected[0].msg}`;
      set({ state: 'error', lastSync: at, error: text });
      reportError(uid, text);
    } else {
      set({ state: 'idle', lastSync: at });
      reportError(uid, null);
    }
    // لقطة يومية كاملة في Supabase Storage (بعد السحب، فهي تحوي كل بيانات الحساب)
    maybeAutoBackup(uid);
  } catch (e) {
    if (e instanceof Stale) return;
    const msg = errText(e);
    const offline = /fetch|network/i.test(msg);
    set({ state: 'error', error: offline ? 'لا يوجد اتصال بالإنترنت' : msg });
    if (!offline && userId) reportError(userId, msg);
  }
}

const TABLE_LABEL: Record<TableName, string> = {
  classes: 'الصفوف', sections: 'الشعب', students: 'الطلاب', gradebooks: 'السجلات', grades: 'الدرجات',
  attendance: 'الحضور', slots: 'الجدول', tasks: 'المهام', lesson_plans: 'التحضير', student_notes: 'الملاحظات',
};

const errText = (e: unknown) => (e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e));
const isNetwork = (e: unknown) => /fetch|network|timeout|abort/i.test(errText(e));

/**
 * يرفع دفعة؛ إن رفضها الخادم يقسمها نصفين حتى يجد الصفوف المرفوضة بعينها، فتُرفع البقية.
 * أخطاء الشبكة لا تُقسَّم (تُرمى لتتوقف المزامنة وتعاد لاحقاً).
 */
async function pushIsolating(t: TableName, rows: Base[], uid: string, alive: () => void): Promise<{ id: string; msg: string }[]> {
  try {
    await backend.push(t, rows.map((r) => toServerRow(r, uid, t)));
    alive();
    syncState.markClean(t, rows);
    return [];
  } catch (e) {
    if (e instanceof Stale || isNetwork(e)) throw e;
    alive();
    if (rows.length === 1) {
      console.warn('[sync] rejected', t, rows[0].id, errText(e));
      return [{ id: rows[0].id, msg: errText(e) }];
    }
    const mid = Math.ceil(rows.length / 2);
    return [...await pushIsolating(t, rows.slice(0, mid), uid, alive), ...await pushIsolating(t, rows.slice(mid), uid, alive)];
  }
}

/** آخر خطأ مزامنة يُحفظ في حساب المدرّس (يراه المدير في لوحة الإدارة) — مرة عند كل تغيّر فقط */
let reported: string | null | undefined;
function reportError(uid: string, msg: string | null) {
  if (SYNC_BACKEND !== 'supabase' || reported === msg) return;
  reported = msg;
  supabase.rpc('report_sync_error', { msg: msg ?? '' }).then(({ error }) => { if (error) reported = undefined; }, () => { reported = undefined; });
  void uid;
}

/** حالة الحساب عند المدير. خادم أقدم بلا جدول teacher_accounts، أو خادم Oracle: مفعّل */
async function accountStatus(uid: string): Promise<AccountStatus> {
  if (SYNC_BACKEND !== 'supabase') return 'approved';
  const { data, error } = await supabase.from('teacher_accounts').select('status').eq('id', uid).maybeSingle();
  if (error) {
    if (/teacher_accounts|schema cache|does not exist/i.test(error.message)) return 'approved';
    throw error;
  }
  return ((data as { status?: AccountStatus } | null)?.status) ?? 'pending';
}

/** يُشعر المدير بطلب الحساب (مرة واحدة؛ الخادم يتجاهل التكرار) */
const requested = new Set<string>();
function requestAccess(uid: string) {
  if (requested.has(uid)) return;
  requested.add(uid);
  supabase.functions.invoke('access-request', { body: {} }).catch(() => { requested.delete(uid); });
}

let timer: ReturnType<typeof setTimeout> | null = null;

/**
 * مزامنة فورية: أي تغيّر على الخادم في بيانات هذا المدرّس (من جهاز آخر) يُطلق سحباً خلال ثانيتين.
 * يحترم RLS (لا تصل إلا صفوف المدرّس نفسه). بلا اتصال مباشر: تبقى المزامنة الدورية وعند فتح التطبيق.
 */
function listenLive(uid: string): () => void {
  if (SYNC_BACKEND !== 'supabase') return () => {};
  let t: ReturnType<typeof setTimeout> | null = null;
  const poke = () => {
    if (t) clearTimeout(t);
    t = setTimeout(() => { syncNow(); }, 2000);
  };
  let ch = supabase.channel(`nahj-sync-${uid}`);
  for (const table of [...SYNC_TABLES, 'teacher_settings']) {
    ch = ch.on('postgres_changes' as never, { event: '*', schema: 'public', table, filter: `owner_id=eq.${uid}` } as never, poke as never);
  }
  ch.subscribe();
  // على الحاسوب: الرجوع لنافذة التطبيق يزامن فوراً
  const onFocus = () => { syncNow(); };
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') window.addEventListener('focus', onFocus);
  return () => {
    if (t) clearTimeout(t);
    supabase.removeChannel(ch).catch(() => {});
    if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') window.removeEventListener('focus', onFocus);
  };
}

/** يبدأ المزامنة التلقائية لمستخدم (ويوقفها عند الخروج) */
export function startSync(uid: string | null): () => void {
  generation++;
  userId = uid;
  if (!isConfigured) return () => {};
  if (!uid) { set({ state: 'idle', account: undefined }); return () => {}; }
  AsyncStorage.getItem(LAST).then((v) => v && set({ lastSync: v })).catch(() => {});
  syncNow();
  const offChange = onLocalChange(() => {
    set({});
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { syncNow(); }, 4000);
  });
  const sub = AppState.addEventListener('change', (s) => { if (s === 'active') syncNow(); });
  const interval = setInterval(() => { syncNow(); }, 5 * 60 * 1000);
  const offLive = listenLive(uid);
  return () => {
    offChange();
    offLive();
    sub.remove();
    clearInterval(interval);
    if (timer) clearTimeout(timer);
    userId = null;
    generation++;
    running = null;
  };
}
