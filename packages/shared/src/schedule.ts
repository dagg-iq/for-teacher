/** جدول الحصص: توليد أوقات الحصص، الحصة الحالية والقادمة، وأيام الدوام العراقية */
import { arDigits } from './format';
import type { PeriodTime, Slot, TimetableConfig } from './types';

export const DAY_NAMES = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
export const DAY_SHORT = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
/** ترتيب الأسبوع الدراسي في العراق: يبدأ السبت/الأحد */
export const WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5];
export const PERIOD_NAMES = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة', 'التاسعة', 'العاشرة'];

export function periodName(i: number) {
  return PERIOD_NAMES[i] ?? arDigits(i + 1);
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function fromMinutes(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** «٨:٠٠» بنظام ١٢ ساعة بلا ص/م (المدارس صباحية/مسائية معروفة) */
export function formatClock(hhmm: string, withSuffix = false): string {
  const total = toMinutes(hhmm);
  const h = Math.floor(total / 60);
  const m = total % 60;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const s = `${arDigits(h12)}:${arDigits(String(m).padStart(2, '0'))}`;
  return withSuffix ? `${s} ${h < 12 ? 'ص' : 'م'}` : s;
}

/**
 * يولّد أوقات الحصص: البداية، مدة الحصة، الاستراحة بين الحصص، والفرصة الكبيرة بعد حصة معينة.
 */
export function generatePeriods(opts: {
  start: string;
  count: number;
  length: number;
  gap: number;
  /** بعد أي حصة (رقمها من ١) تأتي الفرصة الكبيرة */
  breakAfter?: number;
  breakLength?: number;
}): PeriodTime[] {
  const out: PeriodTime[] = [];
  let t = toMinutes(opts.start);
  for (let i = 0; i < opts.count; i++) {
    out.push({ start: fromMinutes(t), end: fromMinutes(t + opts.length) });
    t += opts.length;
    if (i < opts.count - 1) t += opts.breakAfter === i + 1 ? (opts.breakLength ?? 15) : opts.gap;
  }
  return out;
}

export const DEFAULT_TIMETABLE: TimetableConfig = {
  days: [0, 1, 2, 3, 4],
  periods: generatePeriods({ start: '08:00', count: 6, length: 45, gap: 5, breakAfter: 3, breakLength: 15 }),
  remind: 5,
};

export type NowState =
  | { kind: 'in'; period: number; slot: Slot | null; endsIn: number; startedAgo: number }
  | { kind: 'before'; period: number; slot: Slot | null; startsIn: number }
  | { kind: 'between'; period: number; slot: Slot | null; startsIn: number }
  | { kind: 'done' }
  | { kind: 'off' };

/** أين نحن الآن في جدول اليوم (بالدقائق) */
export function nowState(cfg: TimetableConfig, slots: Slot[], now: Date): NowState {
  const day = now.getDay();
  if (!cfg.days.includes(day) || !cfg.periods.length) return { kind: 'off' };
  const t = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const today = slots.filter((s) => !s.deleted && s.day === day);
  const slotAt = (p: number) => today.find((s) => s.period === p) ?? null;
  for (let i = 0; i < cfg.periods.length; i++) {
    const a = toMinutes(cfg.periods[i].start);
    const b = toMinutes(cfg.periods[i].end);
    if (t < a) return { kind: i === 0 ? 'before' : 'between', period: i, slot: slotAt(i), startsIn: Math.ceil(a - t) };
    if (t >= a && t < b) return { kind: 'in', period: i, slot: slotAt(i), endsIn: Math.ceil(b - t), startedAgo: Math.floor(t - a) };
  }
  return { kind: 'done' };
}

/** الحصة القادمة التي فيها شعبة (اليوم أو الأيام التالية) */
export function nextClass(cfg: TimetableConfig, slots: Slot[], now: Date): { slot: Slot; dayOffset: number; start: string } | null {
  const live = slots.filter((s) => !s.deleted && (s.section_id || s.label));
  if (!live.length || !cfg.periods.length) return null;
  const t = now.getHours() * 60 + now.getMinutes();
  for (let off = 0; off < 8; off++) {
    const day = (now.getDay() + off) % 7;
    if (!cfg.days.includes(day)) continue;
    const today = live.filter((s) => s.day === day).sort((a, b) => a.period - b.period);
    for (const s of today) {
      const p = cfg.periods[s.period];
      if (!p) continue;
      if (off === 0 && toMinutes(p.start) <= t) continue;
      return { slot: s, dayOffset: off, start: p.start };
    }
  }
  return null;
}

/** «بعد ٥ دقائق»، «بعد ساعة و١٠ دقائق» */
export function inMinutes(min: number): string {
  if (min <= 0) return 'الآن';
  if (min < 60) return `بعد ${minutesLabel(min)}`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  const hs = h === 1 ? 'ساعة' : h === 2 ? 'ساعتين' : `${arDigits(h)} ساعات`;
  return m ? `بعد ${hs} و${minutesLabel(m)}` : `بعد ${hs}`;
}

export function minutesLabel(m: number): string {
  if (m === 1) return 'دقيقة';
  if (m === 2) return 'دقيقتين';
  if (m <= 10) return `${arDigits(m)} دقائق`;
  return `${arDigits(m)} دقيقة`;
}

/** عدد حصص الأسبوع لكل شعبة */
export function weeklyLoad(slots: Slot[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of slots) if (!s.deleted && s.section_id) m.set(s.section_id, (m.get(s.section_id) ?? 0) + 1);
  return m;
}

/** تاريخ اليوم YYYY-MM-DD بالتوقيت المحلي */
export function isoDay(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function parseIsoDay(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** العام الدراسي الحالي «٢٠٢٦–٢٠٢٧» (يبدأ في أيلول) */
export function schoolYear(d: Date = new Date()): string {
  const y = d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}-${y + 1}`;
}

export interface DayPlanInput {
  days: number[];
  periods: PeriodTime[];
  slots: { day: number; period: number; title: string; room: string | null }[];
}

/**
 * ما يعرضه ويدجت «حصص اليوم»: حصص اليوم المرئية، الحصة المميزة (الحالية أو التالية)، وكم بقي بعدها.
 * state: off عطلة، empty لا حصص، done انتهت، active فيها حصص قادمة.
 */
export function dayPlan(input: DayPlanInput, now: Date, maxRows: number) {
  const day = now.getDay();
  const t = now.getHours() * 60 + now.getMinutes();
  if (!input.days.includes(day)) return { state: 'off' as const, rows: [], focus: -1, live: false, remaining: 0 };
  const valid = input.slots.filter((x) => x.day === day && input.periods[x.period]).sort((a, b) => a.period - b.period);
  if (!valid.length) return { state: 'empty' as const, rows: [], focus: -1, live: false, remaining: 0 };
  const idx = valid.findIndex((x) => toMinutes(input.periods[x.period].end) > t);
  if (idx < 0) return { state: 'done' as const, rows: [], focus: -1, live: false, remaining: 0 };
  const focus = valid[idx].period;
  const live = toMinutes(input.periods[focus].start) <= t;
  const max = Math.max(1, maxRows);
  const start = Math.max(0, max >= 3 ? idx - 1 : idx);
  const rows = valid.slice(start, start + max);
  return { state: 'active' as const, rows, focus, live, remaining: Math.max(0, valid.length - (start + rows.length)) };
}
