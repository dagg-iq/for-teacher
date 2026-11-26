import { describe, expect, it } from 'vitest';
import { setDigitStyle } from './format';
setDigitStyle('arab');
import { breaksBetween, DEFAULT_TIMETABLE, formatClock, generatePeriods, inferPlan, normalizeBreaks, inMinutes, isoDay, nextClass, nowState, schoolYear } from './schedule';
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
  it('generates periods with two breaks (first and second recess)', () => {
    const p = generatePeriods({ start: '08:00', count: 6, length: 40, gap: 5, breaks: [{ after: 4, length: 15 }, { after: 2, length: 10 }] });
    expect(p.map((x) => x.start)).toEqual(['08:00', '08:45', '09:35', '10:20', '11:15', '12:00']);
    expect(breaksBetween(p, 5)).toEqual([
      { after: 2, start: '09:25', end: '09:35', length: 10 },
      { after: 4, start: '11:00', end: '11:15', length: 15 },
    ]);
  });
  it('ignores invalid/duplicate breaks', () => {
    expect(normalizeBreaks([{ after: 6, length: 10 }, { after: 0, length: 10 }, { after: 2, length: 10 }, { after: 2, length: 20 }], 6)).toEqual([{ after: 2, length: 10 }]);
  });
  it('infers the plan back from saved periods', () => {
    const periods = generatePeriods({ start: '07:30', count: 7, length: 40, gap: 5, breaks: [{ after: 2, length: 10 }, { after: 5, length: 20 }] });
    expect(inferPlan(periods)).toEqual({ start: '07:30', count: 7, length: 40, gap: 5, breaks: [{ after: 2, length: 10 }, { after: 5, length: 20 }] });
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

import { dayPlan } from './schedule';

describe('widget day plan', () => {
  const cfg = DEFAULT_TIMETABLE; // ٨:٠٠–٨:٤٥، ٨:٥٠–٩:٣٥، ٩:٤٠–١٠:٢٥، (فرصة) ١٠:٤٠…
  const slots = [0, 1, 2, 3, 4, 5].map((p) => ({ day: 0, period: p, title: `ح${p}`, room: null }));
  const sun = (h: number, m: number) => new Date(2026, 9, 18, h, m);
  const input = { days: cfg.days, periods: cfg.periods, slots };
  it('before school: first class is next, not live', () => {
    const r = dayPlan(input, sun(7, 30), 3);
    expect(r.state).toBe('active');
    expect(r.focus).toBe(0);
    expect(r.live).toBe(false);
    expect(r.rows.map((x) => x.period)).toEqual([0, 1, 2]);
    expect(r.remaining).toBe(3);
  });
  it('mid-day keeps one previous class for context, remaining excludes finished', () => {
    const r = dayPlan(input, sun(9, 0), 3); // الحصة الثانية جارية
    expect(r.focus).toBe(1);
    expect(r.live).toBe(true);
    expect(r.rows.map((x) => x.period)).toEqual([0, 1, 2]);
    expect(r.remaining).toBe(3);
    const late = dayPlan(input, sun(11, 0), 3); // الرابعة (١٠:٤٠–١١:٢٥ بعد الفرصة)
    expect(late.focus).toBe(3);
    expect(late.rows.map((x) => x.period)).toEqual([2, 3, 4]);
    expect(late.remaining).toBe(1);
    const last = dayPlan(input, sun(12, 30), 3); // السادسة والأخيرة
    expect(last.rows.map((x) => x.period)).toEqual([4, 5]);
    expect(last.remaining).toBe(0);
  });
  it('small widget shows the focused class only', () => {
    const r = dayPlan(input, sun(9, 0), 1);
    expect(r.rows.map((x) => x.period)).toEqual([1]);
    expect(r.remaining).toBe(4);
  });
  it('done, empty, off', () => {
    expect(dayPlan(input, sun(15, 0), 3).state).toBe('done');
    expect(dayPlan({ ...input, slots: [] }, sun(9, 0), 3).state).toBe('empty');
    expect(dayPlan(input, new Date(2026, 9, 23, 9, 0), 3).state).toBe('off');
  });
});
