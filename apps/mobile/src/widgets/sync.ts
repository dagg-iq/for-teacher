'use no memo';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { all, getSettings, getTimetable, onAnyChange } from '@/data/db';
import { slotTitle } from '@/data/queries';
import { useTheme } from '@/lib/theme';
import { writeSnapshot, type WidgetSnapshot } from './snapshot';

export const widgetsSupported = Platform.OS === 'android' && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

function build(theme: WidgetSnapshot['theme']): WidgetSnapshot {
  const cfg = getTimetable();
  return {
    days: cfg.days,
    periods: cfg.periods,
    slots: all('slots').flatMap((x) => {
      const title = slotTitle(x);
      return title ? [{ day: x.day, period: x.period, title, room: x.room ?? null }] : [];
    }),
    theme,
    digits: getSettings().prefs.digits ?? 'latn',
    configured: !!getSettings().timetable,
    updatedAt: new Date().toISOString(),
  };
}

let lastHash = '';

async function push(theme: WidgetSnapshot['theme']) {
  if (!widgetsSupported) return;
  const s = build(theme);
  // لا نعيد الرسم إن لم يتغير ما يعرضه الويدجت (الدرجات والحضور لا تهمه)
  const hash = JSON.stringify([s.days, s.periods, s.slots, s.theme, s.configured, s.digits]);
  if (hash === lastHash) return;
  lastHash = hash;
  await writeSnapshot(s);
  try {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const lib = require('react-native-android-widget') as typeof import('react-native-android-widget');
    const reg = require('./registry') as typeof import('./registry');
    /* eslint-enable @typescript-eslint/no-require-imports */
    for (const name of reg.WIDGET_NAMES) {
      await lib.requestWidgetUpdate({ widgetName: name, renderWidget: (info) => reg.renderWidgetFor(name, s, info)! }).catch(() => {});
    }
  } catch { /* الويدجت غير مضاف */ }
}

/** يحدّث الويدجت بعد أي تعديل على الجدول، وعند العودة للتطبيق */
export function useWidgetSync() {
  const { mode } = useTheme();
  useEffect(() => {
    if (!widgetsSupported) return;
    let t: ReturnType<typeof setTimeout> | null = null;
    const run = () => { if (t) clearTimeout(t); t = setTimeout(() => { push(mode).catch(() => {}); }, 1500); };
    run();
    const off = onAnyChange(run);
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') { lastHash = ''; run(); } });
    return () => { off(); sub.remove(); if (t) clearTimeout(t); };
  }, [mode]);
}
