/**
 * محرك المزامنة مع Supabase.
 * يرفع ما تغيّر على الهاتف ثم يسحب ما تغيّر على الخادم (synced_at يضبطه الخادم).
 * يعمل عند فتح التطبيق، وعند العودة إليه، وبعد كل تعديل بثوانٍ، ويدوياً من «الحساب».
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { chunk, SYNC_TABLES, type Base, type TableName, type TableRow } from '@midad/shared';
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { isConfigured, supabase } from '@/lib/supabase';
import { getSettings, onLocalChange, syncState } from './db';

export type SyncStatus = { state: 'off' | 'idle' | 'syncing' | 'error'; lastSync: string | null; error?: string; pending: number };

let status: SyncStatus = { state: isConfigured ? 'idle' : 'off', lastSync: null, pending: 0 };
const listeners = new Set<() => void>();
const set = (s: Partial<SyncStatus>) => { status = { ...status, ...s, pending: syncState.pendingCount() }; listeners.forEach((l) => l()); };

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => status, () => status);
}

const CURSOR = 'midad.sync.cursor';
const LAST = 'midad.sync.last';

/** الحقول المحلية فقط (نحذف ما يضيفه الخادم) */
function toLocal(r: Record<string, unknown>): Base {
  const { owner_id: _o, synced_at: _s, ...rest } = r;
  return rest as unknown as Base;
}

let running: Promise<void> | null = null;
let userId: string | null = null;

export function syncNow(): Promise<void> {
  if (!isConfigured || !userId) return Promise.resolve();
  if (running) return running;
  running = run().finally(() => { running = null; });
  return running;
}

async function run() {
  const uid = userId;
  if (!uid) return;
  set({ state: 'syncing', error: undefined });
  try {
    const cursor: Record<string, string> = JSON.parse((await AsyncStorage.getItem(`${CURSOR}.${uid}`)) || '{}');

    // ١) الإعدادات
    if (syncState.settingsDirty()) {
      const s = getSettings();
      const { error } = await supabase.from('teacher_settings').upsert({
        owner_id: uid, profile: s.profile, timetable: s.timetable, prefs: s.prefs, updated_at: s.updated_at,
      });
      if (error) throw error;
      syncState.markSettingsClean(s.updated_at);
    }

    // ٢) الرفع: الآباء قبل الأبناء
    for (const t of SYNC_TABLES) {
      const ids = syncState.dirtyIds(t);
      if (!ids.length) continue;
      for (const part of chunk(ids, 400)) {
        const rows = syncState.rowsByIds(t, part);
        if (!rows.length) continue;
        const payload = rows.map((r) => ({ ...r, owner_id: uid }));
        const { error } = await supabase.from(t).upsert(payload, { onConflict: 'id' });
        if (error) throw error;
        syncState.markClean(t, rows);
      }
    }

    // ٣) السحب
    const { data: sRow, error: sErr } = await supabase.from('teacher_settings').select('*').eq('owner_id', uid).maybeSingle();
    if (sErr) throw sErr;
    if (sRow) syncState.applyRemoteSettings(sRow as never);

    for (const t of SYNC_TABLES) {
      let since = cursor[t] ?? '1970-01-01T00:00:00Z';
      for (let page = 0; page < 50; page++) {
        const { data, error } = await supabase.from(t).select('*').gt('synced_at', since).order('synced_at', { ascending: true }).limit(1000);
        if (error) throw error;
        if (!data?.length) break;
        syncState.applyRemote(t as TableName, data.map((r) => toLocal(r as Record<string, unknown>)) as TableRow[TableName][]);
        since = String((data[data.length - 1] as { synced_at: string }).synced_at);
        cursor[t] = since;
        if (data.length < 1000) break;
      }
    }
    await AsyncStorage.setItem(`${CURSOR}.${uid}`, JSON.stringify(cursor));
    const at = new Date().toISOString();
    await AsyncStorage.setItem(LAST, at);
    set({ state: 'idle', lastSync: at });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
    set({ state: 'error', error: /fetch|network/i.test(msg) ? 'لا يوجد اتصال بالإنترنت' : msg });
  }
}

let timer: ReturnType<typeof setTimeout> | null = null;

/** يبدأ المزامنة التلقائية لمستخدم (ويوقفها عند الخروج) */
export function startSync(uid: string | null): () => void {
  userId = uid;
  if (!isConfigured) return () => {};
  if (!uid) { set({ state: 'idle' }); return () => {}; }
  AsyncStorage.getItem(LAST).then((v) => v && set({ lastSync: v })).catch(() => {});
  syncNow();
  const offChange = onLocalChange(() => {
    set({});
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { syncNow(); }, 4000);
  });
  const sub = AppState.addEventListener('change', (s) => { if (s === 'active') syncNow(); });
  const interval = setInterval(() => { syncNow(); }, 5 * 60 * 1000);
  return () => {
    offChange();
    sub.remove();
    clearInterval(interval);
    if (timer) clearTimeout(timer);
    userId = null;
  };
}
