import { describe, expect, it } from 'vitest';
import { detectLayout, matchSheet } from './sheet-import';
import type { Student } from './types';

const now = new Date().toISOString();
const st = (id: string, name: string): Student => ({ id, name, section_id: 's', sort: 0, created_at: now, updated_at: now });

describe('excel grade import', () => {
  const rows = [
    ['إعدادية الرافدين', null, null, null],
    ['ت', 'الاسم', 'الشهر الأول', 'الشهر الثاني'],
    [1, 'أحمد علي حسين', 80, '٧٥'],
    [2, 'علي حسن كاظم', 45, null],
    [3, 'مصطفي كريم ناصر', 90, 88],
    [4, 'طالب غير موجود هنا', 50, 50],
  ];
  const students = [st('1', 'أحمد علي حسين'), st('2', 'علي حسن كاظم'), st('3', 'مصطفى كريم ناصر')];
  it('detects layout', () => {
    const l = detectLayout(rows)!;
    expect(l.nameCol).toBe(1);
    expect(l.headerRow).toBe(1);
    expect(l.numeric.map((n) => n.title)).toEqual(['الشهر الأول', 'الشهر الثاني']);
  });
  it('ignores short serial columns', () => {
    const l = detectLayout([['ت', 'الاسم', 'الدرجة'], [1, 'أحمد علي', 50], [2, 'علي حسن', 60]])!;
    expect(l.numeric.map((n) => n.title)).toEqual(['الدرجة']);
  });
  it('matches names', () => {
    const m = matchSheet(rows, detectLayout(rows)!, students);
    expect(m).toHaveLength(4);
    expect(m[0].student?.id).toBe('1');
    expect(m[0].values[3]).toBe(75);
    expect(m[2].student?.id).toBe('3');
    expect(m[3].student).toBeNull();
    expect(m[1].values[3]).toBeNull();
  });
});
