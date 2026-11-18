/** ألوان هوية «مِداد» — المصدر: docs/BRAND.md (نفس نظام «سعي» بلون الحبر النيلي) */
export const palette = {
  light: {
    bg: '#F5F5F2',
    card: '#FFFFFF',
    ink: '#111111',
    ink2: '#5C5C5C',
    ink3: '#8A8A85',
    line: '#E2E2DC',
    accent: '#4338F0',
    accentInk: '#FFFFFF',
    soft: '#EEEDFF',
    softInk: '#1E1A4D',
    heroBg: '#111111',
    heroInk: '#FFFFFF',
    heroInk2: '#B4B4B4',
    track: '#333333',
    field: '#FAFAF8',
  },
  dark: {
    bg: '#0E0E0F',
    card: '#18181A',
    ink: '#F2F2F0',
    ink2: '#9E9E9E',
    ink3: '#6E6E6E',
    line: '#2A2A2D',
    accent: '#8F89FF',
    accentInk: '#0E0E0F',
    soft: '#24224A',
    softInk: '#DAD8FF',
    heroBg: '#4338F0',
    heroInk: '#FFFFFF',
    heroInk2: '#DAD8FF',
    track: '#6A60FF',
    field: '#141416',
  },
} as const;

export type ThemeColors = { [K in keyof typeof palette.light]: string };

/** ألوان النتائج فقط (ناجح/قريب/راسب…) */
export const toneColors = {
  light: {
    good: { bg: '#E5F3EC', ink: '#0B6B4B' },
    warn: { bg: '#FBEFDF', ink: '#8A4700' },
    neutral: { bg: '#EFEFEA', ink: '#3A3A3A' },
    bad: { bg: '#FBE6E4', ink: '#A82620' },
    info: { bg: '#EEEDFF', ink: '#2E25B8' },
    empty: { bg: '#EFEFEA', ink: '#8A8A85' },
  },
  dark: {
    good: { bg: '#123327', ink: '#6FD3A8' },
    warn: { bg: '#3A2A12', ink: '#F2B66B' },
    neutral: { bg: '#232326', ink: '#C8C8C8' },
    bad: { bg: '#3A1715', ink: '#F59A93' },
    info: { bg: '#24224A', ink: '#B9B5FF' },
    empty: { bg: '#232326', ink: '#8A8A8A' },
  },
} as const;

export type Tone = keyof typeof toneColors.light;
export type TonePalette = Record<Tone, { bg: string; ink: string }>;

/** ألوان تمييز الصفوف (بطاقات الصفوف وخلايا الجدول) — هادئة وتعمل في الوضعين */
export const classHues = [
  { light: '#4338F0', dark: '#8F89FF' },
  { light: '#0B7A5B', dark: '#5FD0A5' },
  { light: '#B4540A', dark: '#F2A55B' },
  { light: '#B0245E', dark: '#F28AB5' },
  { light: '#126A9C', dark: '#6CC0F0' },
  { light: '#6B4FB8', dark: '#B9A3F5' },
  { light: '#5B6B0A', dark: '#C3D46A' },
  { light: '#8A3A2A', dark: '#E8998A' },
] as const;

export const radius = { sm: 12, md: 16, lg: 22, xl: 28, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;
