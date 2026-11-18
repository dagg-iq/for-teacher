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
