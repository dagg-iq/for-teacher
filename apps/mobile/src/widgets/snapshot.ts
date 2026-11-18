'use no memo';
/**
 * لقطة الأسبوع لويدجت «حصص اليوم»: تُحفظ في AsyncStorage فيقرؤها الويدجت والتطبيق مغلق،
 * ويحسب منها حصص اليوم والحصة الحالية بنفسه (فيتجدد كل يوم دون فتح التطبيق).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface WidgetSnapshot {
  days: number[];
  periods: { start: string; end: string }[];
  slots: { day: number; period: number; title: string; room: string | null }[];
  theme: 'system' | 'light' | 'dark';
  configured: boolean;
  updatedAt: string;
}

export const EMPTY_SNAPSHOT: WidgetSnapshot = { days: [], periods: [], slots: [], theme: 'system', configured: false, updatedAt: new Date(0).toISOString() };
const KEY = 'nahj.widget.snapshot';

export async function readSnapshot(): Promise<WidgetSnapshot> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...EMPTY_SNAPSHOT, ...JSON.parse(raw) } : EMPTY_SNAPSHOT;
  } catch {
    return EMPTY_SNAPSHOT;
  }
}

export async function writeSnapshot(s: WidgetSnapshot) {
  await AsyncStorage.setItem(KEY, JSON.stringify(s)).catch(() => {});
}
