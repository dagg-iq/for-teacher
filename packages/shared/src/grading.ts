/**
 * القوالب العراقية الجاهزة، والتقديرات، وإحصاءات السجل.
 * المرجع: نظام الدرجات في المدارس العراقية (وزارة التربية):
 *  - المتوسطة والإعدادية: الدرجة من ١٠٠، النجاح ٥٠.
 *    السعي السنوي = معدل (معدل الفصل الأول + نصف السنة + معدل الفصل الثاني).
 *    الدرجة النهائية = (السعي السنوي + الامتحان النهائي) ÷ ٢.
 *  - الابتدائية: الدرجة من ١٠، النجاح ٥.
 */
import { evaluateRow, roundHalfUp } from './formula';
import { uuid } from './id';
import type { Band, Grade, GradeColumn, Gradebook, ResultRule, Student } from './types';
import type { Tone } from './theme';

/** التقديرات المعتمدة (بالنسبة المئوية) */
export const IRAQI_BANDS: Band[] = [
  { min: 90, label: 'امتياز', tone: 'good' },
  { min: 80, label: 'جيد جداً', tone: 'good' },
  { min: 70, label: 'جيد', tone: 'info' },
  { min: 60, label: 'متوسط', tone: 'neutral' },
  { min: 50, label: 'مقبول', tone: 'warn' },
  { min: 0, label: 'ضعيف', tone: 'bad' },
];

export const PASS_FAIL_BANDS: Band[] = [
  { min: 50, label: 'ناجح', tone: 'good' },
  { min: 0, label: 'راسب', tone: 'bad' },
];

export interface Verdict {
  label: string;
  tone: Tone;
  pass: boolean;
  /** النسبة المئوية من العظمى */
  pct: number;
}

export function verdictFor(value: number | null | undefined, max: number, rule: Pick<ResultRule, 'pass' | 'bands'>): Verdict | null {
  if (value == null || !Number.isFinite(value) || !max) return null;
  const pct = (value / max) * 100;
  const pass = pct + 1e-9 >= rule.pass;
  const bands = [...rule.bands].sort((a, b) => b.min - a.min);
  const band = bands.find((b) => pct + 1e-9 >= b.min);
  return {
    label: band?.label ?? (pass ? 'ناجح' : 'راسب'),
    tone: band?.tone ?? (pass ? 'good' : 'bad'),
    pass,
    pct,
  };
}

// ------------------------------------------------------------------ القوالب
export interface TemplateDef {
  key: string;
  title: string;
  description: string;
  /** يبني الأعمدة بمعرّفات جديدة */
  build: () => { columns: GradeColumn[]; result: ResultRule };
}

const col = (name: string, max: number, extra: Partial<GradeColumn> = {}): GradeColumn => ({
  id: uuid(), name, kind: 'input', max, round: 'none', ...extra,
});
const f = (name: string, max: number, formula: (ids: Record<string, string>) => string, ids: Record<string, string>, round: GradeColumn['round'] = 'int'): GradeColumn => ({
  id: uuid(), name, kind: 'formula', max, formula: formula(ids), round,
});

function saeyBuild(max: number, pass: number, withFinal: boolean) {
  const m1 = col('الشهر الأول', max);
  const m2 = col('الشهر الثاني', max);
  const t1 = f('معدل الفصل الأول', max, (i) => `معدل({${i.m1}}، {${i.m2}})`, { m1: m1.id, m2: m2.id });
  const mid = col('نصف السنة', max);
  const m3 = col('الشهر الأول ف2', max);
  const m4 = col('الشهر الثاني ف2', max);
  const t2 = f('معدل الفصل الثاني', max, (i) => `معدل({${i.m3}}، {${i.m4}})`, { m3: m3.id, m4: m4.id });
  const saey = f('السعي السنوي', max, (i) => `({${i.t1}} + {${i.mid}} + {${i.t2}}) / 3`, { t1: t1.id, mid: mid.id, t2: t2.id });
  const columns = [m1, m2, t1, mid, m3, m4, t2, saey];
  let decider = saey.id;
  if (withFinal) {
    const fin = col('الامتحان النهائي', max);
    const total = f('الدرجة النهائية', max, (i) => `({${i.s}} + {${i.fin}}) / 2`, { s: saey.id, fin: fin.id });
    columns.push(fin, total);
    decider = total.id;
  }
  return { columns, result: { column_id: decider, pass, bands: IRAQI_BANDS } };
}

export const TEMPLATES: TemplateDef[] = [
  {
    key: 'saey',
    title: 'السعي السنوي',
    description: 'متوسط وإعدادي (من 100): شهرين لكل فصل، نصف السنة، والسعي السنوي محسوب تلقائياً.',
    build: () => saeyBuild(100, 50, false),
  },
  {
    key: 'saey-final',
    title: 'السعي + الامتحان النهائي',
    description: 'مثل السعي السنوي ويضيف الامتحان النهائي والدرجة النهائية = (السعي + النهائي) ÷ 2.',
    build: () => saeyBuild(100, 50, true),
  },
  {
    key: 'primary',
    title: 'ابتدائي (من 10)',
    description: 'الدرجة من 10 والنجاح 5، بنفس تقسيم الفصلين ونصف السنة.',
    build: () => saeyBuild(10, 50, false),
  },
  {
    key: 'term',
    title: 'فصل دراسي',
    description: 'الشهر الأول والثاني ومعدل الفصل.',
    build: () => {
      const m1 = col('الشهر الأول', 100);
      const m2 = col('الشهر الثاني', 100);
      const avg = f('معدل الفصل', 100, (i) => `معدل({${i.a}}، {${i.b}})`, { a: m1.id, b: m2.id });
      return { columns: [m1, m2, avg], result: { column_id: avg.id, pass: 50, bands: IRAQI_BANDS } };
    },
  },
  {
    key: 'monthly',
    title: 'امتحان شهري',
    description: 'عمود واحد من 100 — للامتحانات الشهرية والسريعة.',
    build: () => {
      const e = col('الدرجة', 100);
      return { columns: [e], result: { column_id: e.id, pass: 50, bands: IRAQI_BANDS } };
    },
  },
  {
    key: 'written-oral',
    title: 'تحريري + شفهي',
    description: 'تحريري من 80 وشفهي/يومي من 20، والمجموع من 100.',
    build: () => {
      const w = col('التحريري', 80);
      const o = col('الشفهي', 20);
      const t = f('المجموع', 100, (i) => `مجموع({${i.w}}، {${i.o}})`, { w: w.id, o: o.id }, 'none');
      return { columns: [w, o, t], result: { column_id: t.id, pass: 50, bands: IRAQI_BANDS } };
    },
  },
  {
    key: 'quizzes',
    title: 'اختبارات يومية',
    description: 'خمسة اختبارات قصيرة من 10 ومعدلها محوّل إلى 100.',
    build: () => {
      const qs = [1, 2, 3, 4, 5].map((n) => col(`اختبار ${n}`, 10));
      const avg = f('المعدل من 100', 100, () => `معدل(${qs.map((q) => `{${q.id}}`).join('، ')}) * 10`, {}, '1dp');
      return { columns: [...qs, avg], result: { column_id: avg.id, pass: 50, bands: IRAQI_BANDS } };
    },
  },
  {
    key: 'blank',
    title: 'سجل فارغ',
    description: 'ابدأ من الصفر وأضف الأعمدة والمعادلات كما تريد.',
    build: () => {
      const e = col('الدرجة', 100);
      return { columns: [e], result: { column_id: e.id, pass: 50, bands: IRAQI_BANDS } };
    },
  },
];

/** ينسخ أعمدة سجل بمعرّفات جديدة (لإنشاء نفس السجل لشعبة أخرى) مع تحديث المعادلات */
export function cloneColumns(columns: GradeColumn[], result: ResultRule): { columns: GradeColumn[]; result: ResultRule } {
  const map = new Map(columns.map((c) => [c.id, uuid()]));
  const fix = (expr?: string) => expr?.replace(/\{([^}]+)\}/g, (_, id: string) => `{${map.get(id.trim()) ?? id}}`);
  return {
    columns: columns.map((c) => ({ ...c, id: map.get(c.id)!, formula: fix(c.formula) })),
    result: { ...result, column_id: result.column_id ? map.get(result.column_id) ?? null : null, bands: result.bands.map((b) => ({ ...b })) },
  };
}

// ------------------------------------------------------------------ حساب السجل
export interface SheetRow {
  student: Student;
  /** القيم المحسوبة لكل الأعمدة */
  values: Record<string, number | null>;
  marks: Record<string, Grade['mark']>;
  verdict: Verdict | null;
  /** الترتيب في الشعبة حسب عمود النتيجة (١ = الأول) */
  rank: number | null;
}

export function gradeId(gradebookId: string, studentId: string, columnId: string) {
  return `${gradebookId}|${studentId}|${columnId}`;
}

/** يبني جدول السجل الكامل: لكل طالب كل الأعمدة والنتيجة والترتيب */
export function buildSheet(book: Pick<Gradebook, 'id' | 'columns' | 'result'>, students: Student[], grades: Grade[]): SheetRow[] {
  const byKey = new Map<string, Grade>();
  for (const g of grades) if (!g.deleted && g.gradebook_id === book.id) byKey.set(`${g.student_id}|${g.column_id}`, g);
  const decider = book.columns.find((c) => c.id === book.result.column_id) ?? null;
  const rows: SheetRow[] = students.map((s) => {
    const inputs: Record<string, number | null> = {};
    const marks: Record<string, Grade['mark']> = {};
    for (const c of book.columns) {
      const g = byKey.get(`${s.id}|${c.id}`);
      if (!g) continue;
      if (c.kind === 'input') inputs[c.id] = g.mark === 'absent' || g.mark === 'cheat' ? (g.value ?? 0) : g.value;
      if (g.mark) marks[c.id] = g.mark;
    }
    // الغائب يُحسب صفراً في المعادلات إلا إذا أُعطي درجة؛ المعفى لا يدخل الحساب
    for (const c of book.columns) if (marks[c.id] === 'exempt') inputs[c.id] = null;
    const values = evaluateRow(book.columns, inputs);
    const verdict = decider ? verdictFor(values[decider.id], decider.max, book.result) : null;
    return { student: s, values, marks, verdict, rank: null };
  });
  if (decider) {
    const ranked = rows.filter((r) => r.values[decider.id] != null).sort((a, b) => (b.values[decider.id]! - a.values[decider.id]!));
    let prev: number | null = null;
    let rank = 0;
    ranked.forEach((r, i) => {
      const v = r.values[decider.id]!;
      if (prev === null || Math.abs(v - prev) > 1e-9) rank = i + 1;
      r.rank = rank;
      prev = v;
    });
  }
  return rows;
}

// ------------------------------------------------------------------ الإحصاء
export interface ColumnStats {
  count: number;
  total: number;
  avg: number | null;
  max: number | null;
  min: number | null;
  median: number | null;
  stdev: number | null;
  passCount: number;
  failCount: number;
  /** نسبة النجاح ٠–١٠٠ */
  passRate: number | null;
  bands: { label: string; tone: Tone; count: number }[];
}

export function columnStats(values: (number | null | undefined)[], max: number, rule: Pick<ResultRule, 'pass' | 'bands'>): ColumnStats {
  const vs = values.filter((v): v is number => v != null && Number.isFinite(v));
  const n = vs.length;
  const sorted = [...vs].sort((a, b) => a - b);
  const sum = vs.reduce((s, v) => s + v, 0);
  const avg = n ? sum / n : null;
  const median = n ? (n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2) : null;
  const stdev = n && avg != null ? Math.sqrt(vs.reduce((s, v) => s + (v - avg) ** 2, 0) / n) : null;
  let passCount = 0;
  const bands = [...rule.bands].sort((a, b) => b.min - a.min).map((b) => ({ label: b.label, tone: b.tone, count: 0, min: b.min }));
  for (const v of vs) {
    const vd = verdictFor(v, max, rule);
    if (vd?.pass) passCount++;
    const pct = (v / max) * 100;
    const b = bands.find((x) => pct + 1e-9 >= x.min);
    if (b) b.count++;
  }
  return {
    count: n,
    total: values.length,
    avg: avg == null ? null : roundHalfUp(avg, 2),
    max: n ? sorted[n - 1] : null,
    min: n ? sorted[0] : null,
    median,
    stdev: stdev == null ? null : roundHalfUp(stdev, 2),
    passCount,
    failCount: n - passCount,
    passRate: n ? roundHalfUp((passCount / n) * 100, 1) : null,
    bands: bands.map(({ label, tone, count }) => ({ label, tone, count })),
  };
}

/** أحرف الشعب العراقية بالترتيب */
export const SECTION_LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح', 'ط', 'ي', 'ك', 'ل'];

/** الصفوف الشائعة في العراق (اقتراحات سريعة عند إضافة صف) */
export const COMMON_CLASSES: { name: string; stage: 'primary' | 'intermediate' | 'preparatory' }[] = [
  { name: 'الأول الابتدائي', stage: 'primary' },
  { name: 'الثاني الابتدائي', stage: 'primary' },
  { name: 'الثالث الابتدائي', stage: 'primary' },
  { name: 'الرابع الابتدائي', stage: 'primary' },
  { name: 'الخامس الابتدائي', stage: 'primary' },
  { name: 'السادس الابتدائي', stage: 'primary' },
  { name: 'الأول المتوسط', stage: 'intermediate' },
  { name: 'الثاني المتوسط', stage: 'intermediate' },
  { name: 'الثالث المتوسط', stage: 'intermediate' },
  { name: 'الرابع العلمي', stage: 'preparatory' },
  { name: 'الرابع الأدبي', stage: 'preparatory' },
  { name: 'الخامس العلمي', stage: 'preparatory' },
  { name: 'الخامس الأدبي', stage: 'preparatory' },
  { name: 'السادس العلمي', stage: 'preparatory' },
  { name: 'السادس الأدبي', stage: 'preparatory' },
];

export const COMMON_SUBJECTS = [
  'الرياضيات', 'الفيزياء', 'الكيمياء', 'الأحياء', 'اللغة العربية', 'اللغة الإنكليزية', 'التربية الإسلامية',
  'الاجتماعيات', 'التاريخ', 'الجغرافية', 'الاقتصاد', 'العلوم', 'الحاسوب', 'اللغة الكردية', 'اللغة الفرنسية',
  'التربية الفنية', 'التربية الرياضية', 'الوطنية', 'القراءة', 'الفلسفة وعلم النفس',
];
