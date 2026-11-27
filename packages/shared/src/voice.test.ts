import { describe, expect, it } from 'vitest';
import { chooseHeard, cleanTranscript, isAmbiguous, isConfident, matchStudents, normalizeArabic, numberToArabicWords, parseCommand, parseSpokenNumber } from './voice';
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
  it('a student named like a command word (عدي) is a name, not «skip»', () => {
    const withUday = [...CLASS, st('9', 'عدي فاضل كريم')];
    expect(parseCommand('عدي', withUday).type).toBe('select');
    const c = parseCommand('عدي غايب', withUday);
    expect(c.type === 'mark' && c.candidates[0].student.id === '9').toBe(true);
    expect(parseCommand('عدي', CLASS).type).toBe('skip');
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

describe('teens in Iraqi dialect', () => {
  it('reads 16 and 18 in many spellings', () => {
    for (const t of ['ثمنطعش', 'ثمنتعش', 'ثمن طعش', 'تمنطعش', 'ثمانية عشر', 'ثمانطعش', '18']) expect(parseSpokenNumber(t)).toBe(18);
    for (const t of ['ستطعش', 'سطعش', 'ست طعش', 'ستة عشر', '16', 'ستاشر']) expect(parseSpokenNumber(t)).toBe(16);
    for (const t of ['تمنتاشر', 'ثمنطاش', 'تمن تاشر']) expect(parseSpokenNumber(t)).toBe(18);
    expect(parseSpokenNumber('خمستاشر')).toBe(15);
    expect(parseSpokenNumber('حداشر')).toBe(11);
  });
});

describe('choosing among recognizer alternatives', () => {
  it('prefers a known name with a valid grade and offers the other numbers', () => {
    const h = chooseHeard(['مصطفى ستطعش', 'مصطفى ثمنطعش'], CLASS, { max: 20 });
    expect(h?.cmd.type).toBe('grade');
    expect(h && h.cmd.type === 'grade' ? h.cmd.value : null).toBe(16);
    expect(h?.altValues).toEqual([18]);
  });
  it('skips an alternative whose grade exceeds the maximum', () => {
    const h = chooseHeard(['مصطفى ثمانين', 'مصطفى ثمنطعش'], CLASS, { max: 20 });
    expect(h && h.cmd.type === 'grade' ? h.cmd.value : null).toBe(18);
  });
  it('prefers an alternative that names a student', () => {
    const h = chooseHeard(['كرار خمسين', 'زينب خمسين'], CLASS, { max: 100 });
    expect(h?.text).toBe('زينب خمسين');
  });

  describe('audit fixes', () => {
    const ss = ['أحمد علي حسين', 'حسين كاظم', 'زينب محمد', 'علي حسن', 'مصطفى كريم'].map((name, i) => ({ id: `s${i}`, section_id: 'x', name, sort: i, created_at: '', updated_at: '' }));
    it('«معفى» alone is exempt, not absent', () => {
      expect(parseCommand('معفى', ss)).toEqual({ type: 'exempt' });
      expect(parseCommand('غايب', ss)).toEqual({ type: 'absent' });
    });
    it('negated absence is not absence', () => {
      const c = parseCommand('أحمد سبعين مو غايب', ss);
      expect(c.type).toBe('grade');
    });
    it('decimal comma between digits', () => {
      expect(parseSpokenNumber('80,5')).toBe(80.5);
      expect(parseSpokenNumber('٨٠،٥')).toBe(80.5);
    });
    it('formal feminine teens', () => {
      expect(parseSpokenNumber('إحدى عشرة')).toBe(11);
      expect(parseSpokenNumber('اثنتا عشرة')).toBe(12);
      expect(parseSpokenNumber('ثمن وخمسين')).toBe(58);
    });
    it('student by list number', () => {
      const c = parseCommand('رقم 5 تسعين', ss);
      expect(c).toMatchObject({ type: 'grade', value: 90 });
      expect(c.type === 'grade' && c.candidates[0].student.name).toBe('مصطفى كريم');
      const d = parseCommand('رقم خمسة تسعين', ss);
      expect(d).toMatchObject({ type: 'grade', value: 90 });
      expect(d.type === 'grade' && d.candidates[0].student.name).toBe('مصطفى كريم');
      expect(parseCommand('رقم اثنين غايب', ss)).toMatchObject({ type: 'mark', mark: 'absent' });
      expect(parseCommand('رقم 40 تسعين', ss).type).toBe('unknown');
    });
  });
  describe('cleanTranscript (whisper)', () => {
    it('keeps Arabic text and digits', () => {
      expect(cleanTranscript(' خمسة وسبعين.')).toBe('خمسة وسبعين');
      expect(cleanTranscript('أحمد علي، 85!')).toBe('أحمد علي 85');
      expect(cleanTranscript('80,5')).toBe('80.5');
    });
    it('drops silence hallucinations and runaway repetition', () => {
      expect(cleanTranscript(' ... ')).toBe('');
      expect(cleanTranscript('ترجمة نانسي قنقر')).toBe('');
      expect(cleanTranscript('اشتركوا في القناة')).toBe('');
      expect(cleanTranscript('وكي ' + 'كي'.repeat(40))).toBe('');
      expect(cleanTranscript('وكي يجب أن يجب أن يجب أن يجب أن')).toBe('');
      expect(cleanTranscript('خمسة وخمسين')).toBe('خمسة وخمسين');
    });
  });
});

describe('dialect numbers heard by speech engines', () => {
  it('ثانية ← ٨ (محرك سمع ثمانية)، خمسي ← ٥٠', () => {
    expect(parseSpokenNumber('ثانية')).toBe(8);
    expect(parseSpokenNumber('خمسي')).toBe(50);
    expect(parseSpokenNumber('خمسة وسبعي')).toBe(75);
    expect(parseSpokenNumber('ثانية وتسعي')).toBe(98);
  });
});
