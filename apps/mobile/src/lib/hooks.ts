import { useEffect, useState } from 'react';

/** الوقت الحالي، يتحدث كل فترة (للحصة الحالية والعدّ التنازلي) */
export function useNow(everyMs = 30000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}

/** شاشة عريضة (لابتوب/تابلت أفقي): شريط جانبي بدل الشريط السفلي، وتخطيط أوسع */
export const WIDE_MIN = 900;
export function useWide(): boolean {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useWindowDimensions } = require('react-native') as typeof import('react-native');
  return useWindowDimensions().width >= WIDE_MIN;
}
