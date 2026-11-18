import { describe, expect, it } from 'vitest';
import {
  computeOrder, displayToFormula, evaluate, evaluateRow, formulaToDisplay, quickFormula, refsOf, roundHalfUp, validateFormula,
} from './formula';
import type { GradeColumn } from './types';

const get = (m: Record<string, number | null>) => (id: string) => m[id] ?? null;

describe('formula engine', () => {
  it('arithmetic and precedence', () => {
    expect(evaluate('1 + 2 * 3', get({}))).toBe(7);
    expect(evaluate('(1 + 2) * 3', get({}))).toBe(9);
    expect(evaluate('2 ^ 3 ^ 2', get({}))).toBe(512);
    expect(evaluate('-3 + 5', get({}))).toBe(2);
    expect(evaluate('١٠ × ٥ ÷ ٢', get({}))).toBe(25);
    expect(evaluate('٢٫٥ * 2', get({}))).toBe(5);
  });
  it('refs and functions (arabic + english names)', () => {
    const v = get({ a: 80, b: 90, c: null });
    expect(evaluate('معدل({a}، {b})', v)).toBe(85);
    expect(evaluate('avg({a}, {b}, {c})', v)).toBe(85);
    expect(evaluate('مجموع({a}، {b})', v)).toBe(170);
    expect(evaluate('أعلى({a}، {b})', v)).toBe(90);
    expect(evaluate('ادنى({a}، {b})', v)).toBe(80);
    expect(evaluate('{a} + {c}', v)).toBeNull();
    expect(evaluate('معدل({c})', v)).toBeNull();
    expect(evaluate('اذا({a} >= 50، 1، 0)', v)).toBe(1);
    expect(evaluate('if({a} < 50, 1, 0)', v)).toBe(0);
    expect(evaluate('تقريب(49.5)', v)).toBe(50);
    expect(evaluate('تقريب(49.49)', v)).toBe(49);
    expect(evaluate('2{a}', v)).toBe(160);
    expect(evaluate('{a} / 0', v)).toBeNull();
  });
  it('rejects bad formulas in arabic', () => {
    expect(() => evaluate('1 +', get({}))).toThrow(/ناقصة/);
    expect(() => evaluate('(1 + 2', get({}))).toThrow(/غير مغلق/);
    expect(() => evaluate('foo(1)', get({}))).toThrow(/غير معروفة/);
    expect(() => evaluate('1 $ 2', get({}))).toThrow(/غير مفهوم/);
    expect(() => evaluate('اذا(1، 2)', get({}))).toThrow(/ثلاثة/);
  });
  it('round half up', () => {
    expect(roundHalfUp(2.5)).toBe(3);
    expect(roundHalfUp(66.665, 2)).toBe(66.67);
    expect(roundHalfUp(1.005, 2)).toBe(1.01);
  });
  it('refs, order, cycles', () => {
    expect(refsOf('معدل({x}، {y}) + {x}').sort()).toEqual(['x', 'y']);
    const cols: GradeColumn[] = [
      { id: 'a', name: 'أ', kind: 'input', max: 100 },
      { id: 'c', name: 'ج', kind: 'formula', max: 100, formula: '{b} * 2' },
      { id: 'b', name: 'ب', kind: 'formula', max: 100, formula: '{a} + 1' },
    ];
    expect(computeOrder(cols)).toEqual(['b', 'c']);
    const cyc: GradeColumn[] = [
      { id: 'x', name: 'س', kind: 'formula', max: 100, formula: '{y}' },
      { id: 'y', name: 'ص', kind: 'formula', max: 100, formula: '{x}' },
    ];
    expect(() => computeOrder(cyc)).toThrow(/تدور/);
    expect(evaluateRow(cols, { a: 10 })).toEqual({ a: 10, b: 11, c: 22 });
    // معادلة خاطئة لا تكسر الصف
    expect(evaluateRow(cyc, {})).toEqual({ x: null, y: null });
  });
  it('rounding modes', () => {
    const cols: GradeColumn[] = [
      { id: 'a', name: 'أ', kind: 'input', max: 100 },
      { id: 'b', name: 'ب', kind: 'input', max: 100 },
      { id: 'i', name: 'صحيح', kind: 'formula', max: 100, formula: 'معدل({a}، {b})', round: 'int' },
      { id: 'd', name: 'عشري', kind: 'formula', max: 100, formula: '({a} + {b} + 0.1) / 3', round: '1dp' },
    ];
    const r = evaluateRow(cols, { a: 49, b: 50 });
    expect(r.i).toBe(50);
    expect(r.d).toBe(33);
  });
  it('validate + display conversion', () => {
    const cols: GradeColumn[] = [
      { id: 'a', name: 'الشهر الأول', kind: 'input', max: 100 },
      { id: 'b', name: 'الشهر الثاني', kind: 'input', max: 100 },
      { id: 'z', name: 'المعدل', kind: 'formula', max: 100, formula: 'معدل({a}، {b})' },
    ];
    expect(validateFormula('معدل({a}، {b})', cols, 'z')).toBeNull();
    expect(validateFormula('{q} + 1', cols, 'z')).toMatch(/غير موجود/);
    expect(validateFormula('{z} + 1', cols, 'z')).toMatch(/نفسه/);
    expect(validateFormula('معدل({a}', cols, 'z')).toMatch(/غير مغلق/);
    const shown = formulaToDisplay('معدل({a}، {b})', cols);
    expect(shown).toBe('معدل([الشهر الأول]، [الشهر الثاني])');
    expect(displayToFormula(shown, cols)).toBe('معدل({a}، {b})');
    expect(() => displayToFormula('[غير موجود] + 1', cols)).toThrow(/لا يوجد عمود/);
  });
  it('quick formulas', () => {
    const v = get({ a: 60, b: 80, c: 100 });
    expect(evaluate(quickFormula.avg(['a', 'b']), v)).toBe(70);
    expect(evaluate(quickFormula.sum(['a', 'b']), v)).toBe(140);
    expect(evaluate(quickFormula.weighted([{ id: 'a', weight: 25 }, { id: 'b', weight: 25 }, { id: 'c', weight: 50 }]), v)).toBe(85);
    expect(evaluate(quickFormula.scale('a', 10, 100), get({ a: 7 }))).toBe(70);
  });
});
