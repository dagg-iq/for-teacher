import { describe, expect, it } from 'vitest';
import { countStudents, iraqiPhone, parseNameList, toCsv } from './text';
import { chunk, mergeRemote, purgeable } from './sync';

describe('name lists', () => {
  it('strips numbering and duplicates', () => {
    const raw = `١- أحمد علي حسين\n2. علي حسن\n(3) حسين  عباس\n\n- زينب قاسم\nأحمد علي حسين\n15\n• مريم`;
    expect(parseNameList(raw)).toEqual(['أحمد علي حسين', 'علي حسن', 'حسين عباس', 'زينب قاسم', 'مريم']);
  });
  it('comma separated single line', () => {
    expect(parseNameList('أحمد، علي، حسن')).toEqual(['أحمد', 'علي', 'حسن']);
  });
  it('excel paste with tabs', () => {
    expect(parseNameList('1\tأحمد علي\n2\tعلي حسن')).toEqual([]);
    expect(parseNameList('أحمد علي\t90\nعلي حسن\t80')).toEqual(['أحمد علي', 'علي حسن']);
  });
});

describe('arabic counting', () => {
  it('counts students', () => {
    expect(countStudents(0)).toBe('لا طلاب');
    expect(countStudents(1)).toBe('طالب واحد');
    expect(countStudents(2)).toBe('طالبان');
    expect(countStudents(5)).toBe('٥ طلاب');
    expect(countStudents(25)).toBe('٢٥ طالباً');
    expect(countStudents(103)).toBe('١٠٣ طلاب');
  });
});

describe('phones & csv', () => {
  it('iraqi phone', () => {
    expect(iraqiPhone('07701234567')).toBe('9647701234567');
    expect(iraqiPhone('٠٧٧٠ ١٢٣ ٤٥٦٧')).toBe('9647701234567');
    expect(iraqiPhone('+964 770 123 4567')).toBe('9647701234567');
    expect(iraqiPhone('123')).toBeNull();
  });
  it('csv escapes', () => {
    expect(toCsv([['a', 'b,c'], ['"x"', null]])).toBe('﻿a,"b,c"\r\n"""x""",');
  });
});

describe('sync', () => {
  const r = (id: string, t: string, v = 0) => ({ id, created_at: t, updated_at: t, v });
  it('last write wins', () => {
    const local = new Map([['a', r('a', '2026-01-02T00:00:00Z', 1)], ['b', r('b', '2026-01-01T00:00:00Z', 1)]]);
    const { rows, changed } = mergeRemote(local, [r('a', '2026-01-01T00:00:00Z', 2), r('b', '2026-01-03T00:00:00Z', 2), r('c', '2026-01-01T00:00:00Z', 2)]);
    expect(rows.get('a')!.v).toBe(1);
    expect(rows.get('b')!.v).toBe(2);
    expect(rows.get('c')!.v).toBe(2);
    expect(changed).toBe(2);
  });
  it('chunks and purge', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    const old = { ...r('x', '2020-01-01T00:00:00Z'), deleted: true };
    const fresh = { ...r('y', new Date().toISOString()), deleted: true };
    expect(purgeable([old, fresh], new Set(), 30)).toEqual(['x']);
    expect(purgeable([old], new Set(['x']), 30)).toEqual([]);
  });
});
