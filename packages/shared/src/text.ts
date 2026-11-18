/** أدوات نصية: قوائم الأسماء الملصوقة، العدّ بالعربية، رسائل أولياء الأمور، CSV */
import { arDigits } from './format';

/**
 * «٣ طلاب»، «طالب واحد»، «طالبان»، «١٢ طالباً» — العدّ العربي الصحيح.
 * @param forms [المفرد، المثنى، الجمع (٣–١٠)، المفرد المنصوب (١١+)، الواحد]
 */
export function countOf(n: number, one: string, two: string, few: string, many?: string, single?: string): string {
  if (n === 0) return `لا ${few}`;
  if (n === 1) return single ?? `${one} واحد`;
  if (n === 2) return two;
  if (n % 100 >= 3 && n % 100 <= 10) return `${arDigits(n)} ${few}`;
  return `${arDigits(n)} ${many ?? one}`;
}

export const countStudents = (n: number) => countOf(n, 'طالب', 'طالبان', 'طلاب', 'طالباً');
export const countSections = (n: number) => countOf(n, 'شعبة', 'شعبتان', 'شعب', 'شعبة', 'شعبة واحدة');
export const countClasses = (n: number) => countOf(n, 'صف', 'صفّان', 'صفوف', 'صفاً');
export const countPeriods = (n: number) => countOf(n, 'حصة', 'حصتان', 'حصص', 'حصة', 'حصة واحدة');
export const countBooks = (n: number) => countOf(n, 'سجل', 'سجلّان', 'سجلات', 'سجلاً');

/**
 * يفكّ قائمة أسماء ملصوقة من واتساب أو Excel أو ورقة:
 *  - سطر لكل اسم، ويُحذف الترقيم في البداية («١- أحمد»، «1. علي»، «(٣) حسن»).
 *  - يقبل الفصل بالفاصلة أو «،» إن كانت القائمة في سطر واحد.
 *  - يحذف التكرار والأسطر الفارغة، ويوحّد المسافات.
 */
export function parseNameList(raw: string): string[] {
  let lines = raw.split(/\r?\n/);
  if (lines.filter((l) => l.trim()).length === 1 && /[،,؛;]/.test(raw)) lines = raw.split(/[،,؛;]/);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    const cleaned = line
      .replace(/\t.*$/, '') // عمود ثانٍ ملصوق من Excel
      .replace(/^[\s‏‎]*[(\[]?[0-9٠-٩]+[)\].\-–:ـ]*\s*/, '')
      .replace(/^[-•*·]\s*/, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleaned.length < 2) continue;
    if (/^[0-9٠-٩\s.]+$/.test(cleaned)) continue;
    const key = cleaned.replace(/[إأآ]/g, 'ا');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }
  return out;
}

/** يرتب الأسماء أبجدياً بالعربية */
export function sortArabic(names: string[]): string[] {
  return [...names].sort((a, b) => a.localeCompare(b, 'ar'));
}

/** رقم هاتف عراقي بصيغة دولية لواتساب: 07xx → 9647xx */
export function iraqiPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const d = raw.replace(/[٠-٩]/g, (x) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(x))).replace(/\D/g, '');
  if (/^07\d{9}$/.test(d)) return `964${d.slice(1)}`;
  if (/^7\d{9}$/.test(d)) return `964${d}`;
  if (/^9647\d{9}$/.test(d)) return d;
  if (/^009647\d{9}$/.test(d)) return d.slice(2);
  return d.length >= 10 ? d : null;
}

export function whatsappLink(phone: string, text: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

/** خلية CSV آمنة */
export function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: unknown[][]): string {
  return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}

/** تحية حسب الوقت */
export function greeting(d: Date = new Date()): string {
  const h = d.getHours();
  if (h < 12) return 'صباح الخير';
  if (h < 17) return 'نهارك سعيد';
  return 'مساء الخير';
}

/** «أ. محمد» / «ست زينب» لقب المدرس حسب الجنس */
export function teacherTitle(name: string, gender: 'm' | 'f'): string {
  const first = name.trim().split(/\s+/)[0] ?? '';
  if (!first) return gender === 'f' ? 'ست' : 'أستاذ';
  return gender === 'f' ? `ست ${first}` : `أستاذ ${first}`;
}
