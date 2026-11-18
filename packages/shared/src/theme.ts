/** ألوان هوية «نَهج»: أخضر عميق، أخضر مائي للتفاعل، ذهبي لنقطة المعيّن فقط، وورق دافئ. المصدر: docs/BRAND.md */
export const palette = {
  light: {
    bg: '#F7F5F0',
    card: '#FFFFFF',
    ink: '#14211E',
    ink2: '#5A6662',
    ink3: '#8E9893',
    line: '#E6E2D9',
    accent: '#0B6E5E',
    accentInk: '#FFFFFF',
    soft: '#E8F1EE',
    softInk: '#0C3A33',
    heroBg: '#0E3B33',
    heroInk: '#FFFFFF',
    heroInk2: '#AFC8C1',
    track: '#245A50',
    field: '#FBFAF7',
    gold: '#E3A535',
    goldInk: '#2B1E00',
    shadow: 'transparent',
  },
  dark: {
    bg: '#0B1412',
    card: '#121E1B',
    ink: '#EBF1EE',
    ink2: '#98A8A3',
    ink3: '#677772',
    line: '#21302C',
    accent: '#4CC2AE',
    accentInk: '#05201B',
    soft: '#16302B',
    softInk: '#CDEDE6',
    heroBg: '#14423A',
    heroInk: '#FFFFFF',
    heroInk2: '#AFC8C1',
    track: '#2C6A5E',
    field: '#0E1917',
    gold: '#EBB54E',
    goldInk: '#2B1E00',
    shadow: 'transparent',
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
  { light: '#0B6E5E', dark: '#4CC2AE' },
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
