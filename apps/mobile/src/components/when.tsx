import { formatDayDate, formatTime } from '@nahj/shared';
import { View } from 'react-native';
import { Stepper } from './kit';
import { Chip, Row, T } from './ui';

/** اختيار تاريخ ووقت بلا لوحة نظام: اختصارات + أزرار زيادة/إنقاص */
export function WhenPicker({ value, onChange, withTime = true }: { value: Date; onChange: (d: Date) => void; withTime?: boolean }) {
  const set = (fn: (d: Date) => void) => { const d = new Date(value); fn(d); onChange(d); };
  const quick = (days: number) => set((d) => { const t = new Date(); d.setFullYear(t.getFullYear(), t.getMonth(), t.getDate() + days); });
  const minutes = value.getHours() * 60 + value.getMinutes();
  return (
    <View style={{ gap: 10 }}>
      <Row gap={8} style={{ flexWrap: 'wrap' }}>
        <Chip small label="اليوم" onPress={() => quick(0)} />
        <Chip small label="غداً" onPress={() => quick(1)} />
        <Chip small label="بعد غد" onPress={() => quick(2)} />
        <Chip small label="بعد أسبوع" onPress={() => quick(7)} />
      </Row>
      <Row style={{ justifyContent: 'space-between' }}>
        <T weight="bold" size={14} style={{ flex: 1 }}>{formatDayDate(value)}</T>
        <Stepper value={0} onChange={(v) => set((d) => d.setDate(d.getDate() + v))} min={-1} max={1} format={() => 'يوم'} />
      </Row>
      {withTime ? (
        <Row style={{ justifyContent: 'space-between' }}>
          <T weight="bold" size={14}>الوقت</T>
          <Stepper value={minutes} onChange={(v) => set((d) => d.setHours(Math.floor(v / 60), v % 60, 0, 0))} min={0} max={23 * 60 + 45} step={15} format={() => formatTime(value)} />
        </Row>
      ) : null}
    </View>
  );
}
