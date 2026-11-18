import { describe, expect, it } from 'vitest';
import { isAmbiguous, isConfident, matchStudents, normalizeArabic, numberToArabicWords, parseCommand, parseSpokenNumber } from './voice';
import type { Student } from './types';

const now = new Date().toISOString();
const st = (id: string, name: string, number?: number): Student => ({ id, name, number, section_id: 's', sort: 0, created_at: now, updated_at: now });
const CLASS = [
  st('1', 'أحمد علي حسين'),
  st('2', 'علي حسن كاظم'),
  st('3', 'محمد جاسم عبد الله'),
  st('4', 'حسين عباس فاضل'),
  st('5', 'مصطفى كريم ناصر'),
  st('6', 'أحمد عادل مهدي'),
  st('7', 'زينب قاسم محمد'),
  st('8', 'عبد الرحمن سعد'),
];

describe('normalize', () => {
  it('unifies letters', () => {
    expect(normalizeArabic('أَحْمَد')).toBe('احمد');
    expect(normalizeArabic('مصطفى')).toBe('مصطفي');
    expect(normalizeArabic('فاطمة')).toBe('فاطمه');
    expect(normalizeArabic('٨٥')).toBe('85');
  });
});

describe('spoken numbers', () => {
  const cases: [string, number][] = [
    ['خمسة وسبعين', 75],
    ['خمسه و سبعين', 75],
    ['تسعين', 90],
    ['مية', 100],
    ['مئة', 100],
    ['ميه', 100],
    ['سبعطعش', 17],
    ['ثلاثة عشر', 13],
    ['اثنا عشر', 12],
    ['ثنعش', 12],
    ['تسعين ونص', 90.5],
    ['خمسة وثمانين ونص', 85.5],
    ['85', 85],
    ['٨٥', 85],
    ['85.5', 85.5],
    ['صفر', 0],
    ['ثمنطعش', 18],
    ['واحد وخمسين', 51],
    ['ستين', 60],
    ['ثلاث', 3],
    ['عشرة', 10],
    ['سبعة', 7],
  ];
  for (const [text, n] of cases) it(`${text} = ${n}`, () => expect(parseSpokenNumber(text)).toBe(n));
  it('no number', () => expect(parseSpokenNumber('احمد علي')).toBeNull());
});

describe('name matching', () => {
  it('first + father name', () => {
    const c = matchStudents('احمد علي', CLASS);
    expect(c[0].student.id).toBe('1');
    expect(isConfident(c)).toBe(true);
  });
  it('first name only — ambiguous between two Ahmads', () => {
    const c = matchStudents('احمد', CLASS);
    expect(c.slice(0, 2).map((x) => x.student.id).sort()).toEqual(['1', '6']);
    expect(isAmbiguous(c)).toBe(true);
    expect(isConfident(c)).toBe(false);
  });
  it('unique first name is confident', () => {
    const c = matchStudents('مصطفى', CLASS);
    expect(c[0].student.id).toBe('5');
    expect(isConfident(c)).toBe(true);
  });
  it('tolerates recognition errors', () => {
    expect(matchStudents('حسين عباص', CLASS)[0].student.id).toBe('4');
    expect(matchStudents('زينب قاصم', CLASS)[0].student.id).toBe('7');
    expect(matchStudents('محمد جاسم', CLASS)[0].student.id).toBe('3');
  });
  it('compound names (عبد الرحمن)', () => {
    expect(matchStudents('عبد الرحمن', CLASS)[0].student.id).toBe('8');
    expect(matchStudents('عبدالرحمن سعد', CLASS)[0].student.id).toBe('8');
  });
  it('no match', () => {
    expect(matchStudents('كمبيوتر', CLASS)).toHaveLength(0);
  });
});

describe('commands', () => {
  it('name + grade', () => {
    const c = parseCommand('احمد علي خمسة وسبعين', CLASS);
    expect(c.type).toBe('grade');
    if (c.type === 'grade') {
      expect(c.value).toBe(75);
      expect(c.candidates[0].student.id).toBe('1');
    }
  });
  it('name + digits grade', () => {
    const c = parseCommand('مصطفى كريم 88', CLASS);
    expect(c.type === 'grade' && c.value === 88 && c.candidates[0].student.id === '5').toBe(true);
  });
  it('with filler words', () => {
    const c = parseCommand('الطالب حسين عباس درجته تسعين', CLASS);
    expect(c.type === 'grade' && c.value === 90 && c.candidates[0].student.id === '4').toBe(true);
  });
  it('absent', () => {
    const c = parseCommand('زينب قاسم غايبة', CLASS);
    expect(c.type).toBe('mark');
    if (c.type === 'mark') {
      expect(c.mark).toBe('absent');
      expect(c.candidates[0].student.id).toBe('7');
    }
    expect(parseCommand('غائب', CLASS).type).toBe('absent');
  });
  it('number only (ordered mode)', () => {
    expect(parseCommand('تسعين', CLASS, { ordered: true })).toEqual({ type: 'value', value: 90 });
    expect(parseCommand('85', CLASS)).toEqual({ type: 'value', value: 85 });
  });
  it('control words', () => {
    expect(parseCommand('تراجع', CLASS).type).toBe('undo');
    expect(parseCommand('التالي', CLASS).type).toBe('next');
    expect(parseCommand('توقف', CLASS).type).toBe('stop');
    expect(parseCommand('نعم', CLASS).type).toBe('confirm');
    expect(parseCommand('لا', CLASS).type).toBe('cancel');
    expect(parseCommand('السابق', CLASS).type).toBe('previous');
  });
  it('select only', () => {
    const c = parseCommand('علي حسن', CLASS);
    expect(c.type === 'select' && c.candidates[0].student.id === '2').toBe(true);
  });
  it('unknown', () => {
    expect(parseCommand('شنو الوكت', CLASS).type).toBe('unknown');
  });
});

describe('number words', () => {
  it('reads back grades', () => {
    expect(numberToArabicWords(75)).toBe('خمسة وسبعون');
    expect(numberToArabicWords(100)).toBe('مئة');
    expect(numberToArabicWords(90.5)).toBe('تسعون ونصف');
    expect(numberToArabicWords(13)).toBe('ثلاثة عشر');
  });
});
