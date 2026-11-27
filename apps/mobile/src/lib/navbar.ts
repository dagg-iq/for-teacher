/**
 * أزرار أندرويد السفلية (رجوع/الرئيسية/التطبيقات): تُخفى لتأخذ الشاشة كاملة، وتظهر مؤقتاً بالسحب من الحافة السفلية.
 * تُعاد بعد الرجوع للتطبيق (النظام يُظهرها عند الخروج). قابل للإيقاف من الإعدادات ← المظهر.
 */
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

type NB = typeof import('expo-navigation-bar');
let nb: NB | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  nb = Platform.OS === 'android' ? (require('expo-navigation-bar') as NB) : null;
} catch {
  nb = null;
}

function apply(hidden: boolean) {
  if (!nb) return;
  nb.setVisibilityAsync(hidden ? 'hidden' : 'visible').catch(() => {});
}

export function useImmersiveNavBar(hidden: boolean) {
  useEffect(() => {
    if (!nb) return;
    apply(hidden);
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') apply(hidden); });
    return () => sub.remove();
  }, [hidden]);
}

export const navBarSupported = !!nb;
