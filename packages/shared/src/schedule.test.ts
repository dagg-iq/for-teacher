import { describe, expect, it } from 'vitest';
import { DEFAULT_TIMETABLE, formatClock, generatePeriods, inMinutes, isoDay, nextClass, nowState, schoolYear } from './schedule';
import type { Slot } from './types';

const now = new Date().toISOString();
const slot = (day: number, period: number, section = 'sec'): Slot => ({ id: `${day}-${period}`, day, period, section_id: section, created_at: now, updated_at: now });

describe('timetable', () => {
  it('generates periods with big break', () => {
    const p = generatePeriods({ start: '08:00', count: 4, length: 45, gap: 5, breakAfter: 2, breakLength: 20 });
    expect(p).toEqual([
      { start: '08:00', end: '08:45' },
      { start: '08:50', end: '09:35' },
      { start: '09:55', end: '10:40' },
      { start: '10:45', end: '11:30' },
    ]);
  });
  it('now state', () => {
    const cfg = DEFAULT_TIMETABLE;
    const slots = [slot(0, 0), slot(0, 2)];
    // الأحد ١٨ تشرين الأول ٢٠٢٦
    const sun = (h: number, m: number) => new Date(2026, 9, 18, h, m);
    expect(sun(7, 30).getDay()).toBe(0);
    expect(nowState(cfg, slots, sun(7, 30))).toMatchObject({ kind: 'before', period: 0, startsIn: 30 });
    expect(nowState(cfg, slots, sun(8, 10))).toMatchObject({ kind: 'in', period: 0, endsIn: 35 });
    expect(nowState(cfg, slots, sun(8, 47))).toMatchObject({ kind: 'between', period: 1 });
    expect(nowState(cfg, slots, sun(14, 0))).toEqual({ kind: 'done' });
    expect(nowState(cfg, slots, new Date(2026, 9, 23, 9, 0))).toEqual({ kind: 'off' }); // جمعة
  });
  it('next class rolls to next working day', () => {
    const slots = [slot(0, 2), slot(1, 0)];
    const n1 = nextClass(DEFAULT_TIMETABLE, slots, new Date(2026, 9, 18, 8, 0));
    expect(n1?.slot.id).toBe('0-2');
    expect(n1?.dayOffset).toBe(0);
    const n2 = nextClass(DEFAULT_TIMETABLE, slots, new Date(2026, 9, 18, 12, 0));
    expect(n2?.slot.id).toBe('1-0');
    expect(n2?.dayOffset).toBe(1);
    const thu = nextClass(DEFAULT_TIMETABLE, slots, new Date(2026, 9, 22, 12, 0));
    expect(thu?.slot.id).toBe('0-2');
    expect(thu?.dayOffset).toBe(3);
    expect(nextClass(DEFAULT_TIMETABLE, [], new Date())).toBeNull();
  });
  it('formats', () => {
    expect(formatClock('13:05')).toBe('١:٠٥');
    expect(formatClock('08:00', true)).toBe('٨:٠٠ ص');
    expect(inMinutes(5)).toBe('بعد ٥ دقائق');
    expect(inMinutes(70)).toBe('بعد ساعة و١٠ دقائق');
    expect(inMinutes(2)).toBe('بعد دقيقتين');
    expect(isoDay(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(schoolYear(new Date(2026, 10, 1))).toBe('2026-2027');
    expect(schoolYear(new Date(2027, 2, 1))).toBe('2026-2027');
  });
});
