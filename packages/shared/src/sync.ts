/**
 * منطق المزامنة (محلي أولاً):
 *  - كل سجل يحمل updated_at من الجهاز. عند التعارض: الأحدث يفوز.
 *  - الحذف ناعم (deleted = true) حتى يصل لكل الأجهزة.
 *  - الرفع: كل ما تغيّر بعد آخر رفع ناجح. السحب: كل ما تغيّر على الخادم بعد آخر سحب (synced_at).
 */
import type { Base, TableName } from './types';

export interface MergeResult<T extends Base> {
  rows: Map<string, T>;
  /** عدد السجلات التي تغيّرت محلياً بسبب السحب */
  changed: number;
}

export function newer(a: Pick<Base, 'updated_at'>, b: Pick<Base, 'updated_at'>): boolean {
  return Date.parse(a.updated_at) > Date.parse(b.updated_at);
}

/** يدمج سجلات قادمة من الخادم في النسخة المحلية (آخر تعديل يفوز) */
export function mergeRemote<T extends Base>(local: Map<string, T>, remote: T[]): MergeResult<T> {
  const rows = new Map(local);
  let changed = 0;
  for (const r of remote) {
    const cur = rows.get(r.id);
    if (!cur || newer(r, cur)) {
      rows.set(r.id, r);
      changed++;
    }
  }
  return { rows, changed };
}

/** السجلات التي تحتاج رفعاً: عُدّلت بعد آخر رفع */
export function pendingSince<T extends Base>(rows: Iterable<T>, dirty: Set<string>): T[] {
  const out: T[] = [];
  for (const r of rows) if (dirty.has(r.id)) out.push(r);
  return out;
}

/** يقسم مصفوفة إلى دفعات (لرفع آلاف الدرجات بطلبات معقولة) */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** سجلات محذوفة منذ مدة طويلة يمكن تنظيفها محلياً بعد رفعها */
export function purgeable<T extends Base>(rows: Iterable<T>, dirty: Set<string>, olderThanDays: number, now = Date.now()): string[] {
  const limit = now - olderThanDays * 86400000;
  const out: string[] = [];
  for (const r of rows) if (r.deleted && !dirty.has(r.id) && Date.parse(r.updated_at) < limit) out.push(r.id);
  return out;
}

/** أعمدة كل جدول في الخادم: أي حقل محلي غيرها لا يُرسل (وإلا رُفض الصف كله) */
export const SERVER_COLUMNS: Record<TableName, readonly string[]> = {
  classes: ['id', 'name', 'stage', 'subject', 'hue', 'sort', 'created_at', 'updated_at', 'deleted'],
  sections: ['id', 'class_id', 'name', 'room', 'sort', 'created_at', 'updated_at', 'deleted'],
  students: ['id', 'section_id', 'name', 'number', 'parent_phone', 'notes', 'gender', 'sort', 'history', 'created_at', 'updated_at', 'deleted'],
  gradebooks: ['id', 'section_id', 'title', 'template', 'columns', 'result', 'year', 'note', 'archived', 'pinned', 'group_id', 'role', 'ord', 'created_at', 'updated_at', 'deleted'],
  grades: ['id', 'gradebook_id', 'student_id', 'column_id', 'value', 'mark', 'created_at', 'updated_at', 'deleted'],
  attendance: ['id', 'section_id', 'student_id', 'date', 'status', 'note', 'created_at', 'updated_at', 'deleted'],
  slots: ['id', 'day', 'period', 'section_id', 'label', 'room', 'created_at', 'updated_at', 'deleted'],
  tasks: ['id', 'title', 'note', 'kind', 'due', 'remind', 'done', 'section_id', 'created_at', 'updated_at', 'deleted'],
  lesson_plans: ['id', 'date', 'class_id', 'section_ids', 'title', 'objectives', 'materials', 'method', 'steps', 'evaluation', 'homework', 'done', 'created_at', 'updated_at', 'deleted'],
  student_notes: ['id', 'student_id', 'kind', 'text', 'date', 'created_at', 'updated_at', 'deleted'],
};

/** النصوص الإلزامية وحدّها الأقصى في الخادم (char_length between 1 and N) */
const REQUIRED_TEXT: Partial<Record<TableName, Record<string, number>>> = {
  classes: { name: 120 }, sections: { name: 40 }, students: { name: 160 }, gradebooks: { title: 160 },
  tasks: { title: 300 }, lesson_plans: { title: 300 }, student_notes: { text: 2000 },
};
/** أعمدة الأعداد الصحيحة (int) في الخادم */
const INTEGERS: Partial<Record<TableName, string[]>> = {
  classes: ['hue', 'sort'], sections: ['sort'], students: ['number', 'sort'], gradebooks: ['ord'], slots: ['day', 'period'], tasks: ['remind'],
};

/**
 * سجل محلي ← صف للخادم: يضيف المالك، ويحذف الحقول غير المعرّفة (لتأخذ القيمة الافتراضية)،
 * ومع اسم الجدول ينظّف الصف ليطابق شروط الخادم (أعمدة معروفة فقط، نصوص بطول مسموح، أعداد صحيحة).
 */
export function toServerRow(row: object, ownerId: string, table?: TableName): Record<string, unknown> {
  const o: Record<string, unknown> = { owner_id: ownerId };
  const allowed = table ? new Set(SERVER_COLUMNS[table]) : null;
  for (const [k, v] of Object.entries(row)) if (v !== undefined && (!allowed || allowed.has(k))) o[k] = v;
  if (!table) return o;
  for (const [k, max] of Object.entries(REQUIRED_TEXT[table] ?? {})) {
    const v = String(o[k] ?? '').replace(/\s+/g, ' ').trim();
    o[k] = Array.from(v || '—').slice(0, max).join('');
  }
  for (const k of INTEGERS[table] ?? []) {
    if (o[k] == null) continue;
    const n = Number(o[k]);
    o[k] = Number.isFinite(n) ? Math.max(-2147483648, Math.min(2147483647, Math.round(n))) : null;
  }
  if (table === 'slots') {
    if (typeof o.day === 'number') o.day = Math.max(0, Math.min(6, o.day));
    if (typeof o.period === 'number') o.period = Math.max(0, Math.min(15, o.period));
  }
  if (table === 'grades' && o.mark != null && !['absent', 'exempt', 'cheat'].includes(String(o.mark))) o.mark = null;
  if (table === 'grades' && o.value != null && !Number.isFinite(Number(o.value))) o.value = null;
  if (table === 'student_notes' && !['positive', 'negative', 'note'].includes(String(o.kind))) o.kind = 'note';
  if (table === 'students' && o.gender != null && o.gender !== 'm' && o.gender !== 'f') o.gender = null;
  // حقول الأعمدة الإلزامية في الخادم (not null): null صريحة تُحذف لتأخذ القيمة الافتراضية
  for (const k of ['sort', 'hue', 'stage', 'subject', 'archived', 'pinned', 'done', 'kind', 'columns', 'result', 'section_ids']) if (o[k] === null) delete o[k];
  return o;
}

/** صف من الخادم ← سجل محلي: يحذف ما يضيفه الخادم */
export function fromServerRow<T>(row: Record<string, unknown>): T {
  const { owner_id: _o, synced_at: _s, ...rest } = row;
  return rest as T;
}
