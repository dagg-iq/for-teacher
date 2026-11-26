import { describe, expect, it } from 'vitest';
import {
  buildSheet, buildYearSet, cloneBookSet, cloneColumns, columnStats, COMPONENT_PRESETS, gradeId, monthBook, TEMPLATES, verdictFor,
  type BookSpec, type SheetRow,
} from './grading';
import type { Grade, Student } from './types';

const now = new Date().toISOString();
const st = (id: string, name: string): Student => ({ id, name, section_id: 's', sort: 0, created_at: now, updated_at: now });
const g = (book: string, s: string, c: string, v: number | null, mark?: Grade['mark']): Grade => ({
  id: gradeId(book, s, c), gradebook_id: book, student_id: s, column_id: c, value: v, mark, created_at: now, updated_at: now,
});

/** يحسب سجلات السنة كلها بالترتيب، ويمرّر قيم السجلات المصدر للأعمدة المرتبطة */
function computeSet(specs: BookSpec[], students: Student[], grades: Grade[]) {
  const sheets = new Map<string, SheetRow[]>();
  const byId = new Map(specs.map((s) => [s.id, s]));
  const sheet = (id: string): SheetRow[] => {
    if (sheets.has(id)) return sheets.get(id)!;
    const b = byId.get(id)!;
    const rows = buildSheet(b, students, grades, (col) => {
      const src = col.source!;
      const srcRows = sheet(src.book_id);
      return new Map(srcRows.map((r) => [r.student.id, r.values[src.column_id]]));
    });
    sheets.set(id, rows);
    return rows;
  };
  for (const s of specs) sheet(s.id);
  return sheets;
}

describe('verdicts', () => {
  it('pass / fail only (no grade labels)', () => {
    const rule = { pass: 50 };
    expect(verdictFor(95, 100, rule)?.label).toBe('ناجح');
    expect(verdictFor(50, 100, rule)?.pass).toBe(true);
    expect(verdictFor(49.9, 100, rule)?.label).toBe('راسب');
    expect(verdictFor(5, 10, rule)?.pass).toBe(true);
    expect(verdictFor(null, 100, rule)).toBeNull();
  });
});

describe('monthly exam with components', () => {
  it('english: written 60 + essay 10 + oral 30 = total 100', () => {
    const b = monthBook(COMPONENT_PRESETS[0].items);
    const [w, e, o, total] = b.columns;
    expect(total.max).toBe(100);
    const rows = buildSheet({ id: 'b', ...b }, [st('a', 'أ')], [g('b', 'a', w.id, 45), g('b', 'a', e.id, 7), g('b', 'a', o.id, 25.5)]);
    expect(rows[0].values[total.id]).toBe(77.5);
    expect(rows[0].verdict?.pass).toBe(true);
    expect(b.result.column_id).toBe(total.id);
  });
});

describe('year set (linked books)', () => {
  const specs = buildYearSet({ components: COMPONENT_PRESETS[0].items });
  const by = (title: string) => specs.find((s) => s.title === title)!;
  const comps = (title: string) => by(title).columns.filter((c) => c.kind === 'input');
  const students = [st('x', 'أحمد'), st('y', 'علي')];
  // كل امتحان: التحريري + الإنشاء + الشفهي
  const exam = (title: string, s: string, vals: [number, number, number]) => comps(title).map((c, i) => g(by(title).id, s, c.id, vals[i]));

  it('creates the iraqi year: 4 months, two terms, mid-year, annual', () => {
    expect(specs.map((s) => s.title)).toEqual([
      'الشهر الأول — الفصل الأول', 'الشهر الثاني — الفصل الأول', 'سعي الفصل الأول', 'نصف السنة',
      'الشهر الأول — الفصل الثاني', 'الشهر الثاني — الفصل الثاني', 'سعي الفصل الثاني', 'السعي السنوي',
    ]);
    expect(specs.map((s) => s.ord)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('term = (month1 + month2) / 2 and annual = (t1 + mid + t2) / 3, through the links', () => {
    const mid = by('نصف السنة');
    const grades = [
      ...exam('الشهر الأول — الفصل الأول', 'x', [50, 8, 22]), // 80
      ...exam('الشهر الثاني — الفصل الأول', 'x', [40, 7, 24]), // 71 → term 75.5 → 76
      g(mid.id, 'x', mid.columns[0].id, 60),
      ...exam('الشهر الأول — الفصل الثاني', 'x', [55, 9, 26]), // 90
      ...exam('الشهر الثاني — الفصل الثاني', 'x', [50, 9, 22]), // 81 → 85.5 → 86
    ];
    const sheets = computeSet(specs, students, grades);
    const t1 = by('سعي الفصل الأول');
    const annual = by('السعي السنوي');
    expect(sheets.get(t1.id)![0].values[t1.result.column_id!]).toBe(76);
    expect(sheets.get(annual.id)![0].values[annual.result.column_id!]).toBe(74); // (76+60+86)/3 = 74
    expect(sheets.get(annual.id)![1].values[annual.result.column_id!]).toBeNull();
  });

  it('flags critical totals (47–49) and lets the teacher raise them to 50', () => {
    const t1 = by('سعي الفصل الأول');
    const total = t1.columns.find((c) => c.id === t1.result.column_id)!;
    expect(total.boost).toEqual({ from: 47, to: 50 });
    const grades = [
      ...exam('الشهر الأول — الفصل الأول', 'x', [30, 5, 13]), // 48
      ...exam('الشهر الثاني — الفصل الأول', 'x', [30, 5, 12]), // 47 → 47.5 → 48
      ...exam('الشهر الأول — الفصل الأول', 'y', [20, 5, 10]), // 35
      ...exam('الشهر الثاني — الفصل الأول', 'y', [20, 5, 10]), // 35
    ];
    let row = computeSet(specs, students, grades).get(t1.id)![0];
    expect(row.values[total.id]).toBe(48);
    expect(row.critical[total.id]).toBe(true);
    expect(row.verdict?.pass).toBe(false);
    expect(computeSet(specs, students, grades).get(t1.id)![1].critical[total.id]).toBeUndefined();
    // بعد موافقة المدرس: تعديل يدوي على العمود المحسوب
    row = computeSet(specs, students, [...grades, g(t1.id, 'x', total.id, 50)]).get(t1.id)![0];
    expect(row.values[total.id]).toBe(50);
    expect(row.raw[total.id]).toBe(48);
    expect(row.overridden[total.id]).toBe(true);
    expect(row.critical[total.id]).toBeUndefined();
    expect(row.verdict?.pass).toBe(true);
  });

  it('a raise is dropped when the months are corrected out of the critical range', () => {
    const t1 = by('سعي الفصل الأول');
    const total = t1.columns.find((c) => c.id === t1.result.column_id)!;
    const raised = g(t1.id, 'x', total.id, 50);
    // صُحّح الشهر الأول من ٤٨ إلى ٨٠: السعي الصحيح ٦٤ لا ٥٠
    const fixed = [
      ...exam('الشهر الأول — الفصل الأول', 'x', [60, 8, 12]), // 80
      ...exam('الشهر الثاني — الفصل الأول', 'x', [30, 5, 12]), // 47 → (80+47)/2 = 63.5 → 64
      raised,
    ];
    const row = computeSet(specs, students, fixed).get(t1.id)![0];
    expect(row.values[total.id]).toBe(64);
    expect(row.overridden[total.id]).toBeUndefined();
    expect(row.verdict?.pass).toBe(true);
    // وإن هبط تحت النطاق (٣٥) يظهر راسباً بدرجته الحقيقية لا ٥٠
    const low = [...exam('الشهر الأول — الفصل الأول', 'x', [20, 5, 10]), ...exam('الشهر الثاني — الفصل الأول', 'x', [20, 5, 10]), raised];
    const r2 = computeSet(specs, students, low).get(t1.id)![0];
    expect(r2.values[total.id]).toBe(35);
    expect(r2.verdict?.pass).toBe(false);
  });

  it('absent counts as zero; links survive cloning the set for another section', () => {
    const clone = cloneBookSet(specs);
    const ids = new Set(clone.map((s) => s.id));
    for (const b of clone) {
      expect(specs.some((s) => s.id === b.id)).toBe(false);
      for (const c of b.columns) if (c.kind === 'link') {
        expect(ids.has(c.source!.book_id)).toBe(true);
        const src = clone.find((s) => s.id === c.source!.book_id)!;
        expect(src.columns.some((x) => x.id === c.source!.column_id)).toBe(true);
      }
    }
    const mid = specs.find((s) => s.role === 'mid')!;
    const rows = buildSheet(mid, students, [g(mid.id, 'y', mid.columns[0].id, null, 'absent')]);
    expect(rows[1].values[mid.columns[0].id]).toBe(0);
  });

  it('optional final exam: (annual + final) / 2', () => {
    const set = buildYearSet({ components: [{ name: 'الدرجة', max: 100 }], withFinal: true });
    expect(set[set.length - 1].title).toBe('النتيجة النهائية');
    expect(set[set.length - 1].columns.map((c) => c.kind)).toEqual(['link', 'input', 'formula']);
  });
});

describe('templates', () => {
  it('every template builds valid columns', () => {
    for (const t of TEMPLATES) {
      const b = t.build();
      expect(b.columns.length).toBeGreaterThan(0);
      expect(b.columns.some((c) => c.id === b.result.column_id)).toBe(true);
      expect(buildSheet({ id: 'b', ...b }, [st('a', 'أ')], [])).toHaveLength(1);
    }
  });
  it('clone keeps formulas pointing to new ids', () => {
    const tpl = TEMPLATES[0].build();
    const c = cloneColumns(tpl.columns, tpl.result);
    const newIds = new Set(c.columns.map((x) => x.id));
    for (const col of c.columns) {
      expect(tpl.columns.some((o) => o.id === col.id)).toBe(false);
      for (const m of (col.formula ?? '').matchAll(/\{([^}]+)\}/g)) expect(newIds.has(m[1])).toBe(true);
    }
    expect(newIds.has(c.result.column_id!)).toBe(true);
  });
});

describe('stats', () => {
  it('computes summary', () => {
    const s = columnStats([90, 40, 60, null, 50], 100, { pass: 50 });
    expect(s.count).toBe(4);
    expect(s.total).toBe(5);
    expect(s.avg).toBe(60);
    expect(s.max).toBe(90);
    expect(s.min).toBe(40);
    expect(s.median).toBe(55);
    expect(s.passCount).toBe(3);
    expect(s.passRate).toBe(75);
  });
  it('empty', () => {
    const s = columnStats([], 100, { pass: 50 });
    expect(s.avg).toBeNull();
    expect(s.passRate).toBeNull();
  });
});
