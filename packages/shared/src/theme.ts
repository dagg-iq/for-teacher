/** ألوان هوية «مِداد» — السبورة والطباشير: أخضر السبورة، ذهبي الطباشير، وورق دافئ. المصدر: docs/BRAND.md */
export const palette = {
  light: {
    bg: '#F5F2EA',
    card: '#FFFFFF',
    ink: '#14201D',
    ink2: '#56615D',
    ink3: '#8B948F',
    line: '#E4DFD2',
    accent: '#0F6E66',
    accentInk: '#FFFFFF',
    soft: '#E3F0EC',
    softInk: '#0B3B35',
    heroBg: '#173A33',
    heroInk: '#FFFFFF',
    heroInk2: '#B9D2CB',
    track: '#2A5149',
    field: '#FBF9F4',
    gold: '#F2B544',
    goldInk: '#2B1E00',
    shadow: 'rgba(23,58,51,0.08)',
  },
  dark: {
    bg: '#0B1513',
    card: '#13211E',
    ink: '#ECF2EF',
    ink2: '#9AAAA5',
    ink3: '#6A7A75',
    line: '#22342F',
    accent: '#4FC7B5',
    accentInk: '#06201C',
    soft: '#183630',
    softInk: '#CBEDE6',
    heroBg: '#1C4A41',
    heroInk: '#FFFFFF',
    heroInk2: '#B9D2CB',
    track: '#2F6B5F',
    field: '#0F1B18',
    gold: '#F5BE55',
    goldInk: '#2B1E00',
    shadow: 'rgba(0,0,0,0.35)',
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
    info: { bg: '#E6EEFA', ink: '#1F4C8F' },
    empty: { bg: '#EFEFEA', ink: '#8A8A85' },
  },
  dark: {
    good: { bg: '#123327', ink: '#6FD3A8' },
    warn: { bg: '#3A2A12', ink: '#F2B66B' },
    neutral: { bg: '#232326', ink: '#C8C8C8' },
    bad: { bg: '#3A1715', ink: '#F59A93' },
    info: { bg: '#1B2B45', ink: '#9EC2F5' },
    empty: { bg: '#232326', ink: '#8A8A8A' },
  },
} as const;

export type Tone = keyof typeof toneColors.light;
export type TonePalette = Record<Tone, { bg: string; ink: string }>;

/** ألوان تمييز الصفوف (بطاقات الصفوف وخلايا الجدول) — هادئة وتعمل في الوضعين */
export const classHues = [
  { light: '#0F6E66', dark: '#4FC7B5' },
  { light: '#2F5DA8', dark: '#86AEF0' },
  { light: '#B4540A', dark: '#F2A55B' },
  { light: '#B0245E', dark: '#F28AB5' },
  { light: '#126A9C', dark: '#6CC0F0' },
  { light: '#6B4FB8', dark: '#B9A3F5' },
  { light: '#5B6B0A', dark: '#C3D46A' },
  { light: '#8A3A2A', dark: '#E8998A' },
] as const;

export const radius = { sm: 10, md: 14, lg: 20, xl: 26, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;
