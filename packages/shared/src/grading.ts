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
import type { Band, BookRole, Grade, GradeColumn, Gradebook, ResultRule, Student } from './types';
import type { Tone } from './theme';

/** التقديرات (لم تعد تُعرض: النتيجة ناجح/راسب فقط — تبقى للتوافق مع السجلات القديمة) */
export const IRAQI_BANDS: Band[] = [];
export const PASS_FAIL_BANDS: Band[] = [];

export interface Verdict {
  /** «ناجح» أو «راسب» */
  label: string;
  tone: Tone;
  pass: boolean;
  /** النسبة المئوية من العظمى */
  pct: number;
}

export function verdictFor(value: number | null | undefined, max: number, rule: Pick<ResultRule, 'pass'>): Verdict | null {
  if (value == null || !Number.isFinite(value) || !max) return null;
  const pct = (value / max) * 100;
  const pass = pct + 1e-9 >= rule.pass;
  return { label: pass ? 'ناجح' : 'راسب', tone: pass ? 'good' : 'bad', pass, pct };
}

// ------------------------------------------------------------------ مكوّنات الامتحان الشهري
export interface Component { name: string; max: number }

/** توزيعات شائعة لدرجة الشهر (المجموع ١٠٠) — يختار المدرس واحداً ثم يعدّله كما يريد */
export const COMPONENT_PRESETS: { key: string; label: string; items: Component[] }[] = [
  { key: 'english', label: 'تحريري 60 · إنشاء 10 · شفهي 30', items: [{ name: 'التحريري', max: 60 }, { name: 'الإنشاء', max: 10 }, { name: 'الشفهي', max: 30 }] },
  { key: 'w70', label: 'تحريري 70 · شفهي 30', items: [{ name: 'التحريري', max: 70 }, { name: 'الشفهي', max: 30 }] },
  { key: 'w80', label: 'تحريري 80 · شفهي 20', items: [{ name: 'التحريري', max: 80 }, { name: 'الشفهي', max: 20 }] },
  { key: 'w60d', label: 'تحريري 60 · شفهي 20 · يومي 20', items: [{ name: 'التحريري', max: 60 }, { name: 'الشفهي', max: 20 }, { name: 'اليومي', max: 20 }] },
  { key: 'w100', label: 'درجة واحدة من 100', items: [{ name: 'الدرجة', max: 100 }] },
];

const col = (name: string, max: number, extra: Partial<GradeColumn> = {}): GradeColumn => ({
  id: uuid(), name, kind: 'input', max, round: 'none', ...extra,
});
const formulaCol = (name: string, max: number, formula: string, round: GradeColumn['round'] = 'int', extra: Partial<GradeColumn> = {}): GradeColumn => ({
  id: uuid(), name, kind: 'formula', max, formula, round, ...extra,
});
const linkCol = (name: string, max: number, book_id: string, column_id: string): GradeColumn => ({
  id: uuid(), name, kind: 'link', max, round: 'none', source: { book_id, column_id },
});
const ref = (c: GradeColumn) => `{${c.id}}`;

/** نطاق الدرجات الحرجة لعمود عظماه max ونجاحه pass٪: من (النجاح − ٣) إلى النجاح، بالنسبة نفسها */
export function defaultBoost(max: number, passPct: number, below = 3): { from: number; to: number } {
  const to = roundHalfUp((max * passPct) / 100, 2);
  return { from: roundHalfUp(to - (below * max) / 100, 2), to };
}

/** سجل امتحان واحد بمكوّنات (تحريري، شفهي…) ومجموعها */
export function monthBook(components: Component[], pass = 50): { columns: GradeColumn[]; result: ResultRule; total: GradeColumn } {
  const items = components.filter((c) => c.name.trim() && c.max > 0);
  const inputs = items.map((c) => col(c.name.trim(), c.max));
  const totalMax = inputs.reduce((s, c) => s + c.max, 0) || 100;
  if (inputs.length === 1) {
    return { columns: inputs, result: { column_id: inputs[0].id, pass, bands: [] }, total: inputs[0] };
  }
  const total = formulaCol('المجموع', totalMax, `مجموع(${inputs.map(ref).join('، ')})`, 'none');
  return { columns: [...inputs, total], result: { column_id: total.id, pass, bands: [] }, total };
}

export interface YearPlan {
  /** مكوّنات درجة الشهر */
  components: Component[];
  /** مكوّنات امتحان نصف السنة (افتراضياً درجة واحدة) */
  midComponents?: Component[];
  /** نسبة النجاح (٥٠) */
  pass?: number;
  /** تنبيه الدرجات الحرجة في السعي (مثلاً ٣ درجات تحت النجاح)؛ ٠ = بلا تنبيه */
  boostBelow?: number;
  /** إضافة الامتحان النهائي والنتيجة النهائية = (السعي + النهائي) ÷ ٢ */
  withFinal?: boolean;
  /** تقريب السعي (الافتراضي: لأقرب عدد صحيح) */
  round?: 'none' | 'int' | '1dp';
}

export interface BookSpec {
  id: string;
  title: string;
  role: BookRole;
  ord: number;
  columns: GradeColumn[];
  result: ResultRule;
}

/**
 * «سجلات السنة» لشعبة كما في المدرسة العراقية — كل امتحان في سجله، والسعي يُحسب من السجلات:
 *  الشهر الأول/الثاني (ف١) ← سعي الفصل الأول = (الشهر الأول + الشهر الثاني) ÷ ٢
 *  نصف السنة
 *  الشهر الأول/الثاني (ف٢) ← سعي الفصل الثاني
 *  السعي السنوي = (سعي ف١ + نصف السنة + سعي ف٢) ÷ ٣
 * كل السجلات قابلة للتعديل بعدها (أعمدة ومعادلات)، والروابط بينها تبقى صحيحة.
 */
export function buildYearSet(plan: YearPlan): BookSpec[] {
  const pass = plan.pass ?? 50;
  const below = plan.boostBelow ?? 3;
  const round = plan.round ?? 'int';
  const specs: BookSpec[] = [];
  let ord = 0;
  const add = (title: string, role: BookRole, b: { columns: GradeColumn[]; result: ResultRule }) => {
    const spec = { id: uuid(), title, role, ord: ++ord, columns: b.columns, result: b.result };
    specs.push(spec);
    return spec;
  };
  const month = (title: string) => {
    const m = monthBook(plan.components, pass);
    return { spec: add(title, 'month', m), total: m.total };
  };
  const term = (title: string, a: { spec: BookSpec; total: GradeColumn }, b: { spec: BookSpec; total: GradeColumn }) => {
    const max = Math.max(a.total.max, b.total.max);
    const la = linkCol('الشهر الأول', a.total.max, a.spec.id, a.total.id);
    const lb = linkCol('الشهر الثاني', b.total.max, b.spec.id, b.total.id);
    const t = formulaCol(title, max, `(${ref(la)} + ${ref(lb)}) / 2`, round, below ? { boost: defaultBoost(max, pass, below) } : {});
    const columns = [la, lb, t];
    return { spec: add(title, 'term', { columns, result: { column_id: t.id, pass, bands: [] } }), total: t };
  };

  const m1 = month('الشهر الأول — الفصل الأول');
  const m2 = month('الشهر الثاني — الفصل الأول');
  const t1 = term('سعي الفصل الأول', m1, m2);
  const midB = monthBook(plan.midComponents?.length ? plan.midComponents : [{ name: 'درجة نصف السنة', max: m1.total.max }], pass);
  const mid = { spec: add('نصف السنة', 'mid', midB), total: midB.total };
  const m3 = month('الشهر الأول — الفصل الثاني');
  const m4 = month('الشهر الثاني — الفصل الثاني');
  const t2 = term('سعي الفصل الثاني', m3, m4);

  const max = Math.max(t1.total.max, mid.total.max, t2.total.max);
  const a = linkCol('سعي الفصل الأول', t1.total.max, t1.spec.id, t1.total.id);
  const b = linkCol('نصف السنة', mid.total.max, mid.spec.id, mid.total.id);
  const c = linkCol('سعي الفصل الثاني', t2.total.max, t2.spec.id, t2.total.id);
  const annual = formulaCol('السعي السنوي', max, `(${ref(a)} + ${ref(b)} + ${ref(c)}) / 3`, round, below ? { boost: defaultBoost(max, pass, below) } : {});
  const annualSpec = add('السعي السنوي', 'annual', { columns: [a, b, c, annual], result: { column_id: annual.id, pass, bands: [] } });

  if (plan.withFinal) {
    const ls = linkCol('السعي السنوي', annual.max, annualSpec.id, annual.id);
    const fin = col('الامتحان النهائي', max);
    const total = formulaCol('الدرجة النهائية', max, `(${ref(ls)} + ${ref(fin)}) / 2`, round, below ? { boost: defaultBoost(max, pass, below) } : {});
    add('النتيجة النهائية', 'final', { columns: [ls, fin, total], result: { column_id: total.id, pass, bands: [] } });
  }
  return specs;
}

// ------------------------------------------------------------------ قوالب سجل واحد
export interface TemplateDef {
  key: string;
  title: string;
  description: string;
  /** يبني الأعمدة بمعرّفات جديدة */
  build: (components?: Component[]) => { columns: GradeColumn[]; result: ResultRule };
}

export const TEMPLATES: TemplateDef[] = [
  {
    key: 'month',
    title: 'امتحان بمكوّنات',
    description: 'تحريري وشفهي وإنشاء… ومجموعها — لامتحان شهري أو يومي.',
    build: (components) => monthBook(components ?? COMPONENT_PRESETS[0].items),
  },
  {
    key: 'single',
    title: 'درجة واحدة',
    description: 'عمود واحد من 100 — لاختبار سريع أو نشاط.',
    build: () => monthBook([{ name: 'الدرجة', max: 100 }]),
  },
  {
    key: 'blank',
    title: 'سجل مخصص',
    description: 'ابدأ من الصفر: أضف الحقول والمعادلات كما تريد.',
    build: () => monthBook([{ name: 'الدرجة', max: 100 }]),
  },
];

/** ينسخ أعمدة سجل بمعرّفات جديدة (لإنشاء نفس السجل لشعبة أخرى) مع تحديث المعادلات */
export function cloneColumns(columns: GradeColumn[], result: ResultRule): { columns: GradeColumn[]; result: ResultRule } {
  const map = new Map(columns.map((c) => [c.id, uuid()]));
  const fix = (expr?: string) => expr?.replace(/\{([^}]+)\}/g, (_, id: string) => `{${map.get(id.trim()) ?? id}}`);
  return {
    columns: columns.map((c) => ({ ...c, id: map.get(c.id)!, formula: fix(c.formula), source: c.source ? { ...c.source } : c.source, boost: c.boost ? { ...c.boost } : c.boost })),
    result: { ...result, column_id: result.column_id ? map.get(result.column_id) ?? null : null, bands: [] },
  };
}

/** ينسخ مجموعة سجلات مترابطة (سجلات السنة) بمعرّفات جديدة، ويعيد توجيه الروابط بينها */
export function cloneBookSet(books: Pick<Gradebook, 'id' | 'title' | 'columns' | 'result' | 'role' | 'ord'>[]): BookSpec[] {
  const bookMap = new Map(books.map((b) => [b.id, uuid()]));
  const colMap = new Map<string, string>();
  const cloned = books.map((b) => {
    const { columns, result } = cloneColumns(b.columns, b.result);
    b.columns.forEach((c, i) => colMap.set(`${b.id}|${c.id}`, columns[i].id));
    return { b, columns, result };
  });
  return cloned.map(({ b, columns, result }) => ({
    id: bookMap.get(b.id)!,
    title: b.title,
    role: (b.role ?? 'custom') as BookRole,
    ord: b.ord ?? 0,
    result,
    columns: columns.map((c) => (c.kind === 'link' && c.source && bookMap.has(c.source.book_id)
      ? { ...c, source: { book_id: bookMap.get(c.source.book_id)!, column_id: colMap.get(`${c.source.book_id}|${c.source.column_id}`) ?? c.source.column_id } }
      : c)),
  }));
}

// ------------------------------------------------------------------ حساب السجل
export interface SheetRow {
  student: Student;
  /** القيم النهائية لكل الأعمدة (بعد أي تعديل يدوي) */
  values: Record<string, number | null>;
  /** القيم المحسوبة قبل التعديل اليدوي */
  raw: Record<string, number | null>;
  marks: Record<string, Grade['mark']>;
  /** أعمدة عدّل المدرس قيمتها المحسوبة يدوياً (مثل رفع ٤٨ إلى ٥٠) */
  overridden: Record<string, true>;
  /** أعمدة قيمتها في نطاق الدرجات الحرجة ولم يُقرَّر فيها بعد */
  critical: Record<string, true>;
  verdict: Verdict | null;
  /** الترتيب في الشعبة حسب عمود النتيجة (١ = الأول) */
  rank: number | null;
}

export function gradeId(gradebookId: string, studentId: string, columnId: string) {
  return `${gradebookId}|${studentId}|${columnId}`;
}

/** قيم عمود مرتبط: معرّف الطالب ← القيمة في السجل المصدر */
export type LinkResolver = (col: GradeColumn) => Map<string, number | null> | null;

/** يبني جدول السجل الكامل: لكل طالب كل الأعمدة والنتيجة والترتيب والدرجات الحرجة */
export function buildSheet(book: Pick<Gradebook, 'id' | 'columns' | 'result'>, students: Student[], grades: Grade[], link?: LinkResolver): SheetRow[] {
  const byKey = new Map<string, Grade>();
  for (const g of grades) if (!g.deleted && g.gradebook_id === book.id) byKey.set(`${g.student_id}|${g.column_id}`, g);
  const decider = book.columns.find((c) => c.id === book.result.column_id) ?? null;
  const linked = new Map<string, Map<string, number | null> | null>();
  for (const c of book.columns) if (c.kind === 'link') linked.set(c.id, link ? link(c) : null);
  const rows: SheetRow[] = students.map((s) => {
    const inputs: Record<string, number | null> = {};
    const marks: Record<string, Grade['mark']> = {};
    const overrides: Record<string, number | null> = {};
    for (const c of book.columns) {
      if (c.kind === 'link') inputs[c.id] = linked.get(c.id)?.get(s.id) ?? null;
      const g = byKey.get(`${s.id}|${c.id}`);
      if (!g) continue;
      if (c.kind === 'input') inputs[c.id] = g.mark === 'absent' || g.mark === 'cheat' ? (g.value ?? 0) : g.value;
      else if (g.value != null) overrides[c.id] = g.value;
      if (g.mark) marks[c.id] = g.mark;
    }
    // الغائب يُحسب صفراً في المعادلات إلا إذا أُعطي درجة؛ المعفى لا يدخل الحساب
    for (const c of book.columns) if (marks[c.id] === 'exempt') inputs[c.id] = null;
    let hasOverride = Object.keys(overrides).length > 0;
    let raw = hasOverride ? evaluateRow(book.columns, inputs) : null;
    if (raw) {
      // رفع الدرجة الحرجة قرار على قيمة محددة: إن تغيّرت الدرجة المحسوبة (صُحّح شهر مثلاً) وخرجت من النطاق الحرج
      // يسقط الرفع وتظهر الدرجة الصحيحة — لا تبقى ٥٠ مكان ٦٤
      for (const c of book.columns) {
        if (!(c.id in overrides) || !c.boost) continue;
        const v = raw[c.id];
        if (v == null || v + 1e-9 < c.boost.from || v >= c.boost.to - 1e-9) delete overrides[c.id];
      }
      hasOverride = Object.keys(overrides).length > 0;
    }
    const values = evaluateRow(book.columns, inputs, hasOverride ? overrides : undefined);
    if (!raw || !hasOverride) raw = values;
    const overridden: Record<string, true> = {};
    for (const k of Object.keys(overrides)) overridden[k] = true;
    const critical: Record<string, true> = {};
    for (const c of book.columns) {
      if (!c.boost || overridden[c.id]) continue;
      const v = values[c.id];
      if (v != null && v + 1e-9 >= c.boost.from && v < c.boost.to - 1e-9) critical[c.id] = true;
    }
    const verdict = decider ? verdictFor(values[decider.id], decider.max, book.result) : null;
    return { student: s, values, raw, marks, overridden, critical, verdict, rank: null };
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

/** يرتّب الأعمدة حسب الاعتماد بين السجلات: يُرجع معرّفات السجلات التي يعتمد عليها سجل (مباشرة) */
export function bookDeps(book: Pick<Gradebook, 'columns'>): string[] {
  return [...new Set(book.columns.filter((c) => c.kind === 'link' && c.source).map((c) => c.source!.book_id))];
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

export function columnStats(values: (number | null | undefined)[], max: number, rule: Pick<ResultRule, 'pass'> & { bands?: Band[] }): ColumnStats {
  const vs = values.filter((v): v is number => v != null && Number.isFinite(v));
  const n = vs.length;
  const sorted = [...vs].sort((a, b) => a - b);
  const sum = vs.reduce((s, v) => s + v, 0);
  const avg = n ? sum / n : null;
  const median = n ? (n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2) : null;
  const stdev = n && avg != null ? Math.sqrt(vs.reduce((s, v) => s + (v - avg) ** 2, 0) / n) : null;
  let passCount = 0;
  const bands = [...(rule.bands ?? [])].sort((a, b) => b.min - a.min).map((b) => ({ label: b.label, tone: b.tone, count: 0, min: b.min }));
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
