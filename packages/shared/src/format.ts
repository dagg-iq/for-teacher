const AR_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

/**
 * شكل الأرقام في الواجهة والطباعة: «latn» إنكليزية (0123، الافتراضي) أو «arab» عربية مشرقية (٠١٢٣).
 * يُضبط مرة عند التشغيل ومن الإعدادات (setDigitStyle)، وكل دوال العرض هنا تتبعه.
 */
export type DigitStyle = 'latn' | 'arab';
let digitStyle: DigitStyle = 'latn';
export function setDigitStyle(s: DigitStyle) { digitStyle = s; }
export function getDigitStyle(): DigitStyle { return digitStyle; }

/** يكتب الأرقام بالشكل المختار في الإعدادات (إنكليزية افتراضياً، أو عربية مشرقية مع الفاصلة «٫»). */
export function arDigits(input: string | number): string {
  const s = String(input);
  if (digitStyle === 'latn') return s.replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d))).replace(/٫/g, '.').replace(/٪/g, '%');
  return s
    .replace(/[0-9]/g, (d) => AR_DIGITS[Number(d)])
    .replace(/\./g, '٫')
    .replace(/%/g, '٪');
}

/** نسبة مئوية للعرض: «78%» أو «٧٨٪» حسب شكل الأرقام */
export function formatPercent(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  // الأرقام الإنكليزية داخل نص عربي: نعزلها (LRI…PDI) حتى تظهر «78%» لا «%78»
  return digitStyle === 'latn' ? `\u2066${formatScore(n, digits)}%\u2069` : `${formatScore(n, digits)}٪`;
}

/** رقم درجة للعرض: بحد أقصى منزلة عشرية واحدة. */
export function formatScore(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const fixed = Number(Math.round(Number(`${n}e${digits}`)) + `e-${digits}`);
  return arDigits(fixed);
}

/** يقبل أرقاماً عربية أو إنكليزية من لوحة المفاتيح. */
export function parseNumber(input: string): number | null {
  const normalized = input
    .trim()
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)))
    .replace(/[٫,]/g, '.');
  if (!normalized) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

const MONTHS = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];
const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

/** «الأحد، ٥ تشرين الأول» بالأشهر العراقية */
export function formatDayDate(d: Date): string {
  return `${DAYS[d.getDay()]}، ${arDigits(d.getDate())} ${MONTHS[d.getMonth()]}`;
}

export function formatDate(d: Date): string {
  return `${arDigits(d.getDate())} ${MONTHS[d.getMonth()]} ${arDigits(d.getFullYear())}`;
}

export function formatTime(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const suffix = h < 12 ? 'ص' : 'م';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${arDigits(h12)}:${arDigits(m)} ${suffix}`;
}

/** «بعد ٤ أيام»، «اليوم»، «غداً»، «قبل يومين» */
export function relativeDays(target: Date, now: Date = new Date()): string {
  const day = 86400000;
  const a = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((a - b) / day);
  if (diff === 0) return 'اليوم';
  if (diff === 1) return 'غداً';
  if (diff === -1) return 'أمس';
  if (diff === 2) return 'بعد يومين';
  if (diff > 2) return `بعد ${arDigits(diff)} ${diff <= 10 ? 'أيام' : 'يوماً'}`;
  return `قبل ${arDigits(-diff)} ${-diff <= 10 ? 'أيام' : 'يوماً'}`;
}

/** «منذ ٥ د»، «منذ ٣ س»، ثم التاريخ */
export function timeAgo(d: Date, now: Date = new Date()): string {
  const s = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (s < 60) return 'الآن';
  if (s < 3600) return `منذ ${arDigits(Math.floor(s / 60))} د`;
  if (s < 86400) return `منذ ${arDigits(Math.floor(s / 3600))} س`;
  if (s < 7 * 86400) return `منذ ${arDigits(Math.floor(s / 86400))} يوم`;
  return formatDate(d);
}

/** الاسم الثلاثي: ٣ كلمات عربية على الأقل */
export function isTripleName(name: string): boolean {
  return name.trim().split(/\s+/).filter((w) => w.length >= 2).length >= 3;
}

export function initials(name: string): string {
  return name.trim().charAt(0) || '؟';
}

/** يستخرج معرف فيديو يوتيوب من أي شكل من الروابط */
export function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{11})/);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{11}$/.test(url.trim()) ? url.trim() : null;
}
