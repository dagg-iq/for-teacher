/** مكونات إضافية خاصة بمِداد: بطاقات الأرقام، الشارات، حلقة النسبة، الأعمدة، المفاتيح */
import { arDigits, formatScore, radius, type Tone } from '@midad/shared';
import { useEffect, type ReactNode } from 'react';
import { Pressable, Switch, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { fonts, useTheme } from '@/lib/theme';
import { Icon, type IconName } from './icon';
import { PressScale, tap } from './motion';
import { Row, T } from './ui';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** حلقة نسبة (نسبة النجاح) */
export function Ring({ value, size = 92, stroke = 10, color, track, children }: {
  value: number | null; size?: number; stroke?: number; color?: string; track?: string; children?: ReactNode;
}) {
  const { c } = useTheme();
  const r = (size - stroke) / 2;
  const len = 2 * Math.PI * r;
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(Math.max(0, Math.min(1, (value ?? 0) / 100)), { duration: 650, easing: Easing.out(Easing.cubic) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: len * (1 - p.value) }));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track ?? c.line} strokeWidth={stroke} fill="none" />
        <AnimatedCircle cx={size / 2} cy={size / 2} r={r} stroke={color ?? c.accent} strokeWidth={stroke} fill="none"
          strokeLinecap="round" strokeDasharray={`${len} ${len}`} animatedProps={props} />
      </Svg>
      {children}
    </View>
  );
}

/** بطاقة رقم صغيرة */
export function Stat({ label, value, icon, onPress, tone, style }: {
  label: string; value: string | number; icon?: IconName; onPress?: () => void; tone?: Tone; style?: StyleProp<ViewStyle>;
}) {
  const { c, tone: tones } = useTheme();
  const t = tone ? tones[tone] : null;
  const body = (
    <>
      {icon ? (
        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: t?.bg ?? c.soft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={19} color={t?.ink ?? c.accent} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <T display size={24} lines={1}>{typeof value === 'number' ? arDigits(value) : value}</T>
        <T dim size={12} lines={1} style={{ marginTop: -4 }}>{label}</T>
      </View>
    </>
  );
  const s: StyleProp<ViewStyle> = [{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, paddingHorizontal: 14, paddingVertical: 10, minWidth: 100 }, style];
  return onPress ? <PressScale onPress={onPress} scaleTo={0.97} style={s}>{body}</PressScale> : <View style={s}>{body}</View>;
}

/** شارة ملونة حسب النتيجة */
export function Pill({ label, tone = 'neutral', small }: { label: string; tone?: Tone; small?: boolean }) {
  const { tone: tones } = useTheme();
  const t = tones[tone];
  return (
    <View style={{ backgroundColor: t.bg, borderRadius: radius.pill, paddingHorizontal: small ? 8 : 10, height: small ? 22 : 26, alignItems: 'center', justifyContent: 'center' }}>
      <T size={small ? 11 : 12} weight="bold" color={t.ink} style={{ lineHeight: small ? 17 : 19 }}>{label}</T>
    </View>
  );
}

/** أعمدة أفقية لتوزيع التقديرات */
export function Bars({ items, total }: { items: { label: string; count: number; tone: Tone }[]; total: number }) {
  const { c, tone } = useTheme();
  return (
    <View style={{ gap: 10 }}>
      {items.map((b) => (
        <View key={b.label} style={{ gap: 4 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T size={13} weight="medium">{b.label}</T>
            <T size={13} dim>{arDigits(b.count)}{total ? ` · ${formatScore((b.count / total) * 100, 0)}٪` : ''}</T>
          </Row>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: c.line, overflow: 'hidden' }}>
            <View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: `${total ? (b.count / total) * 100 : 0}%`, backgroundColor: tone[b.tone].ink, borderRadius: 4 }} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** صف إعداد بمفتاح تشغيل */
export function ToggleRow({ title, subtitle, value, onChange, icon }: { title: string; subtitle?: string; value: boolean; onChange: (v: boolean) => void; icon?: IconName }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={() => { tap('select'); onChange(!value); }} accessibilityRole="switch" accessibilityState={{ checked: value }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 }}>
      {icon ? (
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={20} color={c.accent} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <T weight="bold" size={15}>{title}</T>
        {subtitle ? <T dim size={13}>{subtitle}</T> : null}
      </View>
      <Switch value={value} onValueChange={(v) => { tap('select'); onChange(v); }} trackColor={{ true: c.accent, false: c.line }} thumbColor="#FFFFFF" />
    </Pressable>
  );
}

/** عدّاد + − */
export function Stepper({ value, onChange, min = 0, max = 999, step = 1, suffix, format }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; suffix?: string; format?: (v: number) => string }) {
  const { c } = useTheme();
  const btn = (name: IconName, d: number, label: string) => (
    <PressScale accessibilityLabel={label} onPress={() => { tap('select'); onChange(Math.max(min, Math.min(max, value + d))); }} scaleTo={0.9}
      style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={name} size={18} color={c.accent} strokeWidth={2.2} />
    </PressScale>
  );
  return (
    <Row gap={10}>
      {btn('plus', step, 'زيادة')}
      <T weight="bold" size={17} style={{ minWidth: 56, textAlign: 'center' }}>{format ? format(value) : arDigits(value)}{suffix ? ` ${suffix}` : ''}</T>
      {btn('minus', -step, 'إنقاص')}
    </Row>
  );
}

/** شريط بحث */
export function SearchBar({ value, onChange, placeholder = 'بحث…' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 46, borderRadius: radius.pill, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, paddingHorizontal: 14 }}>
      <Icon name="search" size={18} color={c.ink3} />
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={c.ink3}
        style={{ flex: 1, fontFamily: fonts.regular, fontSize: 15, color: c.ink, writingDirection: 'rtl', textAlign: 'right', paddingVertical: 0 }} />
      {value ? (
        <Pressable onPress={() => onChange('')} hitSlop={10} accessibilityLabel="مسح">
          <Icon name="close" size={16} color={c.ink3} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** مجموعة بطاقات بعنوان صغير (مثل إعدادات) */
export function Group({ title, children, style }: { title?: string; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      {title ? <T size={13} weight="bold" dim style={{ paddingHorizontal: 4 }}>{title}</T> : null}
      <View style={[{ backgroundColor: c.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, paddingHorizontal: 16, paddingVertical: 4 }, style]}>
        {children}
      </View>
    </View>
  );
}

/** دائرة بلون الصف وحرف الشعبة */
export function SectionMark({ letter, hue, size = 44 }: { letter: string; hue: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.32, backgroundColor: hue, alignItems: 'center', justifyContent: 'center' }}>
      <T weight="bold" size={Math.round(size * 0.42)} color="#FFFFFF" style={{ lineHeight: Math.round(size * 0.62) }}>{letter}</T>
    </View>
  );
}
