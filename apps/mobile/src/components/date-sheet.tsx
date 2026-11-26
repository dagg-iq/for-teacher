/** اختيار تاريخ من تقويم شهري (الأسبوع يبدأ السبت كما في المدارس العراقية) */
import { arDigits, isoDay, parseIsoDay } from '@nahj/shared';
import { useState } from 'react';
import { View } from 'react-native';
import { PressScale } from './motion';
import { Sheet } from './sheet';
import { Button, IconButton, Row, T } from './ui';
import { useTheme } from '@/lib/theme';

const HEAD = ['سبت', 'أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة'];

export function DateSheet({ visible, value, onClose, onPick, max, marked, offDays }: {
  visible: boolean;
  value: string;
  onClose: () => void;
  onPick: (day: string) => void;
  /** آخر يوم مسموح (افتراضياً اليوم) */
  max?: string;
  /** أيام عليها علامة (مثلاً: سُجّل فيها الحضور) */
  marked?: Set<string>;
  /** أيام العطلة الأسبوعية (٠ = الأحد … ٦ = السبت) تظهر باهتة */
  offDays?: number[];
}) {
  const { c } = useTheme();
  const start = parseIsoDay(value);
  const [ym, setYm] = useState({ y: start.getFullYear(), m: start.getMonth() });
  const limit = max ?? isoDay();
  const first = new Date(ym.y, ym.m, 1);
  const lead = (first.getDay() + 1) % 7; // السبت أول الأسبوع
  const days = new Date(ym.y, ym.m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array.from({ length: lead }, () => null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const shift = (d: number) => setYm(({ y, m }) => { const x = new Date(y, m + d, 1); return { y: x.getFullYear(), m: x.getMonth() }; });
  const nextDisabled = isoDay(new Date(ym.y, ym.m + 1, 1)) > limit;

  return (
    <Sheet visible={visible} onClose={onClose}>
      <Row style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <IconButton name="back" label="الشهر السابق" size={40} onPress={() => shift(-1)} />
        <T weight="bold" size={18}>{arDigits(`${String(ym.m + 1).padStart(2, '0')}/${ym.y}`)}</T>
        <View style={{ opacity: nextDisabled ? 0.3 : 1 }}><IconButton name="forward" label="الشهر التالي" size={40} onPress={nextDisabled ? undefined : () => shift(1)} /></View>
      </Row>
      <View style={{ flexDirection: 'row' }}>
        {HEAD.map((h) => <T key={h} dim size={11} weight="bold" center style={{ flex: 1 }}>{h}</T>)}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
        {cells.map((d, i) => {
          if (d == null) return <View key={i} style={{ width: `${100 / 7}%`, height: 44 }} />;
          const day = isoDay(new Date(ym.y, ym.m, d));
          const future = day > limit;
          const sel = day === value;
          const off = offDays?.includes(new Date(ym.y, ym.m, d).getDay());
          return (
            <View key={i} style={{ width: `${100 / 7}%`, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <PressScale disabled={future} onPress={() => { onPick(day); onClose(); }} accessibilityLabel={day}
                style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: sel ? c.accent : 'transparent', opacity: future ? 0.25 : off ? 0.5 : 1 }}>
                <T weight={sel ? 'bold' : 'medium'} size={14} color={sel ? c.accentInk : day === isoDay() ? c.accent : c.ink}>{arDigits(d)}</T>
                {marked?.has(day) && !sel ? <View style={{ position: 'absolute', bottom: 4, width: 5, height: 5, borderRadius: 3, backgroundColor: c.gold }} /> : null}
              </PressScale>
            </View>
          );
        })}
      </View>
      <Row gap={8} style={{ marginTop: 8 }}>
        <Button title="اليوم" small variant="secondary" style={{ flex: 1 }} onPress={() => { onPick(isoDay()); onClose(); }} />
      </Row>
    </Sheet>
  );
}
