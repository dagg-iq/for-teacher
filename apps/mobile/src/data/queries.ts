/** استعلامات جاهزة فوق قاعدة البيانات المحلية */
import {
  buildSheet, columnStats, gradeId, isoDay,
  type Attendance, type Gradebook, type GradeColumn, type SchoolClass, type Section, type SheetRow, type Student,
} from '@nahj/shared';
import { all, get, getSettings, onAnyChange, where } from './db';

export function classesSorted(): SchoolClass[] {
  return all('classes').sort((a, b) => a.sort - b.sort || a.created_at.localeCompare(b.created_at));
}

export function sectionsOf(classId: string): Section[] {
  return where('sections', (s) => s.class_id === classId).sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, 'ar'));
}

/** كل الشعب مرتبة حسب الصف ثم الشعبة */
export function allSections(): Section[] {
  const order = new Map(classesSorted().map((c, i) => [c.id, i]));
  return all('sections')
    .filter((s) => order.has(s.class_id))
    .sort((a, b) => (order.get(a.class_id)! - order.get(b.class_id)!) || a.sort - b.sort || a.name.localeCompare(b.name, 'ar'));
}

export function studentsOf(sectionId: string): Student[] {
  const order = getSettings().prefs.studentOrder;
  const list = where('students', (s) => s.section_id === sectionId);
  if (order === 'number') {
    return list.sort((a, b) => (a.number ?? 1e9) - (b.number ?? 1e9) || a.name.localeCompare(b.name, 'ar'));
  }
  return list.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
}

/** «الخامس العلمي / أ» */
export function sectionLabel(sectionId: string | null | undefined, short = false): string {
  const s = get('sections', sectionId);
  if (!s) return '';
  const c = get('classes', s.class_id);
  if (!c) return s.name;
  return short ? `${c.name} ${s.name}` : `${c.name} / ${s.name}`;
}

export function sectionClass(sectionId: string | null | undefined): SchoolClass | undefined {
  const s = get('sections', sectionId);
  return s ? get('classes', s.class_id) : undefined;
}

export function gradebooksOf(sectionId?: string): Gradebook[] {
  return where('gradebooks', (b) => !sectionId || b.section_id === sectionId)
    .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.updated_at.localeCompare(a.updated_at));
}

/** سجلات شعبة مرتبة: سجلات السنة بترتيبها (الشهر الأول … السعي السنوي) ثم السجلات المخصصة */
export function booksOfSection(sectionId: string, archived = false) {
  const books = where('gradebooks', (b) => b.section_id === sectionId && !!b.archived === archived);
  const groups = new Map<string, Gradebook[]>();
  const loose: Gradebook[] = [];
  for (const b of books) {
    if (b.group_id) { const g = groups.get(b.group_id) ?? []; g.push(b); groups.set(b.group_id, g); } else loose.push(b);
  }
  const sets = [...groups.entries()].map(([id, list]) => ({
    id, year: list[0]?.year ?? null, books: list.sort((a, b) => (a.ord ?? 0) - (b.ord ?? 0)),
  })).sort((a, b) => (b.year ?? '').localeCompare(a.year ?? ''));
  loose.sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.created_at.localeCompare(a.created_at));
  return { sets, loose };
}

export function gradesOf(bookId: string) {
  return where('grades', (g) => g.gradebook_id === bookId);
}

// حساب السجلات مخزّن مؤقتاً حتى أي تعديل: السجلات المرتبطة (السعي) تُحسب من سجلاتها مرة واحدة
const sheetCache = new Map<string, SheetRow[]>();
onAnyChange(() => sheetCache.clear());

/** جدول السجل محسوباً، والأعمدة المرتبطة تأخذ قيمها من السجلات المصدر (مع حماية من الدوران) */
export function sheetOf(book: Gradebook, visiting: Set<string> = new Set()): SheetRow[] {
  const cached = sheetCache.get(book.id);
  if (cached) return cached;
  visiting.add(book.id);
  const rows = buildSheet(book, studentsOf(book.section_id), gradesOf(book.id), (col) => {
    const src = col.source ? get('gradebooks', col.source.book_id) : undefined;
    if (!src || visiting.has(src.id)) return null;
    const srcRows = sheetOf(src, visiting);
    return new Map(srcRows.map((r) => [r.student.id, r.values[col.source!.column_id] ?? null]));
  });
  visiting.delete(book.id);
  sheetCache.set(book.id, rows);
  return rows;
}

/** وصف مصدر عمود مرتبط: «المجموع — الشهر الأول — الفصل الأول» */
export function linkLabel(col: GradeColumn): string {
  if (col.kind !== 'link' || !col.source) return '';
  const b = get('gradebooks', col.source.book_id);
  if (!b) return 'السجل المصدر محذوف';
  const c = b.columns.find((x) => x.id === col.source!.column_id);
  return c ? `${c.name} — ${b.title}` : b.title;
}

/** عدد الدرجات الحرجة التي تنتظر قرار المدرس في سجل */
export function criticalCount(book: Gradebook, rows = sheetOf(book)): number {
  let n = 0;
  for (const r of rows) n += Object.keys(r.critical).length;
  return n;
}

export function deciderOf(book: Gradebook): GradeColumn | null {
  return book.columns.find((c) => c.id === book.result.column_id) ?? null;
}

/** عدد الدرجات المدخلة في سجل من أصل المطلوب (أعمدة الإدخال × الطلاب) */
export function bookProgress(book: Gradebook): { filled: number; total: number; computed: boolean } {
  const students = studentsOf(book.section_id).length;
  const inputs = book.columns.filter((c) => c.kind === 'input');
  if (!inputs.length) {
    // سجل محسوب بالكامل (السعي): التقدّم = عدد الطلاب الذين اكتمل حسابهم
    const rows = sheetOf(book);
    const dec = deciderOf(book);
    return { filled: dec ? rows.filter((r) => r.values[dec.id] != null).length : 0, total: students, computed: true };
  }
  const ids = new Set(inputs.map((c) => c.id));
  const live = new Set(where('students', (s) => s.section_id === book.section_id).map((s) => s.id));
  let filled = 0;
  for (const g of gradesOf(book.id)) if (ids.has(g.column_id) && live.has(g.student_id) && (g.value != null || g.mark)) filled++;
  return { filled, total: students * inputs.length, computed: false };
}

/**
 * العمود الأنسب للإحصاء: عمود النتيجة إن كانت فيه درجات،
 * وإلا آخر عمود فيه درجات (مثلاً في بداية السنة: الشهر الأول قبل أن يُحسب السعي).
 */
export function statsColumn(book: Gradebook, rows: ReturnType<typeof sheetOf>): GradeColumn | null {
  const has = (id: string) => rows.some((r) => r.values[id] != null);
  const decider = deciderOf(book);
  if (decider && has(decider.id)) return decider;
  for (let i = book.columns.length - 1; i >= 0; i--) if (has(book.columns[i].id)) return book.columns[i];
  return decider ?? book.columns[book.columns.length - 1] ?? null;
}

export function bookStats(book: Gradebook, columnId?: string) {
  const rows = sheetOf(book);
  const col = (columnId ? book.columns.find((c) => c.id === columnId) : null) ?? statsColumn(book, rows);
  if (!col) return null;
  return { column: col, rows, stats: columnStats(rows.map((r) => r.values[col.id]), col.max, { pass: book.result.pass }) };
}

export function gradeValue(bookId: string, studentId: string, columnId: string) {
  return get('grades', gradeId(bookId, studentId, columnId));
}

// ------------------------------------------------------------------ الحضور
export function attendanceId(sectionId: string, date: string, studentId: string) {
  return `${sectionId}|${date}|${studentId}`;
}

export function attendanceOn(sectionId: string, date: string): Map<string, Attendance> {
  const m = new Map<string, Attendance>();
  for (const a of where('attendance', (x) => x.section_id === sectionId && x.date === date)) m.set(a.student_id, a);
  return m;
}

export function absencesOf(studentId: string) {
  const rows = where('attendance', (a) => a.student_id === studentId);
  return {
    absent: rows.filter((a) => a.status === 'absent').length,
    late: rows.filter((a) => a.status === 'late').length,
    excused: rows.filter((a) => a.status === 'excused').length,
    days: rows.length,
    rows: rows.sort((a, b) => b.date.localeCompare(a.date)),
  };
}

/** أيام سُجّل فيها حضور لشعبة (الأحدث أولاً) */
export function attendanceDays(sectionId: string): string[] {
  const days = new Set<string>();
  for (const a of where('attendance', (x) => x.section_id === sectionId)) days.add(a.date);
  return [...days].sort().reverse();
}

// ------------------------------------------------------------------ الرئيسية
export function dashboard() {
  const sections = allSections();
  const students = all('students').filter((s) => sections.some((x) => x.id === s.section_id));
  const books = gradebooksOf().filter((b) => !b.archived);
  // آخر سجل تغيّرت درجاته
  const lastGrade = all('grades').reduce<{ at: string; book: string } | null>((best, g) => (
    (g.value != null || g.mark) && (!best || g.updated_at > best.at) ? { at: g.updated_at, book: g.gradebook_id } : best
  ), null);
  const lastBook = lastGrade ? get('gradebooks', lastGrade.book) : books[0];
  let last: ReturnType<typeof bookStats> & { book: Gradebook } | null = null;
  if (lastBook) {
    const st = bookStats(lastBook);
    if (st) last = { ...st, book: lastBook };
  }
  // نسبة النجاح العامة: كل السجلات الفعالة، عمود النتيجة
  let pass = 0;
  let graded = 0;
  const weak = new Map<string, { student: Student; fails: number; book: Gradebook }>();
  for (const b of books) {
    const st = bookStats(b);
    if (!st) continue;
    pass += st.stats.passCount;
    graded += st.stats.count;
    for (const r of st.rows) {
      if (r.verdict && !r.verdict.pass) {
        const cur = weak.get(r.student.id);
        weak.set(r.student.id, { student: r.student, fails: (cur?.fails ?? 0) + 1, book: b });
      }
    }
  }
  const today = isoDay();
  const attendanceToday = where('attendance', (a) => a.date === today);
  return {
    classes: classesSorted().length,
    sections: sections.length,
    students: students.length,
    books: books.length,
    passRate: graded ? Math.round((pass / graded) * 1000) / 10 : null,
    graded,
    last,
    weak: [...weak.values()].sort((a, b) => b.fails - a.fails).slice(0, 5),
    absentToday: attendanceToday.filter((a) => a.status === 'absent').length,
    critical: books.reduce((n, b) => n + criticalCount(b), 0),
    tasks: where('tasks', (t) => !t.done).sort((a, b) => (a.due ?? '9').localeCompare(b.due ?? '9')).slice(0, 4),
  };
}

/** عنوان الحصة في الجدول، أو null إن كانت شعبتها محذوفة (فلا تظهر في الويدجت ولا التذكير) */
export function slotTitle(slot: { section_id?: string | null; label?: string | null }, short = true): string | null {
  if (slot.section_id) return sectionLabel(slot.section_id, short) || null;
  return slot.label?.trim() || null;
}

// ------------------------------------------------------------------ التقارير
/** تقرير شعبة: إحصاء كل سجل بترتيب السنة، والراسبون، والسجل الشامل لكل طالب، والغياب */
export function sectionReport(sectionId: string) {
  const { sets, loose } = booksOfSection(sectionId);
  const books = [...sets.flatMap((x) => x.books), ...loose];
  const students = studentsOf(sectionId);
  const stages = books.map((book) => {
    const rows = sheetOf(book);
    const dec = deciderOf(book);
    const stats = dec ? columnStats(rows.map((r) => r.values[dec.id]), dec.max, { pass: book.result.pass }) : null;
    const failing = dec ? rows.filter((r) => r.verdict && !r.verdict.pass).map((r) => ({ student: r.student, value: r.values[dec.id] })) : [];
    return { book, decider: dec, rows, stats, failing, critical: criticalCount(book, rows) };
  });
  const matrix = students.map((st) => {
    const values = stages.map((s) => (s.decider ? s.rows.find((r) => r.student.id === st.id)?.values[s.decider.id] ?? null : null));
    const fails = stages.map((s) => { const r = s.rows.find((x) => x.student.id === st.id); return !!(r?.verdict && !r.verdict.pass); });
    return { student: st, values, fails, absent: absencesOf(st.id).absent };
  });
  const absences = students.map((st) => ({ student: st, ...absencesOf(st.id) })).filter((a) => a.absent || a.late)
    .sort((a, b) => b.absent - a.absent || b.late - a.late);
  return { stages, matrix, absences, students: students.length };
}
