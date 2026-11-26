/**
 * إعدادات الطباعة: القالب (الثيم)، الخط والحجم، الصفحة، الترويسة والتذييل، شكل الجداول.
 * تُحفظ مرة واحدة (prefs.print) وتنطبق على كل المطبوعات، وترتيب الأقسام يُحفظ لكل نوع مطبوع (prefs.printLayouts).
 */

export type PrintTheme = 'official' | 'modern' | 'minimal' | 'ink';
export type PrintFont = 'sans' | 'serif' | 'system';
export type PrintDensity = 'compact' | 'normal' | 'roomy';
export type PrintMargins = 'narrow' | 'normal' | 'wide';
export type PrintOrientation = 'auto' | 'portrait' | 'landscape';
export type PrintPaper = 'A4' | 'A5';

export interface PrintStyle {
  theme: PrintTheme;
  /** لون التمييز في القالب العصري */
  accent: string;
  font: PrintFont;
  /** حجم النص الأساسي بالنقطة */
  size: number;
  density: PrintDensity;
  margins: PrintMargins;
  orientation: PrintOrientation;
  paper: PrintPaper;
  /** «جمهورية العراق / وزارة التربية / المديرية» */
  officialHeader: boolean;
  /** المدرسة والمادة والعام الدراسي في الترويسة */
  schoolInfo: boolean;
  /** توقيع المدرس والمدير */
  signatures: boolean;
  /** «أُعدّ بتطبيق نَهج» أسفل الصفحة */
  brand: boolean;
  pageNumbers: boolean;
  printDate: boolean;
  /** تظليل الصفوف بالتناوب */
  zebra: boolean;
  /** الراسب بالأحمر */
  highlightFail: boolean;
  /** تكرار رأس الجدول في كل صفحة */
  repeatHeader: boolean;
}

export const ACCENTS = ['#0B6E5E', '#1D4E89', '#7A2E8C', '#9A3412', '#14532D', '#111111'];

export const DEFAULT_PRINT: PrintStyle = {
  theme: 'official',
  accent: ACCENTS[0],
  font: 'sans',
  size: 11,
  density: 'normal',
  margins: 'normal',
  orientation: 'auto',
  paper: 'A4',
  officialHeader: true,
  schoolInfo: true,
  signatures: true,
  brand: true,
  pageNumbers: true,
  printDate: false,
  zebra: true,
  highlightFail: true,
  repeatHeader: true,
};

export const THEMES: { key: PrintTheme; label: string; hint: string }[] = [
  { key: 'official', label: 'رسمي', hint: 'حدود سوداء وترويسة وزارية — للدوائر والإدارة' },
  { key: 'modern', label: 'عصري', hint: 'رؤوس ملوّنة وبطاقات أرقام — للعرض والاجتماعات' },
  { key: 'minimal', label: 'بسيط', hint: 'خطوط أفقية رفيعة بلا تظليل — مريح للقراءة' },
  { key: 'ink', label: 'موفّر للحبر', hint: 'أسود فقط بلا ألوان ولا تظليل' },
];

export const FONTS: { key: PrintFont; label: string }[] = [
  { key: 'sans', label: 'ثمانية' },
  { key: 'serif', label: 'ثمانية نسخ' },
  { key: 'system', label: 'خط النظام' },
];

/** ترتيب أقسام مطبوع واحد واختياراته */
export interface PrintLayout {
  order: string[];
  off: string[];
  /** أقسام تبدأ في صفحة جديدة */
  breaks: string[];
  /** خيارات خاصة بهذا النوع (عدد الأعمدة الفارغة…) */
  extras?: Record<string, number | boolean | string>;
}

/** يدمج المحفوظ مع الافتراضي (إعدادات قديمة أو ناقصة لا تكسر الطباعة) */
export function resolveStyle(saved?: Partial<PrintStyle> | null): PrintStyle {
  const s = { ...DEFAULT_PRINT, ...(saved ?? {}) };
  if (!THEMES.some((t) => t.key === s.theme)) s.theme = DEFAULT_PRINT.theme;
  if (!FONTS.some((f) => f.key === s.font)) s.font = DEFAULT_PRINT.font;
  s.size = Math.max(8, Math.min(14, Number(s.size) || DEFAULT_PRINT.size));
  return s;
}

/** يرتب أقسام مطبوع حسب المحفوظ: الأقسام الجديدة (غير المحفوظة) تُضاف في مكانها الافتراضي */
export function resolveLayout(blocks: { id: string; on?: boolean }[], saved?: PrintLayout | null): PrintLayout {
  const ids = blocks.map((b) => b.id);
  const order = (saved?.order ?? []).filter((id) => ids.includes(id));
  for (const id of ids) {
    if (order.includes(id)) continue;
    // أدخل القسم الجديد بعد القسم الذي يسبقه في الترتيب الافتراضي
    const prev = ids.slice(0, ids.indexOf(id)).reverse().find((x) => order.includes(x));
    order.splice(prev ? order.indexOf(prev) + 1 : 0, 0, id);
  }
  const off = saved ? saved.off.filter((id) => ids.includes(id)) : blocks.filter((b) => b.on === false).map((b) => b.id);
  // قسم جديد مطفأ افتراضياً يبقى مطفأً
  if (saved) for (const b of blocks) if (b.on === false && !saved.order.includes(b.id) && !off.includes(b.id)) off.push(b.id);
  return { order, off, breaks: (saved?.breaks ?? []).filter((id) => ids.includes(id)), extras: saved?.extras ?? {} };
}

/** أبعاد الورق بالمليمتر */
export function paperSize(paper: PrintPaper, landscape: boolean): { w: number; h: number } {
  const p = paper === 'A5' ? { w: 148, h: 210 } : { w: 210, h: 297 };
  return landscape ? { w: p.h, h: p.w } : p;
}

export function marginMm(m: PrintMargins): number {
  return m === 'narrow' ? 7 : m === 'wide' ? 18 : 12;
}
