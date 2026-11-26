import { BRAND, KUFIC_SIZE, kuficPaths, WORDMARK_AR } from '@nahj/shared';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

/** أيقونات خطية بسماكة ١٫٨ — مرسومة لواجهة من اليمين لليسار (الرجوع ← يشير لليمين) */
const PATHS: Record<string, string[]> = {
  home: ['M4 10.6 12 4.2l8 6.4V19a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z'],
  book: ['M5 4h9a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z', 'M5 17a3 3 0 0 1 3-3h9'],
  chart: ['M5 20.2h14', 'M7.5 17v-4.2', 'M12 17v-7', 'M16.5 17v-5.6'],
  chat: ['M4 5h16v11H9l-5 4z'],
  bell: ['M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z', 'M10 20a2 2 0 0 0 4 0'],
  'bell-off': ['M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z', 'M10 20a2 2 0 0 0 4 0', 'M4 4l16 16'],
  back: ['M9 6l6 6-6 6'],
  forward: ['M15 6l-6 6 6 6'],
  down: ['M6 9l6 6 6-6'],
  up: ['M6 15l6-6 6 6'],
  search: ['M16 16l4 4'],
  plus: ['M12 5v14', 'M5 12h14'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  'check-double': ['M2.5 12.5L7 17l9.5-9.5', 'M11 15.5l1.5 1.5L22 7.5'],
  clock: ['M12 7.5V12l3 2'],
  'user-plus': ['M3 19a6 6 0 0 1 12 0', 'M19 8v6', 'M16 11h6'],
  'arrow-down': ['M12 5v14', 'M6 13l6 6 6-6'],
  close: ['M6 6l12 12', 'M18 6L6 18'],
  play: ['M8 5v14l11-7z'],
  file: ['M7 3h7l5 5v13H7z', 'M14 3v5h5'],
  download: ['M12 4v11', 'M7 10l5 5 5-5', 'M5 20h14'],
  share: ['M12 15V4', 'M7 9l5-5 5 5', 'M5 14v6h14v-6'],
  camera: ['M4 8h3l2-3h6l2 3h3v11H4z'],
  image: ['M4 5h16v14H4z', 'M4 16l5-5 4 4 3-3 4 4'],
  send: ['M20 12L4 4l3 8-3 8z', 'M7 12h7'],
  reply: ['M14 8l4 4-4 4', 'M18 12H9a4 4 0 0 0-4 4v2'],
  'forward-msg': ['M10 8l-4 4 4 4', 'M6 12h9a4 4 0 0 1 4 4v2'],
  paperclip: ['M17 11l-6 6a4 4 0 0 1-6-6l7-7a3 3 0 0 1 4 4l-7 7a1.5 1.5 0 0 1-2-2l6-6'],
  sparkle: ['M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z'],
  timer: ['M12 8v5l3 2', 'M9 2h6'],
  calendar: ['M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z', 'M4 10h16', 'M8.5 3v4', 'M15.5 3v4'],
  table: ['M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z', 'M4 9.5h16', 'M4 14.5h16', 'M9.5 9.5V20'],
  news: ['M4 5h13v14H6a2 2 0 0 1-2-2z', 'M17 9h3v8a2 2 0 0 1-2 2', 'M8 9h5', 'M8 13h5'],
  settings: ['M4 7h10', 'M18 7h2', 'M4 17h4', 'M12 17h8'],
  user: ['M5 20a7 7 0 0 1 14 0'],
  users: ['M3 19.5a6 6 0 0 1 12 0', 'M16 13.2a5 5 0 0 1 5 5.3'],
  logout: ['M10 5H5v14h5', 'M14 8l-4 4 4 4', 'M10 12h10'],
  edit: ['M5 19h4L19 9l-4-4L5 15z'],
  trash: ['M5 7h14', 'M10 7V4h4v3', 'M7 7l1 13h8l1-13'],
  copy: ['M8 8h11v11H8z', 'M5 16V5h11'],
  moon: ['M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10z'],
  sun: ['M12 2v2', 'M12 20v2', 'M4.9 4.9l1.4 1.4', 'M17.7 17.7l1.4 1.4', 'M2 12h2', 'M20 12h2', 'M4.9 19.1l1.4-1.4', 'M17.7 6.3l1.4-1.4'],
  scan: ['M4 8V4h4', 'M16 4h4v4', 'M20 16v4h-4', 'M8 20H4v-4', 'M7 12h10'],
  quiz: ['M9 9a3 3 0 1 1 4 2.8c-.6.3-1 .9-1 1.6V15', 'M12 18.5v.5'],
  pin: ['M9 4h6l-1 6 3 3H7l3-3z', 'M12 13v7'],
  lock: ['M6 11h12v9H6z', 'M9 11V8a3 3 0 0 1 6 0v3'],
  refresh: ['M20 11a8 8 0 1 0-2.3 5.7', 'M20 5v6h-6'],
  at: ['M16 12v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-4 7.5'],
  more: [],
  'more-v': [],
  apps: ['M5.5 4h4a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-1.5 1.5h-4A1.5 1.5 0 0 1 4 9.5v-4A1.5 1.5 0 0 1 5.5 4z', 'M14.5 4h4A1.5 1.5 0 0 1 20 5.5v4a1.5 1.5 0 0 1-1.5 1.5h-4A1.5 1.5 0 0 1 13 9.5v-4A1.5 1.5 0 0 1 14.5 4z', 'M5.5 13h4a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-1.5 1.5h-4A1.5 1.5 0 0 1 4 18.5v-4A1.5 1.5 0 0 1 5.5 13z'],
  target: [],
  info: ['M12 11v5.5', 'M12 7.6v.4'],
  minus: ['M5 12h14'],
  list: ['M9 6h11', 'M9 12h11', 'M9 18h11'],
  instagram: ['M8 3h8a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V8a5 5 0 0 1 5-5z'],
  telegram: ['M21 4L3 11l6 2 2 6 3-4 5 4z', 'M9 13l8-6'],
  whatsapp: ['M4 20l1.3-4A8 8 0 1 1 8 18.7z', 'M9 9.5c.5 2 2.5 4 4.5 4.5l1.2-1.2 2 1-.5 1.7c-3.5.3-7.7-3.9-7.4-7.4l1.7-.5 1 2z'],
  facebook: ['M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v7h4v-7h3l1-4h-4V8z'],
  link: ['M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1', 'M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1'],
  mic: ['M12 3.5a3 3 0 0 1 3 3V12a3 3 0 0 1-6 0V6.5a3 3 0 0 1 3-3z', 'M5.5 11.5a6.5 6.5 0 0 0 13 0', 'M12 18v2.5'],
  'mic-off': ['M15 9.5V6a3 3 0 0 0-5.7-1.3', 'M9 9v3a3 3 0 0 0 4.6 2.5', 'M5 11a7 7 0 0 0 11.5 5.4', 'M19 11a7 7 0 0 1-.6 2.8', 'M12 18v3', 'M4 4l16 16'],
  school: ['M3.5 5.5a1 1 0 0 1 1-1h15a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z', 'M8.5 15.5 7 20', 'M15.5 15.5 17 20'],
  grid: ['M4 4h7v7H4z', 'M13 4h7v7h-7z', 'M4 13h7v7H4z', 'M13 13h7v7h-7z'],
  clipboard: ['M8.5 4.5H6a1 1 0 0 0-1 1V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V5.5a1 1 0 0 0-1-1h-2.5', 'M9 3.5h6v3H9z', 'M8.5 11h7', 'M8.5 15h4.5'],
  'check-square': ['M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z', 'M8 12.2l2.8 2.8L16 9.6'],
  print: ['M7 9V4h10v5', 'M6 18H4v-8h16v8h-2', 'M7 14h10v6H7z'],
  excel: ['M5 3h10l4 4v14H5z', 'M15 3v4h4', 'M9 11l5 6', 'M14 11l-5 6'],
  star: ['M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z'],
  shuffle: ['M4 7h3c4 0 6 10 10 10h3', 'M4 17h3c1.6 0 2.8-1.6 3.8-3.5', 'M13.2 9.5C14.2 8 15.4 7 17 7h3', 'M18 4l3 3-3 3', 'M18 14l3 3-3 3'],
  pie: ['M12 3v9h9', 'M20.5 15A9 9 0 1 1 9 3.5'],
  formula: ['M8 20c2 0 2.5-2 3-5l1.5-8c.5-2.5 1-4 3-4', 'M8 10h8', 'M14 14l5 5', 'M19 14l-5 5'],
  columns: ['M4 4h16v16H4z', 'M10 4v16', 'M15 4v16'],
  phone: ['M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z'],
  note: ['M5 4h14v11l-5 5H5z', 'M14 20v-5h5'],
  flag: ['M5 21V4', 'M5 4h12l-2 4 2 4H5'],
  upload: ['M12 20V9', 'M7 14l5-5 5 5', 'M5 4h14'],
  cloud: ['M7 18a4 4 0 0 1-.5-8 6 6 0 0 1 11.5 1.5A3.5 3.5 0 0 1 17.5 18z'],
  'cloud-off': ['M7 18a4 4 0 0 1-.5-8c.4-1 1-1.9 1.8-2.6', 'M11 5.2A6 6 0 0 1 18 11.5 3.5 3.5 0 0 1 19.6 17', 'M4 4l16 16'],
  volume: ['M4 9h4l5-4v14l-5-4H4z', 'M16 9a4 4 0 0 1 0 6', 'M18.5 6.5a8 8 0 0 1 0 11'],
  sort: ['M7 4v16', 'M4 17l3 3 3-3', 'M13 6h7', 'M13 12h5', 'M13 18h3'],
  sparkles: ['M10 4l1.6 4.4L16 10l-4.4 1.6L10 16l-1.6-4.4L4 10l4.4-1.6z', 'M18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8z'],
};

const CIRCLES: Record<string, [number, number, number][]> = {
  search: [[11, 11, 6.5]],
  timer: [[12, 13, 8]],
  clock: [[12, 12, 8.5]],
  'user-plus': [[9, 8, 3.5]],
  user: [[12, 8, 4]],
  users: [[9, 8, 3.5], [16.5, 8.5, 2.8]],
  camera: [[12, 13, 3.5]],
  image: [[9, 9, 1.5]],
  settings: [[16, 7, 2], [10, 17, 2]],
  quiz: [[12, 12, 9.5]],
  sun: [[12, 12, 4]],
  at: [[12, 12, 4]],
  target: [[12, 12, 9], [12, 12, 5], [12, 12, 1.2]],
  info: [[12, 12, 9.5]],
  list: [[4.5, 6, 1], [4.5, 12, 1], [4.5, 18, 1]],
  instagram: [[12, 12, 4], [17.5, 6.5, 0.6]],
};

/** خلية مربعة (الخلية الذهبية في الشعار الكوفي) — توقيع أيقونات «نَهج» */
const rh = (x: number, y: number, r: number) => { const h = r * 0.82; return `M${x - h} ${y - h}h${2 * h}v${2 * h}h${-2 * h}z`; };

/** تعبئة خفيفة بلون الأيقونة نفسه (أسلوب ثنائي اللون) تعطي الأيقونات حجماً بلا ظلال */
const TINTS: Record<string, string[]> = {
  home: ['M4 10.6 12 4.2l8 6.4V19a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z'],
  school: ['M3.5 5.5a1 1 0 0 1 1-1h15a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z'],
  calendar: ['M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3H4z'],
  table: ['M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v4.5H4z'],
  clipboard: ['M6 4.5h12a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1z'],
  'check-square': ['M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z'],
  mic: ['M12 3.5a3 3 0 0 1 3 3V12a3 3 0 0 1-6 0V6.5a3 3 0 0 1 3-3z'],
  users: ['M12.5 8a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0z'],
  excel: ['M5 3h10l4 4v14H5z'],
  print: ['M4 10h16v8H4z'],
  timer: ['M20 13a8 8 0 1 1-16 0 8 8 0 0 1 16 0z'],
  flag: ['M5 4h12l-2 4 2 4H5z'],
  bell: ['M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z'],
  cloud: ['M7 18a4 4 0 0 1-.5-8 6 6 0 0 1 11.5 1.5A3.5 3.5 0 0 1 17.5 18z'],
  pie: ['M12 3v9h9a9 9 0 0 0-9-9z'],
  apps: ['M5.5 4h4a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-1.5 1.5h-4A1.5 1.5 0 0 1 4 9.5v-4A1.5 1.5 0 0 1 5.5 4z'],
  chat: ['M4 5h16v11H9l-5 4z'],
  note: [],
  file: ['M7 3h7l5 5v13H7z'],
};

/** أجزاء مملوءة بلون التمييز (الذهبي) — تربط الأيقونات بخلية الشعار */
const ACCENTS: Record<string, string[]> = {
  home: [rh(12, 15.2, 2.5)],
  chart: [rh(12, 6.3, 2.3)],
  calendar: [rh(15.5, 15.5, 2.3)],
  school: [rh(12, 10, 2.4)],
  more: [rh(5.5, 12, 2.1), rh(12, 12, 2.1), rh(18.5, 12, 2.1)],
  'more-v': [rh(12, 5.5, 2.1), rh(12, 12, 2.1), rh(12, 18.5, 2.1)],
  apps: ['M13 13h7v7h-7z'],
  mic: [],
  excel: [],
  bell: [],
  table: [rh(15, 17.2, 1.7)],
  'check-square': [],
  clipboard: [rh(12, 5, 1.4)],
  sparkle: [],
  star: [],
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 24, color, strokeWidth = 1.8, fill, accent }: {
  name: IconName; size?: number; color: string; strokeWidth?: number; fill?: string;
  /** لون المعيّن (الذهبي في التبويب النشط مثلاً)؛ بدونه يأخذ لون الأيقونة */
  accent?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {fill ? null : (TINTS[name] ?? []).map((d, i) => <Path key={`t${i}`} d={d} fill={color} fillOpacity={0.14} />)}
      {PATHS[name].map((d, i) => (
        <Path key={i} d={d} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
          fill={name === 'play' ? color : fill ?? 'none'} />
      ))}
      {(CIRCLES[name] ?? []).map(([cx, cy, r], i) => (
        <Circle key={`c${i}`} cx={cx} cy={cy} r={r} stroke={color} strokeWidth={strokeWidth}
          fill={r < 1 ? color : 'none'} />
      ))}
      {(ACCENTS[name] ?? []).map((d, i) => <Path key={`a${i}`} d={d} fill={accent ?? color} />)}
    </Svg>
  );
}

const KP = kuficPaths();

/** رمز «نَهج»: كلمة «نهج» بالكوفي المربّع على شبكة، ونقطة النون خلية ذهبية (المصدر: packages/shared/src/brand.ts) */
export function LogoMark({ size = 40, ink, dot }: { size?: number; ink: string; dot: string }) {
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${KUFIC_SIZE} ${KUFIC_SIZE}`}>
      <Path d={KP.ink} fill={ink} />
      <Path d={KP.dot} fill={dot} />
    </Svg>
  );
}

/** أيقونة التطبيق: مربع أخضر عميق، الكوفي بلون الورق، والخلية الذهبية */
export function AppIcon({ size = 64 }: { size?: number }) {
  const pad = 2.6;
  const n = KUFIC_SIZE + 2 * pad;
  return (
    <Svg width={size} height={size} viewBox={`${-pad} ${-pad} ${n} ${n}`}>
      <Rect x={-pad} y={-pad} width={n} height={n} rx={n * 0.225} fill={BRAND.green} />
      <Path d={KP.ink} fill={BRAND.paper} />
      <Path d={KP.dot} fill={BRAND.gold} />
    </Svg>
  );
}

/** كلمة «نَهج» بخط ثمانية (نقاطها معيّنات مثل نقطة الشعار) */
export function Wordmark({ height = 40, color }: { height?: number; color: string }) {
  const w = (WORDMARK_AR.w / WORDMARK_AR.h) * height;
  return (
    <Svg width={w} height={height} viewBox={`0 0 ${WORDMARK_AR.w} ${WORDMARK_AR.h}`}>
      <Path d={WORDMARK_AR.d} fill={color} />
    </Svg>
  );
}

/** شارة التوثيق */
// ختم مسنّن متناظر (١٢ نتوءاً) بعلامة صح
const BADGE = 'M12.00 2.60Q15.31 -0.36 16.70 3.86Q21.05 2.95 20.14 7.30Q24.36 8.69 21.40 12.00Q24.36 15.31 20.14 16.70Q21.05 21.05 16.70 20.14Q15.31 24.36 12.00 21.40Q8.69 24.36 7.30 20.14Q2.95 21.05 3.86 16.70Q-0.36 15.31 2.60 12.00Q-0.36 8.69 3.86 7.30Q2.95 2.95 7.30 3.86Q8.69 -0.36 12.00 2.60Z';

export function VerifiedBadge({ size = 16, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityLabel="موثّق">
      <Path d={BADGE} fill={color} />
      <Path d="M7.6 12.4l2.9 2.9 5.9-6.1" stroke="#FFFFFF" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}
