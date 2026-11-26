import { formatDayDate, formatTime, isoDay, parseIsoDay } from '@nahj/shared';
import { useState } from 'react';
import { View } from 'react-native';
import { DateSheet } from './date-sheet';
import { Icon } from './icon';
import { Stepper } from './kit';
import { PressScale } from './motion';
import { Chip, IconButton, Row, T } from './ui';
import { useTheme } from '@/lib/theme';

/** اختيار تاريخ ووقت بلا لوحة النظام: اختصارات، تقويم شهري، ويوم سابق/تالٍ، والوقت بخطوات ربع ساعة */
export function WhenPicker({ value, onChange, withTime = true }: { value: Date; onChange: (d: Date) => void; withTime?: boolean }) {
  const { c } = useTheme();
  const [cal, setCal] = useState(false);
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
      <Row gap={8}>
        <IconButton name="back" label="اليوم السابق" size={38} onPress={() => set((d) => d.setDate(d.getDate() - 1))} />
        <PressScale onPress={() => setCal(true)} accessibilityLabel="اختيار التاريخ من التقويم"
          style={{ flex: 1, height: 42, borderRadius: 14, borderWidth: 1, borderColor: c.line, backgroundColor: c.field, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Icon name="calendar" size={16} color={c.accent} />
          <T weight="bold" size={14}>{formatDayDate(value)}</T>
        </PressScale>
        <IconButton name="forward" label="اليوم التالي" size={38} onPress={() => set((d) => d.setDate(d.getDate() + 1))} />
      </Row>
      {withTime ? (
        <Row style={{ justifyContent: 'space-between' }}>
          <T weight="bold" size={14}>الوقت</T>
          <Stepper value={minutes} onChange={(v) => set((d) => d.setHours(Math.floor(v / 60), v % 60, 0, 0))} min={0} max={23 * 60 + 45} step={15} format={() => formatTime(value)} />
        </Row>
      ) : null}
      <DateSheet visible={cal} value={isoDay(value)} max="2100-01-01" onClose={() => setCal(false)}
        onPick={(day) => set((d) => { const x = parseIsoDay(day); d.setFullYear(x.getFullYear(), x.getMonth(), x.getDate()); })} />
    </View>
  );
}
