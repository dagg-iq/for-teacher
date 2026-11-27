/**
 * قفل التطبيق بالبصمة أو بقفل شاشة الهاتف (رمز/نمط/كلمة مرور) — اختياري من الإعدادات.
 *  - الإعداد محفوظ على هذا الجهاز فقط (لا يُزامن): لكل هاتف قفله.
 *  - يُقفل عند فتح التطبيق، وعند العودة إليه بعد مدة يختارها المدرّس (فوراً / دقيقة / ٥ دقائق).
 *  - الهاتف فقط؛ على الحاسوب والويب لا يظهر الخيار.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, LogoMark, Wordmark } from '@/components/icon';
import { PressScale } from '@/components/motion';
import { T } from '@/components/ui';
import { useTheme } from './theme';

type LA = typeof import('expo-local-authentication');
let la: LA | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  la = Platform.OS === 'web' ? null : (require('expo-local-authentication') as LA);
} catch {
  la = null;
}

export interface LockPrefs { enabled: boolean; after: number }
const KEY = 'nahj.applock';
let prefs: LockPrefs = { enabled: false, after: 0 };
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export async function loadLockPrefs() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) prefs = { ...prefs, ...(JSON.parse(raw) as Partial<LockPrefs>) };
  } catch { /* */ }
  loaded = true;
  emit();
}

export function useLockPrefs(): LockPrefs {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => prefs, () => prefs);
}

export async function setLockPrefs(patch: Partial<LockPrefs>) {
  prefs = { ...prefs, ...patch };
  emit();
  await AsyncStorage.setItem(KEY, JSON.stringify(prefs)).catch(() => {});
}

/** القفل متاح على هذا الجهاز؟ (هاتف فيه قفل شاشة أو بصمة) */
export async function lockSupport(): Promise<{ ok: boolean; biometric: boolean; reason?: string }> {
  if (!la) return { ok: false, biometric: false, reason: 'القفل متاح على الهاتف فقط.' };
  try {
    const level = await la.getEnrolledLevelAsync();
    const biometric = (await la.hasHardwareAsync()) && (await la.isEnrolledAsync());
    if (level === la.SecurityLevel.NONE) return { ok: false, biometric, reason: 'فعّل قفل الشاشة في هاتفك أولاً (رمز أو نمط أو بصمة) من إعدادات الهاتف ← الأمان.' };
    return { ok: true, biometric };
  } catch {
    return { ok: false, biometric: false, reason: 'تعذّر الوصول لقفل الهاتف.' };
  }
}

let authenticating = false;
let authEndedAt = 0;

/** يطلب البصمة أو رمز الهاتف. يعيد true عند النجاح */
export async function unlock(prompt = 'افتح نَهج'): Promise<boolean> {
  if (!la) return true;
  authenticating = true;
  try {
    const r = await la.authenticateAsync({ promptMessage: prompt, cancelLabel: 'إلغاء', disableDeviceFallback: false, requireConfirmation: false });
    return r.success;
  } catch {
    return false;
  } finally {
    authenticating = false;
    authEndedAt = Date.now();
  }
}

/** شاشة القفل فوق كل التطبيق؛ تظهر عند الفتح وعند العودة بعد المدة المختارة */
export function AppLock() {
  const p = useLockPrefs();
  const [locked, setLocked] = useState(false);
  const [ready, setReady] = useState(loaded);
  const leftAt = useRef<number | null>(null);
  const busy = useRef(false);

  useEffect(() => { if (!loaded) loadLockPrefs().then(() => setReady(true)); }, []);
  // أول فتح
  useEffect(() => { if (ready && prefs.enabled && la) setLocked(true); }, [ready]);
  // الخروج والعودة (نافذة البصمة/رمز الهاتف نفسها تُخرج التطبيق لحظة: لا نقفل بسببها)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (!prefs.enabled || !la) return;
      if (authenticating || Date.now() - authEndedAt < 1500) return;
      if (st === 'background') leftAt.current = Date.now();
      if (st === 'active' && leftAt.current != null) {
        const away = (Date.now() - leftAt.current) / 1000;
        leftAt.current = null;
        if (away >= prefs.after) setLocked(true);
      }
    });
    return () => sub.remove();
  }, []);

  const tryUnlock = async () => {
    if (busy.current) return;
    busy.current = true;
    const ok = await unlock();
    busy.current = false;
    if (ok) setLocked(false);
  };
  useEffect(() => { if (locked) tryUnlock(); }, [locked]);

  if (!locked || !p.enabled) return null;
  return <LockScreen onUnlock={tryUnlock} />;
}

function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 1000, backgroundColor: '#0E3B33', alignItems: 'center', justifyContent: 'center', padding: 24, paddingBottom: insets.bottom + 24 }}>
      <View style={{ alignItems: 'center', gap: 12, flex: 1, justifyContent: 'center' }}>
        <LogoMark size={72} ink="#F7F5F0" dot={c.gold} />
        <Wordmark height={52} color="#FFFFFF" />
        <View style={{ height: 8 }} />
        <T size={16} color="#AFC8C1">التطبيق مقفل</T>
      </View>
      <PressScale onPress={onUnlock} haptic scaleTo={0.96} accessibilityRole="button" accessibilityLabel="فتح القفل"
        style={{ height: 56, borderRadius: 28, backgroundColor: '#F7F5F0', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, alignSelf: 'stretch', maxWidth: 420, width: '100%' }}>
        <Icon name="lock" size={20} color="#0E3B33" />
        <T weight="bold" size={17} color="#0E3B33">فتح بالبصمة أو رمز الهاتف</T>
      </PressScale>
    </View>
  );
}
