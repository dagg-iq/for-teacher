import { useEffect, useSyncExternalStore } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '@/components/icon';
import { PressScale } from '@/components/motion';
import { Portal } from '@/components/portal';
import { T } from '@/components/ui';
import { useTheme } from './theme';

/** رسالة قصيرة أسفل الشاشة (مع زر تراجع اختياري) */
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
  useEffect(() => {
    const h = setTimeout(() => { if (current?.id === t.id) { current = null; emit(); } }, t.action ? 5000 : 2600);
    return () => clearTimeout(h);
  }, [t]);
  return (
    <Portal>
      <View pointerEvents="box-none" style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: insets.bottom + 84, paddingHorizontal: 16 }}>
        <Animated.View entering={FadeInDown.duration(180)} exiting={FadeOutDown.duration(140)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.ink, borderRadius: 20, paddingVertical: 12, paddingHorizontal: 16, maxWidth: 520, width: '100%' }}>
          {t.icon ? <Icon name={t.icon} size={20} color={t.tone === 'bad' ? '#F59A93' : c.bg} /> : null}
          <T size={14} weight="medium" color={c.bg} style={{ flex: 1 }}>{t.text}</T>
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
