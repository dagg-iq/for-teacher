'use no memo';
import type { WidgetInfo, WidgetRepresentation } from 'react-native-android-widget';
import { RA_PATH } from '@/components/icon';
import type { WidgetSnapshot } from './snapshot';
import { setRaPath, TodayWidget } from './views';

/** أسماء الويدجتات — يجب أن تطابق app.json */
export const WIDGET_NAMES = ['Today'] as const;
setRaPath(RA_PATH);

export function renderWidgetFor(name: string, s: WidgetSnapshot, info: Pick<WidgetInfo, 'width' | 'height'>): WidgetRepresentation | null {
  const both = (f: (mode: 'light' | 'dark') => React.JSX.Element): WidgetRepresentation =>
    s.theme === 'light' ? f('light') : s.theme === 'dark' ? f('dark') : { light: f('light'), dark: f('dark') };
  if (name === 'Today') return both((mode) => <TodayWidget s={s} mode={mode} height={info.height} />);
  return null;
}
