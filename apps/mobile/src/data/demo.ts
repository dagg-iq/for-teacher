/** بيانات تجريبية واقعية (لتجربة التطبيق ولقطات الموقع) */
import { DEFAULT_TIMETABLE, gradeId, isoDay, schoolYear, sortArabic, TEMPLATES, uuid, type AttendanceStatus } from '@nahj/shared';
import { insert, insertMany, setSettings, upsertMany } from './db';
import { attendanceId } from './queries';

const FIRST = ['أحمد', 'علي', 'حسين', 'محمد', 'مصطفى', 'عباس', 'حسن', 'زيد', 'يوسف', 'كرار', 'مرتضى', 'عبد الله', 'سجاد', 'أمير', 'حيدر', 'منتظر', 'باقر', 'جعفر', 'ياسر', 'عمر', 'إبراهيم', 'قاسم', 'سيف', 'مهدي', 'محمد رضا', 'أنور', 'فاضل', 'نور الدين'];
const FATHER = ['جاسم', 'كاظم', 'عادل', 'كريم', 'ناصر', 'فاضل', 'قاسم', 'سعد', 'رحيم', 'هادي', 'صباح', 'ماجد', 'رياض', 'نبيل', 'خالد', 'سلمان', 'عدنان', 'طالب', 'جبار', 'فلاح'];
const GRAND = ['حسين', 'محمد', 'علي', 'عبد الحسين', 'جواد', 'مهدي', 'عباس', 'كاظم', 'حمزة', 'صالح'];

function rng(seed: number) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
}

export function seedDemo() {
  const r = rng(7);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  setSettings({
    profile: { name: 'محمد حازم', school: 'إعدادية الرافدين للبنين', subject: 'الفيزياء', governorate: 'بغداد', gender: 'm', year: schoolYear() },
    timetable: DEFAULT_TIMETABLE,
  });
  const classes = [
    insert('classes', { name: 'الخامس العلمي', stage: 'preparatory', subject: 'الفيزياء', hue: 0, sort: 0 }),
    insert('classes', { name: 'الرابع العلمي', stage: 'preparatory', subject: 'الفيزياء', hue: 1, sort: 1 }),
  ];
  const sections = [
    insert('sections', { class_id: classes[0].id, name: 'أ', room: 'القاعة 3', sort: 0 }),
    insert('sections', { class_id: classes[0].id, name: 'ب', room: 'القاعة 4', sort: 1 }),
    insert('sections', { class_id: classes[1].id, name: 'أ', room: 'القاعة 7', sort: 0 }),
    insert('sections', { class_id: classes[1].id, name: 'ج', room: 'المختبر', sort: 1 }),
  ];
  const sizes = [26, 24, 28, 22];
  sections.forEach((sec, si) => {
    const used = new Set<string>();
    const names: string[] = [];
    while (names.length < sizes[si]) {
      const n = `${pick(FIRST)} ${pick(FATHER)} ${pick(GRAND)}`;
      if (!used.has(n)) { used.add(n); names.push(n); }
    }
    const students = insertMany('students', sortArabic(names).map((name, i) => ({ section_id: sec.id, name, number: i + 1, sort: i, parent_phone: r() > 0.5 ? `077${Math.floor(10000000 + r() * 89999999)}` : null })));
    // سجل السعي السنوي ونصف الأعمدة مملوءة
    const tpl = TEMPLATES.find((t) => t.key === 'saey')!.build();
    const book = insert('gradebooks', { section_id: sec.id, title: 'سجل السعي السنوي', template: 'saey', columns: tpl.columns, result: tpl.result, year: schoolYear(), pinned: si === 0 });
    const inputs = tpl.columns.filter((c) => c.kind === 'input').slice(0, 3);
    const grades: { id: string; data: { gradebook_id: string; student_id: string; column_id: string; value: number | null; mark: null | 'absent' } }[] = [];
    for (const s of students) {
      const base = 35 + r() * 60;
      for (const col of inputs) {
        const absent = r() < 0.02;
        grades.push({
          id: gradeId(book.id, s.id, col.id),
          data: { gradebook_id: book.id, student_id: s.id, column_id: col.id, value: absent ? null : Math.max(0, Math.min(100, Math.round(base + (r() - 0.5) * 24))), mark: absent ? 'absent' : null },
        });
      }
    }
    upsertMany('grades', grades);
    if (si === 0) {
      const m = TEMPLATES.find((t) => t.key === 'monthly')!.build();
      const quiz = insert('gradebooks', { section_id: sec.id, title: 'امتحان الفصل الأول — الحركة', template: 'monthly', columns: m.columns, result: m.result, year: schoolYear() });
      upsertMany('grades', students.map((s) => ({
        id: gradeId(quiz.id, s.id, m.columns[0].id),
        data: { gradebook_id: quiz.id, student_id: s.id, column_id: m.columns[0].id, value: Math.round(30 + r() * 70), mark: null },
      })));
    }
    // حضور آخر 5 أيام دوام
    const days: string[] = [];
    const d = new Date();
    while (days.length < 5) {
      d.setDate(d.getDate() - 1);
      if (DEFAULT_TIMETABLE.days.includes(d.getDay())) days.push(isoDay(d));
    }
    const att: { id: string; data: { section_id: string; student_id: string; date: string; status: AttendanceStatus } }[] = [];
    for (const day of days) for (const s of students) {
      const x = r();
      const status: AttendanceStatus = x < 0.07 ? 'absent' : x < 0.1 ? 'late' : 'present';
      att.push({ id: attendanceId(sec.id, day, s.id), data: { section_id: sec.id, student_id: s.id, date: day, status } });
    }
    upsertMany('attendance', att);
  });
  // الجدول: كل شعبة 3 حصص أسبوعياً
  const slots: { day: number; period: number; section_id: string; room: string | null }[] = [];
  const plan: [number, number, number][] = [[0, 0, 0], [0, 2, 1], [0, 4, 2], [1, 1, 3], [1, 3, 0], [2, 0, 1], [2, 2, 2], [2, 5, 3], [3, 1, 0], [3, 3, 1], [4, 0, 2], [4, 2, 3]];
  for (const [day, period, s] of plan) slots.push({ day, period, section_id: sections[s].id, room: sections[s].room ?? null });
  insertMany('slots', slots);
  const soon = (days: number, h: number) => { const t = new Date(); t.setDate(t.getDate() + days); t.setHours(h, 0, 0, 0); return t.toISOString(); };
  insertMany('tasks', [
    { title: 'امتحان الشهر الثاني — الخامس أ', kind: 'exam', due: soon(3, 8), remind: 1440, section_id: sections[0].id, note: 'الفصل الثاني: الشغل والطاقة' },
    { title: 'تسليم درجات الشهر الأول للإدارة', kind: 'task', due: soon(1, 12), remind: 60 },
    { title: 'اجتماع أولياء الأمور', kind: 'meeting', due: soon(6, 10), remind: 120 },
  ]);
  insert('lesson_plans', {
    date: isoDay(), class_id: classes[0].id, section_ids: [sections[0].id, sections[1].id], title: 'قانون نيوتن الثاني',
    objectives: 'أن يعرّف الطالب القوة المحصلة.\nأن يطبّق العلاقة ق = ك × ت في مسائل.',
    materials: 'السبورة، عربة المختبر، أثقال', method: 'الاستجواب والتجربة العملية',
    steps: 'مراجعة القانون الأول (5 د)\nالتجربة العملية (15 د)\nاستنتاج العلاقة وحل مثالين (20 د)',
    evaluation: 'سؤالان شفهيان وتمرين على السبورة', homework: 'أسئلة الفصل 1–4 صفحة 42',
  });
  return { classes: classes.length, sections: sections.length };
}

/** ينشئ معرفاً جديداً — لإعادة الاستخدام في الاختبارات */
export const newId = uuid;
