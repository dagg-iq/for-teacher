/** استعلامات جاهزة فوق قاعدة البيانات المحلية */
import {
  buildSheet, columnStats, gradeId, isoDay,
  type Attendance, type Gradebook, type GradeColumn, type SchoolClass, type Section, type Student,
} from '@rasd/shared';
import { all, get, getSettings, where } from './db';

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

export function gradesOf(bookId: string) {
  return where('grades', (g) => g.gradebook_id === bookId);
}

export function sheetOf(book: Gradebook) {
  return buildSheet(book, studentsOf(book.section_id), gradesOf(book.id));
}

export function deciderOf(book: Gradebook): GradeColumn | null {
  return book.columns.find((c) => c.id === book.result.column_id) ?? null;
}

/** عدد الدرجات المدخلة في سجل من أصل المطلوب (أعمدة الإدخال × الطلاب) */
export function bookProgress(book: Gradebook): { filled: number; total: number } {
  const students = studentsOf(book.section_id).length;
  const inputs = book.columns.filter((c) => c.kind === 'input');
  const ids = new Set(inputs.map((c) => c.id));
  const live = new Set(where('students', (s) => s.section_id === book.section_id).map((s) => s.id));
  let filled = 0;
  for (const g of gradesOf(book.id)) if (ids.has(g.column_id) && live.has(g.student_id) && (g.value != null || g.mark)) filled++;
  return { filled, total: students * inputs.length };
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
  return { column: col, rows, stats: columnStats(rows.map((r) => r.values[col.id]), col.max, book.result) };
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
    tasks: where('tasks', (t) => !t.done).sort((a, b) => (a.due ?? '9').localeCompare(b.due ?? '9')).slice(0, 4),
  };
}
