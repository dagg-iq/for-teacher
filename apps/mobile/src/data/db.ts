/**
 * قاعدة البيانات المحلية (محلي أولاً):
 * كل الجداول في الذاكرة + حفظ في AsyncStorage بعد كل تعديل (مؤجَّل قليلاً لتجميع التعديلات).
 * التعديلات تُعلَّم «بحاجة لرفع» ويرفعها محرك المزامنة عند وجود حساب وإنترنت.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_TIMETABLE, SYNC_TABLES, uuid,
  type Base, type TableName, type TableRow, type TeacherProfile, type TimetableConfig,
} from '@nahj/shared';
import { useMemo, useSyncExternalStore } from 'react';

export interface Settings {
  profile: TeacherProfile | null;
  timetable: TimetableConfig | null;
  /** تفضيلات الإدخال الصوتي والطباعة… */
  prefs: Prefs;
  updated_at: string;
}

export interface Prefs {
  /** مدة مؤقت التأكيد في الإدخال الصوتي (ثوانٍ، ٠ = تأكيد يدوي) */
  voiceConfirm: number;
  /** قراءة الدرجة بصوت عالٍ بعد كتابتها */
  voiceSpeak: boolean;
  /** الانتقال للطالب التالي تلقائياً في وضع الترتيب */
  voiceAdvance: boolean;
  /** تذكير الحصص مفعّل */
  classReminders: boolean;
  /** ترويسة الطباعة */
  printHeader: boolean;
  /** ترتيب الطلاب: أبجدي أو حسب التسلسل */
  studentOrder: 'alpha' | 'number';
}

export const DEFAULT_PREFS: Prefs = {
  voiceConfirm: 3,
  voiceSpeak: true,
  voiceAdvance: true,
  classReminders: true,
  printHeader: true,
  studentOrder: 'alpha',
};

type Tables = { [K in TableName]: Map<string, TableRow[K]> };

const emptyTables = (): Tables =>
  Object.fromEntries(SYNC_TABLES.map((t) => [t, new Map()])) as unknown as Tables;

const state = {
  ready: false,
  tables: emptyTables(),
  dirty: Object.fromEntries(SYNC_TABLES.map((t) => [t, new Set<string>()])) as Record<TableName, Set<string>>,
  settings: { profile: null, timetable: null, prefs: DEFAULT_PREFS, updated_at: new Date(0).toISOString() } as Settings,
  settingsDirty: false,
  version: 0,
};

const KEY = (t: string) => `nahj.t.${t}`;
const DIRTY_KEY = 'nahj.dirty';
const SETTINGS_KEY = 'nahj.settings';

// ------------------------------------------------------------------ الاشتراك
const listeners = new Set<() => void>();
const changeHooks = new Set<() => void>();

function emit() {
  state.version++;
  listeners.forEach((l) => l());
}

/** يُستدعى بعد كل تعديل محلي (لجدولة المزامنة) */
export function onLocalChange(fn: () => void) {
  changeHooks.add(fn);
  return () => { changeHooks.delete(fn); };
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

/** أي تغيير في البيانات (محلي، أو من المزامنة، أو التحميل، أو المسح) */
export const onAnyChange = subscribe;

/** رقم نسخة البيانات: يتغير مع كل تعديل */
export function useDBVersion() {
  return useSyncExternalStore(subscribe, () => state.version, () => state.version);
}

/** يحسب قيمة من البيانات ويعيد حسابها عند أي تعديل */
export function useQuery<T>(fn: () => T, deps: unknown[] = []): T {
  const v = useDBVersion();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(fn, [v, ...deps]);
}

// ------------------------------------------------------------------ الحفظ
const pendingWrites = new Set<TableName>();
let writeTimer: ReturnType<typeof setTimeout> | null = null;
let settingsWrite = false;

function schedulePersist(t?: TableName) {
  if (t) pendingWrites.add(t);
  if (writeTimer) return;
  writeTimer = setTimeout(() => {
    writeTimer = null;
    flush().catch(() => {});
  }, 250);
}

/** يكتب كل التعديلات المعلقة فوراً */
export async function flush() {
  const tables = [...pendingWrites];
  pendingWrites.clear();
  try {
    await writeTables(tables);
  } catch (e) {
    // فشل الحفظ (مساحة ممتلئة…): نعيد الجداول للطابور ونحاول لاحقاً بدل أن تضيع التعديلات
    for (const t of tables) pendingWrites.add(t);
    settingsWrite = true;
    setTimeout(() => schedulePersist(), 3000);
    throw e;
  }
}

async function writeTables(tables: TableName[]) {
  const pairs: [string, string][] = tables.map((t) => [KEY(t), JSON.stringify([...state.tables[t].values()])]);
  pairs.push([DIRTY_KEY, JSON.stringify(Object.fromEntries(SYNC_TABLES.map((t) => [t, [...state.dirty[t]]])) )]);
  if (settingsWrite || state.settingsDirty) {
    settingsWrite = false;
    pairs.push([SETTINGS_KEY, JSON.stringify({ ...state.settings, _dirty: state.settingsDirty })]);
  }
  await AsyncStorage.multiSet(pairs);
}

/** يحمّل البيانات من الهاتف (مرة واحدة عند فتح التطبيق) */
export async function loadDB() {
  if (state.ready) return;
  try {
    const keys = [...SYNC_TABLES.map(KEY), DIRTY_KEY, SETTINGS_KEY];
    const got = new Map(await AsyncStorage.multiGet(keys));
    for (const t of SYNC_TABLES) {
      const raw = got.get(KEY(t));
      if (!raw) continue;
      try {
        const rows = JSON.parse(raw) as Base[];
        const m = state.tables[t] as Map<string, Base>;
        for (const r of rows) if (r && r.id) m.set(r.id, r);
      } catch { /* جدول تالف: نتجاهله بدل أن يتوقف التطبيق */ }
    }
    const d = got.get(DIRTY_KEY);
    if (d) {
      try {
        const obj = JSON.parse(d) as Record<string, string[]>;
        for (const t of SYNC_TABLES) state.dirty[t] = new Set(obj[t] ?? []);
      } catch { /* */ }
    }
    const s = got.get(SETTINGS_KEY);
    if (s) {
      try {
        const obj = JSON.parse(s) as Settings & { _dirty?: boolean };
        state.settings = {
          profile: obj.profile ?? null,
          timetable: obj.timetable ?? null,
          prefs: { ...DEFAULT_PREFS, ...(obj.prefs ?? {}) },
          updated_at: obj.updated_at ?? new Date(0).toISOString(),
        };
        state.settingsDirty = !!obj._dirty;
      } catch { /* */ }
    }
  } finally {
    state.ready = true;
    emit();
  }
}

export const isReady = () => state.ready;

// ------------------------------------------------------------------ القراءة
export function all<K extends TableName>(t: K, includeDeleted = false): TableRow[K][] {
  const out: TableRow[K][] = [];
  for (const r of state.tables[t].values()) if (includeDeleted || !r.deleted) out.push(r);
  return out;
}

export function get<K extends TableName>(t: K, id: string | null | undefined): TableRow[K] | undefined {
  if (!id) return undefined;
  const r = state.tables[t].get(id);
  return r && !r.deleted ? r : undefined;
}

export function where<K extends TableName>(t: K, pred: (r: TableRow[K]) => boolean): TableRow[K][] {
  const out: TableRow[K][] = [];
  for (const r of state.tables[t].values()) if (!r.deleted && pred(r)) out.push(r);
  return out;
}

export function count<K extends TableName>(t: K, pred?: (r: TableRow[K]) => boolean): number {
  let n = 0;
  for (const r of state.tables[t].values()) if (!r.deleted && (!pred || pred(r))) n++;
  return n;
}

// ------------------------------------------------------------------ الكتابة
const nowIso = () => new Date().toISOString();

type NewRow<K extends TableName> = Omit<TableRow[K], 'id' | 'created_at' | 'updated_at'> & { id?: string; created_at?: string };

function touch(t: TableName, row: Base) {
  (state.tables[t] as Map<string, Base>).set(row.id, row);
  state.dirty[t].add(row.id);
  schedulePersist(t);
}

function changed() {
  emit();
  changeHooks.forEach((h) => h());
}

/** يضيف سجلاً جديداً (أو يستبدل سجلاً بنفس المعرّف) */
export function insert<K extends TableName>(t: K, data: NewRow<K>): TableRow[K] {
  const ts = nowIso();
  const row = { ...data, id: data.id ?? uuid(), created_at: data.created_at ?? ts, updated_at: ts, deleted: false } as unknown as TableRow[K];
  touch(t, row);
  changed();
  return row;
}

/** يضيف عدة سجلات دفعة واحدة (استيراد الطلاب، إنشاء سجلات لعدة شعب) */
export function insertMany<K extends TableName>(t: K, items: NewRow<K>[]): TableRow[K][] {
  const ts = nowIso();
  const rows = items.map((data) => ({ ...data, id: data.id ?? uuid(), created_at: data.created_at ?? ts, updated_at: ts, deleted: false } as unknown as TableRow[K]));
  for (const r of rows) touch(t, r);
  changed();
  return rows;
}

export function update<K extends TableName>(t: K, id: string, patch: Partial<TableRow[K]>): TableRow[K] | undefined {
  const cur = state.tables[t].get(id);
  if (!cur) return undefined;
  const row = { ...cur, ...patch, id, updated_at: nowIso() } as TableRow[K];
  touch(t, row);
  changed();
  return row;
}

/** تعديل عدة سجلات في دفعة واحدة */
export function updateMany<K extends TableName>(t: K, patches: { id: string; patch: Partial<TableRow[K]> }[]) {
  const ts = nowIso();
  for (const { id, patch } of patches) {
    const cur = state.tables[t].get(id);
    if (!cur) continue;
    touch(t, { ...cur, ...patch, id, updated_at: ts } as TableRow[K]);
  }
  changed();
}

/** يضيف السجل إن لم يوجد أو يعدّله (للدرجات والحضور بمعرّف ثابت) */
export function upsert<K extends TableName>(t: K, id: string, data: Omit<NewRow<K>, 'id'>): TableRow[K] {
  const cur = state.tables[t].get(id);
  const ts = nowIso();
  const row = (cur
    ? { ...cur, ...data, id, updated_at: ts, deleted: false }
    : { ...data, id, created_at: ts, updated_at: ts, deleted: false }) as unknown as TableRow[K];
  touch(t, row);
  changed();
  return row;
}

export function upsertMany<K extends TableName>(t: K, items: { id: string; data: Omit<NewRow<K>, 'id'> }[]) {
  const ts = nowIso();
  for (const { id, data } of items) {
    const cur = state.tables[t].get(id);
    touch(t, (cur
      ? { ...cur, ...data, id, updated_at: ts, deleted: false }
      : { ...data, id, created_at: ts, updated_at: ts, deleted: false }) as unknown as TableRow[K]);
  }
  changed();
}

/** حذف ناعم مع حذف ما يتبعه */
export function remove(t: TableName, id: string) {
  const ts = nowIso();
  const kill = (tt: TableName, rid: string) => {
    const cur = state.tables[tt].get(rid) as Base | undefined;
    if (!cur || cur.deleted) return;
    touch(tt, { ...cur, deleted: true, updated_at: ts });
  };
  const cascade = (tt: TableName, rid: string) => {
    kill(tt, rid);
    if (tt === 'classes') {
      for (const s of state.tables.sections.values()) if (s.class_id === rid && !s.deleted) cascade('sections', s.id);
      for (const p of state.tables.lesson_plans.values()) if (p.class_id === rid && !p.deleted) kill('lesson_plans', p.id);
    } else if (tt === 'sections') {
      for (const s of state.tables.students.values()) if (s.section_id === rid && !s.deleted) cascade('students', s.id);
      for (const b of state.tables.gradebooks.values()) if (b.section_id === rid && !b.deleted) cascade('gradebooks', b.id);
      for (const a of state.tables.attendance.values()) if (a.section_id === rid && !a.deleted) kill('attendance', a.id);
      for (const s of state.tables.slots.values()) if (s.section_id === rid && !s.deleted) kill('slots', s.id);
      for (const k of state.tables.tasks.values()) if (k.section_id === rid && !k.deleted) touch('tasks', { ...k, section_id: null, updated_at: ts } as Base);
    } else if (tt === 'students') {
      for (const g of state.tables.grades.values()) if (g.student_id === rid && !g.deleted) kill('grades', g.id);
      for (const a of state.tables.attendance.values()) if (a.student_id === rid && !a.deleted) kill('attendance', a.id);
      for (const n of state.tables.student_notes.values()) if (n.student_id === rid && !n.deleted) kill('student_notes', n.id);
    } else if (tt === 'gradebooks') {
      for (const g of state.tables.grades.values()) if (g.gradebook_id === rid && !g.deleted) kill('grades', g.id);
    }
  };
  cascade(t, id);
  changed();
}

// ------------------------------------------------------------------ الإعدادات
export function useSettings(): Settings {
  useDBVersion();
  return state.settings;
}

export function getSettings(): Settings {
  return state.settings;
}

export function setSettings(patch: Partial<Omit<Settings, 'updated_at'>>) {
  state.settings = {
    ...state.settings,
    ...patch,
    prefs: { ...state.settings.prefs, ...(patch.prefs ?? {}) },
    updated_at: nowIso(),
  };
  state.settingsDirty = true;
  settingsWrite = true;
  schedulePersist();
  changed();
}

export function getTimetable(): TimetableConfig {
  return state.settings.timetable ?? DEFAULT_TIMETABLE;
}

// ------------------------------------------------------------------ للمزامنة
export const syncState = {
  dirtyIds: (t: TableName) => [...state.dirty[t]],
  rowsByIds<K extends TableName>(t: K, ids: string[]): TableRow[K][] {
    const out: TableRow[K][] = [];
    for (const id of ids) {
      const r = state.tables[t].get(id);
      if (r) out.push(r);
    }
    return out;
  },
  /** بعد رفع ناجح: نزيل علامة «بحاجة لرفع» عن السجلات التي لم تتغير أثناء الرفع */
  markClean(t: TableName, sent: Base[]) {
    for (const r of sent) {
      const cur = state.tables[t].get(r.id);
      if (cur && cur.updated_at === r.updated_at) state.dirty[t].delete(r.id);
    }
    schedulePersist();
  },
  /** يدمج سجلات من الخادم (آخر تعديل يفوز). يُرجع عدد ما تغيّر */
  applyRemote<K extends TableName>(t: K, rows: TableRow[K][]): number {
    let n = 0;
    const m = state.tables[t];
    for (const r of rows) {
      const cur = m.get(r.id);
      if (!cur || Date.parse(r.updated_at) > Date.parse(cur.updated_at)) {
        m.set(r.id, r);
        state.dirty[t].delete(r.id);
        n++;
      }
    }
    if (n) { schedulePersist(t); emit(); }
    return n;
  },
  settingsDirty: () => state.settingsDirty,
  markSettingsClean(at: string) {
    if (state.settings.updated_at === at) { state.settingsDirty = false; settingsWrite = true; schedulePersist(); }
  },
  applyRemoteSettings(s: Partial<Settings> & { updated_at: string }) {
    if (Date.parse(s.updated_at) <= Date.parse(state.settings.updated_at)) return false;
    state.settings = {
      profile: s.profile ?? state.settings.profile,
      timetable: s.timetable ?? state.settings.timetable,
      prefs: { ...DEFAULT_PREFS, ...(s.prefs ?? {}) },
      updated_at: s.updated_at,
    };
    state.settingsDirty = false;
    settingsWrite = true;
    schedulePersist();
    emit();
    return true;
  },
  /** يعلّم كل البيانات «بحاجة لرفع» (أول دخول بحساب جديد) */
  markAllDirty() {
    for (const t of SYNC_TABLES) for (const id of state.tables[t].keys()) state.dirty[t].add(id);
    state.settingsDirty = true;
    settingsWrite = true;
    schedulePersist();
  },
  pendingCount(): number {
    return SYNC_TABLES.reduce((n, t) => n + state.dirty[t].size, 0) + (state.settingsDirty ? 1 : 0);
  },
};

/** يمسح كل البيانات من الهاتف (تسجيل الخروج مع الحذف) */
export async function wipeLocal() {
  state.tables = emptyTables();
  for (const t of SYNC_TABLES) state.dirty[t] = new Set();
  state.settings = { profile: null, timetable: null, prefs: DEFAULT_PREFS, updated_at: new Date(0).toISOString() };
  state.settingsDirty = false;
  // لقطة الويدجت ومؤشرات المزامنة أيضاً: بعد المسح يُسحب كل شيء من الخادم من جديد عند الدخول
  const keys = await AsyncStorage.getAllKeys().catch(() => [] as readonly string[]);
  const syncKeys = keys.filter((k) => k.startsWith('nahj.sync.'));
  await AsyncStorage.multiRemove([...SYNC_TABLES.map(KEY), DIRTY_KEY, SETTINGS_KEY, 'nahj.widget.snapshot', ...syncKeys]);
  emit();
}

// ------------------------------------------------------------------ النسخ الاحتياطي
export interface Backup {
  app: 'nahj';
  version: 1;
  exported_at: string;
  settings: Settings;
  tables: { [K in TableName]?: TableRow[K][] };
}

export function exportBackup(): Backup {
  return {
    app: 'nahj',
    version: 1,
    exported_at: nowIso(),
    settings: state.settings,
    tables: Object.fromEntries(SYNC_TABLES.map((t) => [t, all(t)])) as Backup['tables'],
  };
}

/** يستورد نسخة احتياطية (يدمجها مع الموجود: الأحدث يفوز) */
export function importBackup(b: Backup): number {
  if (!b || b.app !== 'nahj' || !b.tables) throw new Error('هذا الملف ليس نسخة احتياطية من نَهج');
  let n = 0;
  for (const t of SYNC_TABLES) {
    const rows = (b.tables[t] ?? []) as Base[];
    const m = state.tables[t] as Map<string, Base>;
    for (const r of rows) {
      if (!r?.id) continue;
      const cur = m.get(r.id);
      if (!cur || Date.parse(r.updated_at) >= Date.parse(cur.updated_at)) {
        m.set(r.id, r);
        state.dirty[t].add(r.id);
        n++;
      }
    }
    pendingWrites.add(t);
  }
  if (b.settings && (!state.settings.profile || Date.parse(b.settings.updated_at) > Date.parse(state.settings.updated_at))) {
    state.settings = { ...b.settings, prefs: { ...DEFAULT_PREFS, ...(b.settings.prefs ?? {}) }, updated_at: nowIso() };
    state.settingsDirty = true;
    settingsWrite = true;
  }
  schedulePersist();
  changed();
  return n;
}
