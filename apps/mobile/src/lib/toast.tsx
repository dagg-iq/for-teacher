import { useEffect, useSyncExternalStore } from 'react';
import { View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '@/components/icon';
import { PressScale } from '@/components/motion';
import { Portal } from '@/components/portal';
import { T } from '@/components/ui';
import { useTheme } from './theme';

/** رسالة قصيرة أعلى الشاشة (لا تغطي أزرار الحفظ أسفلها ولا لوحة المفاتيح)، مع زر تراجع اختياري. الخطأ بلون أحمر ويبقى أطول */
interface ToastState { id: number; text: string; icon?: IconName; action?: { label: string; onPress: () => void }; tone?: 'ok' | 'bad' }
let current: ToastState | null = null;
let n = 0;
const ls = new Set<() => void>();
const emit = () => ls.forEach((l) => l());

export function toast(text: string, opts: Omit<ToastState, 'id' | 'text'> = {}) {
  current = { id: ++n, text, ...opts };
  emit();
}

export function ToastHost() {
  const t = useSyncExternalStore((cb) => { ls.add(cb); return () => { ls.delete(cb); }; }, () => current, () => current);
  return t ? <ToastView key={t.id} t={t} /> : null;
}

function ToastView({ t }: { t: ToastState }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const bad = t.tone === 'bad';
  useEffect(() => {
    const h = setTimeout(() => { if (current?.id === t.id) { current = null; emit(); } }, t.action ? 5000 : bad ? 4200 : 2600);
    return () => clearTimeout(h);
  }, [t]);
  return (
    <Portal>
      <View pointerEvents="box-none" style={{ flex: 1, justifyContent: 'flex-start', alignItems: 'center', paddingTop: insets.top + 10, paddingHorizontal: 16 }}>
        <Animated.View entering={FadeInUp.duration(180)} exiting={FadeOutUp.duration(140)} accessibilityLiveRegion="polite" accessibilityRole={bad ? 'alert' : undefined}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: bad ? '#9F1D17' : c.ink, borderRadius: 20, paddingVertical: 12, paddingHorizontal: 16, maxWidth: 520, width: '100%' }}>
          <Icon name={t.icon ?? (bad ? 'info' : 'check')} size={20} color={bad ? '#FFFFFF' : c.bg} />
          <T size={14} weight="medium" color={bad ? '#FFFFFF' : c.bg} style={{ flex: 1 }}>{t.text}</T>
          {t.action ? (
            <PressScale onPress={() => { current = null; emit(); t.action!.onPress(); }} hitSlop={10}>
              <T size={14} weight="bold" color={c.gold}>{t.action.label}</T>
            </PressScale>
          ) : null}
        </Animated.View>
      </View>
    </Portal>
  );
}
