/**
 * منطق المزامنة (محلي أولاً):
 *  - كل سجل يحمل updated_at من الجهاز. عند التعارض: الأحدث يفوز.
 *  - الحذف ناعم (deleted = true) حتى يصل لكل الأجهزة.
 *  - الرفع: كل ما تغيّر بعد آخر رفع ناجح. السحب: كل ما تغيّر على الخادم بعد آخر سحب (synced_at).
 */
import type { Base } from './types';

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
