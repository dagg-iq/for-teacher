import { DAY_NAMES, formatClock, fromMinutes, generatePeriods, periodName, toMinutes, WEEK_ORDER, type PeriodTime } from '@nahj/shared';
import { router } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { Group, Stepper } from '@/components/kit';
import { Button, Card, Chip, Header, Row, Screen, SectionTitle, T } from '@/components/ui';
import { getTimetable, setSettings, useSettings } from '@/data/db';
import { ensurePermission, rescheduleAll } from '@/lib/notify';
import { useTheme } from '@/lib/theme';
import { toast } from '@/lib/toast';

/** معالج أوقات الدوام: الأيام، بداية الدوام، عدد الحصص ومدتها والفرص */
export default function ScheduleSetup() {
  const { c } = useTheme();
  const had = !!useSettings().timetable;
  const cur = getTimetable();
  const firstLen = cur.periods[0] ? toMinutes(cur.periods[0].end) - toMinutes(cur.periods[0].start) : 45;
  const [days, setDays] = useState<number[]>(cur.days);
  const [start, setStart] = useState(toMinutes(cur.periods[0]?.start ?? '08:00'));
  const [count, setCount] = useState(cur.periods.length || 6);
  const [length, setLength] = useState(firstLen || 45);
  const [gap, setGap] = useState(5);
  const [breakAfter, setBreakAfter] = useState(3);
  const [breakLength, setBreakLength] = useState(15);
  const [remind, setRemind] = useState(cur.remind ?? 5);

  const periods: PeriodTime[] = useMemo(() => generatePeriods({ start: fromMinutes(start), count, length, gap, breakAfter, breakLength }), [start, count, length, gap, breakAfter, breakLength]);
  const toggle = (d: number) => setDays((x) => (x.includes(d) ? x.filter((y) => y !== d) : [...x, d]));

  const save = async () => {
    setSettings({ timetable: { days: [...days].sort(), periods, remind } });
    if (remind > 0) {
      const ok = await ensurePermission(true);
      if (!ok) toast('اسمح بالإشعارات من إعدادات الهاتف ليصلك التذكير', { icon: 'bell-off' });
    }
    rescheduleAll(true).catch(() => {});
    toast(had ? 'حُفظت أوقات الدوام' : 'الجدول جاهز — ضع شعبك في الحصص', { icon: 'check' });
    router.back();
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="أوقات الدوام" subtitle="تُضبط مرة واحدة ويمكن تغييرها في أي وقت" />
      <SectionTitle title="أيام الدوام" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {WEEK_ORDER.map((d) => <Chip key={d} label={DAY_NAMES[d]} active={days.includes(d)} onPress={() => toggle(d)} />)}
      </View>
      <SectionTitle title="الحصص" />
      <Group>
        <Line label="بداية الدوام" value={<Stepper value={start} onChange={setStart} min={6 * 60} max={18 * 60} step={5} format={(v) => formatClock(fromMinutes(v))} />} display={start < 720 ? 'صباحي' : 'مسائي'} />
        <Line label="عدد الحصص" value={<Stepper value={count} onChange={setCount} min={1} max={10} />} />
        <Line label="مدة الحصة (دقيقة)" value={<Stepper value={length} onChange={setLength} min={20} max={90} step={5} />} />
        <Line label="بين الحصص (دقيقة)" value={<Stepper value={gap} onChange={setGap} min={0} max={20} />} />
        <Line label="الفرصة بعد الحصة" value={<Stepper value={breakAfter} onChange={setBreakAfter} min={0} max={count} />} display={breakAfter ? periodName(breakAfter - 1) : 'بلا فرصة'} />
        {breakAfter ? <Line label="مدة الفرصة (دقيقة)" value={<Stepper value={breakLength} onChange={setBreakLength} min={5} max={40} step={5} />} /> : null}
        <Line label="التذكير قبل الحصة (دقيقة)" value={<Stepper value={remind} onChange={setRemind} min={0} max={30} />} display={remind ? undefined : 'بلا تذكير'} />
      </Group>
      <SectionTitle title="المعاينة" />
      <Card style={{ gap: 6 }}>
        {periods.map((p, i) => (
          <Row key={i} style={{ justifyContent: 'space-between' }}>
            <T size={14} weight="medium">الحصة {periodName(i)}</T>
            <T size={14} dim>{formatClock(p.start)} – {formatClock(p.end)}</T>
          </Row>
        ))}
        <View style={{ height: 1, backgroundColor: c.line, marginVertical: 4 }} />
        <T size={13} dim>ينتهي الدوام {formatClock(periods[periods.length - 1]?.end ?? '00:00', true)}</T>
      </Card>
      <Button title="حفظ" icon="check" disabled={!days.length} onPress={save} />
    </Screen>
  );
}

function Line({ label, value, display }: { label: string; value: ReactNode; display?: string }) {
  return (
    <Row style={{ justifyContent: 'space-between', paddingVertical: 10 }}>
      <View style={{ flex: 1 }}>
        <T weight="bold" size={14}>{label}</T>
        {display ? <T dim size={12}>{display}</T> : null}
      </View>
      {value}
    </Row>
  );
}
