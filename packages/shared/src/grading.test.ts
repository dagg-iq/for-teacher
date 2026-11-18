import { describe, expect, it } from 'vitest';
import { buildSheet, cloneColumns, columnStats, gradeId, IRAQI_BANDS, TEMPLATES, verdictFor } from './grading';
import type { Grade, Student } from './types';

const now = new Date().toISOString();
const st = (id: string, name: string): Student => ({ id, name, section_id: 's', sort: 0, created_at: now, updated_at: now });

describe('verdicts', () => {
  const rule = { pass: 50, bands: IRAQI_BANDS };
  it('iraqi bands', () => {
    expect(verdictFor(95, 100, rule)?.label).toBe('امتياز');
    expect(verdictFor(80, 100, rule)?.label).toBe('جيد جداً');
    expect(verdictFor(50, 100, rule)?.label).toBe('مقبول');
    expect(verdictFor(50, 100, rule)?.pass).toBe(true);
    expect(verdictFor(49.9, 100, rule)?.pass).toBe(false);
    expect(verdictFor(5, 10, rule)?.pass).toBe(true);
    expect(verdictFor(null, 100, rule)).toBeNull();
  });
});

describe('templates', () => {
  it('saey template computes annual effort with iraqi rounding', () => {
    const tpl = TEMPLATES.find((t) => t.key === 'saey')!.build();
    const [m1, m2, t1, mid, m3, m4, t2, saey] = tpl.columns;
    const students = [st('x', 'أحمد علي حسين'), st('y', 'علي حسن كاظم'), st('z', 'زيد')];
    const g = (s: string, c: string, v: number | null, mark?: Grade['mark']): Grade => ({
      id: gradeId('b', s, c), gradebook_id: 'b', student_id: s, column_id: c, value: v, mark, created_at: now, updated_at: now,
    });
    const grades = [
      g('x', m1.id, 70), g('x', m2.id, 80), g('x', mid.id, 60), g('x', m3.id, 90), g('x', m4.id, 81),
      g('y', m1.id, 40), g('y', m2.id, 45), g('y', mid.id, null, 'absent'), g('y', m3.id, 50), g('y', m4.id, 55),
    ];
    const rows = buildSheet({ id: 'b', columns: tpl.columns, result: tpl.result }, students, grades);
    const x = rows[0].values;
    expect(x[t1.id]).toBe(75);
    expect(x[t2.id]).toBe(86); // 85.5 ← 86
    expect(x[saey.id]).toBe(74); // (75+60+86)/3 = 73.67 ← 74
    expect(rows[0].verdict?.label).toBe('جيد');
    const y = rows[1].values;
    expect(y[mid.id]).toBe(0); // غائب = صفر
    expect(rows[1].marks[mid.id]).toBe('absent');
    expect(rows[1].verdict?.pass).toBe(false);
    expect(rows[0].rank).toBe(1);
    expect(rows[1].rank).toBe(2);
    expect(rows[2].rank).toBeNull();
    expect(rows[2].verdict).toBeNull();
  });
  it('every template builds valid columns', () => {
    for (const t of TEMPLATES) {
      const b = t.build();
      expect(b.columns.length).toBeGreaterThan(0);
      expect(b.columns.some((c) => c.id === b.result.column_id)).toBe(true);
      const rows = buildSheet({ id: 'b', ...b }, [st('a', 'أ')], []);
      expect(rows).toHaveLength(1);
    }
  });
  it('final exam template', () => {
    const tpl = TEMPLATES.find((t) => t.key === 'saey-final')!.build();
    const ids = Object.fromEntries(tpl.columns.map((c) => [c.name, c.id]));
    const inputs = ['الشهر الأول', 'الشهر الثاني', 'نصف السنة', 'الشهر الأول ف٢', 'الشهر الثاني ف٢'];
    const grades: Grade[] = inputs.map((n) => ({ id: n, gradebook_id: 'b', student_id: 'a', column_id: ids[n], value: 60, created_at: now, updated_at: now }));
    grades.push({ id: 'f', gradebook_id: 'b', student_id: 'a', column_id: ids['الامتحان النهائي'], value: 41, created_at: now, updated_at: now });
    const [row] = buildSheet({ id: 'b', ...tpl }, [st('a', 'أ')], grades);
    expect(row.values[ids['الدرجة النهائية']]).toBe(51); // (60 + 41)/2 = 50.5 ← 51
    expect(row.verdict?.pass).toBe(true);
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
    const s = columnStats([90, 40, 60, null, 50], 100, { pass: 50, bands: IRAQI_BANDS });
    expect(s.count).toBe(4);
    expect(s.total).toBe(5);
    expect(s.avg).toBe(60);
    expect(s.max).toBe(90);
    expect(s.min).toBe(40);
    expect(s.median).toBe(55);
    expect(s.passCount).toBe(3);
    expect(s.passRate).toBe(75);
    expect(s.bands.find((b) => b.label === 'امتياز')?.count).toBe(1);
    expect(s.bands.find((b) => b.label === 'ضعيف')?.count).toBe(1);
  });
  it('empty', () => {
    const s = columnStats([], 100, { pass: 50, bands: IRAQI_BANDS });
    expect(s.avg).toBeNull();
    expect(s.passRate).toBeNull();
  });
});
