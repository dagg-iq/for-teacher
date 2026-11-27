/**
 * نقل طالب إلى شعبة أخرى نقلاً كاملاً:
 *  - درجاته: كل سجل في شعبته القديمة يُطابَق بنظيره في الشعبة الجديدة (نفس دور سجل السنة وترتيبه، أو نفس العنوان)،
 *    وكل عمود إدخال يُطابَق بالاسم؛ الدرجة تُنقل وتُحذف من القديم. ما لا نظير له يبقى محفوظاً في القديم.
 *  - حضوره وغياباته تنتقل معه، وملاحظاته تبقى (مرتبطة بالطالب).
 *  - يُسجَّل في ملفه «منقول من …» بالتاريخ.
 */
import { gradeId, isoDay, type Gradebook, type StudentTransfer } from '@nahj/shared';
import { get, remove, update, upsertMany, where } from './db';
import { attendanceId, nextSeq, sectionLabel } from './queries';

const norm = (s: string) => s.replace(/[ً-ْـ]/g, '').replace(/[إأآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ').trim();

function matchBook(src: Gradebook, targets: Gradebook[]): Gradebook | undefined {
  if (src.role) {
    const byRole = targets.find((t) => t.role === src.role && (t.ord ?? 0) === (src.ord ?? 0));
    if (byRole) return byRole;
  }
  return targets.find((t) => norm(t.title) === norm(src.title)) ?? (src.template ? targets.filter((t) => t.template === src.template && !t.role).at(0) : undefined);
}

export interface TransferResult { grades: number; kept: number; attendance: number; books: number }

/** يعرض ما سيحدث قبل النقل (للتأكيد) */
export function previewTransfer(studentId: string, toSectionId: string): TransferResult {
  return run(studentId, toSectionId, true);
}

export function transferStudent(studentId: string, toSectionId: string): TransferResult {
  return run(studentId, toSectionId, false);
}

function run(studentId: string, toSectionId: string, dry: boolean): TransferResult {
  const s = get('students', studentId);
  const res: TransferResult = { grades: 0, kept: 0, attendance: 0, books: 0 };
  if (!s || s.section_id === toSectionId) return res;
  const from = s.section_id;
  const fromBooks = where('gradebooks', (b) => b.section_id === from);
  const toBooks = where('gradebooks', (b) => b.section_id === toSectionId);
  const bookMap = new Map<string, Gradebook | undefined>(fromBooks.map((b) => [b.id, matchBook(b, toBooks)]));
  res.books = [...bookMap.values()].filter(Boolean).length;

  // الدرجات
  const moves: { id: string; data: { gradebook_id: string; student_id: string; column_id: string; value: number | null; mark: string | null } }[] = [];
  const drop: string[] = [];
  for (const g of where('grades', (x) => x.student_id === studentId && bookMap.has(x.gradebook_id))) {
    if (g.value == null && !g.mark) continue;
    const src = fromBooks.find((b) => b.id === g.gradebook_id)!;
    const target = bookMap.get(g.gradebook_id);
    const col = src.columns.find((c) => c.id === g.column_id);
    // الأعمدة المتشابهة الاسم: نطابق بترتيبها بين نظيراتها
    const same = col ? src.columns.filter((c) => c.kind === 'input' && norm(c.name) === norm(col.name)) : [];
    const k = col ? same.findIndex((c) => c.id === col.id) : -1;
    const tcol = target && col && col.kind === 'input' ? target.columns.filter((c) => c.kind === 'input' && norm(c.name) === norm(col.name))[k] : undefined;
    if (!target || !tcol) { res.kept++; continue; }
    moves.push({ id: gradeId(target.id, studentId, tcol.id), data: { gradebook_id: target.id, student_id: studentId, column_id: tcol.id, value: g.value, mark: g.mark ?? null } });
    drop.push(g.id);
    res.grades++;
  }

  // الحضور
  const att = where('attendance', (a) => a.student_id === studentId && a.section_id === from);
  res.attendance = att.length;
  if (dry) return res;

  if (moves.length) upsertMany('grades', moves as never);
  for (const id of drop) remove('grades', id);
  if (att.length) {
    upsertMany('attendance', att.map((a) => ({ id: attendanceId(toSectionId, a.date, studentId), data: { section_id: toSectionId, student_id: studentId, date: a.date, status: a.status, note: a.note ?? null } })) as never);
    for (const a of att) remove('attendance', a.id);
  }
  const entry: StudentTransfer = { from_section_id: from, from: sectionLabel(from), to: sectionLabel(toSectionId), date: isoDay() };
  const seq = nextSeq(toSectionId);
  update('students', studentId, { section_id: toSectionId, number: seq, sort: seq, history: [...(s.history ?? []), entry] });
  return res;
}
