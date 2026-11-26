import {
  arDigits, DAY_NAMES, DEFAULT_PLAN, formatClock, fromMinutes, generatePeriods, inferPlan, normalizeBreaks, periodName, toMinutes, WEEK_ORDER,
  type BreakDef, type PeriodTime,
} from '@nahj/shared';
import { router } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { Icon } from '@/components/icon';
import { Group, Stepper } from '@/components/kit';
import { PressScale } from '@/components/motion';
import { Sheet } from '@/components/sheet';
import { Button, Card, Chip, Divider, Header, Row, Screen, SectionTitle, T } from '@/components/ui';
import { all, getSettings, getTimetable, setSettings, useSettings } from '@/data/db';
import { Alert } from '@/lib/dialog';
import { ensurePermission, rescheduleAll } from '@/lib/notify';
import { useTheme } from '@/lib/theme';
import { toast } from '@/lib/toast';

const MAX_PERIODS = 10;

/** أوقات الدوام: الأيام، بداية الدوام، عدد الحصص ومدتها، الاستراحة، والفرص (أولى وثانية…)، وتعديل وقت أي حصة يدوياً */
export default function ScheduleSetup() {
  const { c, tone } = useTheme();
  const had = !!useSettings().timetable;
  const cur = getTimetable();
  // معاملات التوليد المحفوظة؛ الإعدادات القديمة (قبل حفظها) تُستنتج من الأوقات نفسها
  const saved = cur.plan ?? (getSettings().timetable ? inferPlan(cur.periods) : DEFAULT_PLAN);
  const [days, setDays] = useState<number[]>(cur.days);
  const [start, setStart] = useState(toMinutes(saved.start));
  const [count, setCount] = useState(Math.min(MAX_PERIODS, saved.count));
  const [length, setLength] = useState(saved.length);
  const [gap, setGap] = useState(saved.gap);
  const [breaks, setBreaks] = useState<BreakDef[]>(saved.breaks ?? []);
  const [remind, setRemind] = useState(cur.remind ?? 5);
  // أوقات عُدّلت يدوياً (تُلغى إن غُيّرت معاملات التوليد)
  const [manual, setManual] = useState<PeriodTime[] | null>(cur.plan?.manual ? cur.periods : null);
  const [editing, setEditing] = useState<number | null>(null);

  const generated = useMemo(() => generatePeriods({ start: fromMinutes(start), count, length, gap, breaks }), [start, count, length, gap, breaks]);
  const periods = manual && manual.length === count ? manual : generated;
  const validBreaks = normalizeBreaks(breaks, count);

  // أي تغيير في المعاملات يعيد توليد الأوقات (ويلغي التعديل اليدوي بعد التنبيه)
  const change = <V,>(set: (v: V) => void) => (v: V) => {
    if (manual) { setManual(null); toast('أُعيد حساب الأوقات من الإعدادات', { icon: 'refresh' }); }
    set(v);
  };

  const toggle = (d: number) => setDays((x) => (x.includes(d) ? x.filter((y) => y !== d) : [...x, d]));
  const addBreak = () => {
    const used = new Set(validBreaks.map((b) => b.after));
    // أول موضع متاح بعد آخر فرصة (الفرصة الثانية عادة بعد الحصة الخامسة)
    const last = validBreaks[validBreaks.length - 1]?.after ?? 0;
    let after = Math.min(count - 1, last ? last + 2 : 3);
    for (let i = after; i < count && used.has(after); i++) after = i;
    if (after < 1 || used.has(after)) { toast('لا مكان لفرصة أخرى — زِد عدد الحصص', { tone: 'bad', icon: 'info' }); return; }
    change(setBreaks)([...breaks, { after, length: 10 }]);
  };
  const setBreak = (i: number, patch: Partial<BreakDef>) => change(setBreaks)(breaks.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const delBreak = (i: number) => change(setBreaks)(breaks.filter((_, j) => j !== i));

  const lastEnd = periods[periods.length - 1]?.end ?? '00:00';
  const overflow = toMinutes(lastEnd) < toMinutes(periods[0]?.start ?? '00:00') || toMinutes(lastEnd) > 22 * 60;
  const lostSlots = all('slots').filter((s) => s.period >= count && (s.section_id || s.label)).length;

  const save = async () => {
    const write = async () => {
      setSettings({
        timetable: {
          days: [...days].sort((a, b) => a - b),
          periods,
          remind,
          plan: { start: fromMinutes(start), count, length, gap, breaks: validBreaks, manual: !!(manual && manual.length === count) },
        },
      });
      toast(had ? 'حُفظت أوقات الدوام' : 'الجدول جاهز — ضع شعبك في الحصص', { icon: 'check' });
      if (router.canGoBack()) router.back(); else router.replace('/schedule');
      // الإشعارات بعد الحفظ والرجوع: طلب الإذن لا يؤخر الحفظ ولا يعلّقه
      if (remind > 0 && getSettings().prefs.classReminders) {
        const ok = await ensurePermission(true).catch(() => false);
        if (!ok) toast('اسمح بالإشعارات من إعدادات الهاتف ليصلك التذكير', { icon: 'bell-off' });
      }
      rescheduleAll(true).catch(() => {});
    };
    if (lostSlots) {
      Alert.alert('حصص ستختفي من الجدول', `في جدولك ${arDigits(lostSlots)} حصة بعد الحصة ${periodName(count - 1)}. ستبقى محفوظة وتعود إن زدت عدد الحصص.`, [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'حفظ', onPress: () => { write(); } },
      ]);
      return;
    }
    await write();
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="أوقات الدوام" subtitle="تُضبط مرة واحدة ويمكن تغييرها في أي وقت" />

      <SectionTitle title="أيام الدوام" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {WEEK_ORDER.map((d) => <Chip key={d} label={DAY_NAMES[d]} active={days.includes(d)} onPress={() => toggle(d)} />)}
      </View>
      {!days.length ? <T size={13} color={tone.bad.ink}>اختر يوماً واحداً على الأقل.</T> : null}

      <SectionTitle title="الحصص" />
      <Group>
        <Line label="بداية الدوام" display={start < 720 ? 'دوام صباحي' : 'دوام مسائي'}
          value={<Stepper value={start} onChange={change(setStart)} min={6 * 60} max={18 * 60} step={5} format={(v) => formatClock(fromMinutes(v), true)} />} />
        <Divider />
        <Line label="عدد الحصص" value={<Stepper value={count} onChange={change(setCount)} min={1} max={MAX_PERIODS} />} />
        <Divider />
        <Line label="مدة الحصة" display="بالدقائق" value={<Stepper value={length} onChange={change(setLength)} min={20} max={90} step={5} />} />
        <Divider />
        <Line label="الاستراحة بين الحصص" display={gap ? 'بالدقائق' : 'الحصص متتالية'} value={<Stepper value={gap} onChange={change(setGap)} min={0} max={20} />} />
      </Group>

      <SectionTitle title="الفرص" action={validBreaks.length < count - 1 ? '+ إضافة فرصة' : undefined} onAction={addBreak} />
      <Group>
        {breaks.length === 0 ? (
          <View style={{ paddingVertical: 14, gap: 8 }}>
            <T dim size={13}>لا فرص. أضف الفرصة الأولى (وإن كان عندك فرصة ثانية أضفها أيضاً).</T>
            <Button title="إضافة فرصة" icon="plus" small variant="secondary" onPress={addBreak} />
          </View>
        ) : breaks.map((b, i) => {
          const valid = validBreaks.some((x) => x.after === b.after && x.length === b.length) && breaks.findIndex((x) => x.after === b.after) === i;
          return (
            <View key={i} style={{ paddingVertical: 10, gap: 8, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <T weight="bold" size={15}>الفرصة {periodName(i)}</T>
                <PressScale onPress={() => delBreak(i)} accessibilityLabel={`حذف الفرصة ${periodName(i)}`} hitSlop={8}>
                  <Icon name="trash" size={18} color={c.ink3} />
                </PressScale>
              </Row>
              <Line label="بعد الحصة" display={valid ? undefined : 'مكرّرة أو بعد آخر حصة — لن تُحسب'}
                value={<Stepper value={b.after} onChange={(v) => setBreak(i, { after: v })} min={1} max={Math.max(1, count - 1)} format={(v) => periodName(v - 1)} />} />
              <Line label="مدتها" display="بالدقائق" value={<Stepper value={b.length} onChange={(v) => setBreak(i, { length: v })} min={5} max={60} step={5} />} />
            </View>
          );
        })}
      </Group>

      <SectionTitle title="التذكير" />
      <Group>
        <Line label="قبل الحصة" display={remind ? 'إشعار على الهاتف' : 'بلا تذكير'} value={<Stepper value={remind} onChange={setRemind} min={0} max={30} />} />
      </Group>

      <SectionTitle title="الأوقات" />
      <Card style={{ gap: 2, paddingVertical: 8 }}>
        {periods.map((p, i) => {
          const br = validBreaks.find((b) => b.after === i + 1);
          return (
            <View key={i}>
              <PressScale onPress={() => setEditing(i)} scaleTo={0.98} accessibilityLabel={`تعديل وقت الحصة ${periodName(i)}`}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 9 }}>
                <T size={14} weight="medium">الحصة {periodName(i)}</T>
                <Row gap={8}>
                  <T size={14} weight="bold">{formatClock(p.start)} – {formatClock(p.end)}</T>
                  <Icon name="edit" size={14} color={c.ink3} />
                </Row>
              </PressScale>
              {br ? (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, backgroundColor: c.soft }}>
                  <T size={13} weight="bold" color={c.softInk}>الفرصة {periodName(validBreaks.indexOf(br))}</T>
                  <T size={13} color={c.softInk}>{arDigits(br.length)} دقيقة</T>
                </View>
              ) : null}
            </View>
          );
        })}
        <View style={{ height: 1, backgroundColor: c.line, marginVertical: 6 }} />
        <T size={13} dim>ينتهي الدوام {formatClock(lastEnd, true)}{manual ? ' · عُدّلت بعض الأوقات يدوياً' : ''}</T>
        {overflow ? <T size={13} color={tone.bad.ink}>الدوام يتجاوز العاشرة مساءً — راجع عدد الحصص ومددها.</T> : null}
      </Card>
      <T dim size={12}>اضغط على أي حصة لتعديل وقتها يدوياً إن كان دوام مدرستك غير منتظم.</T>

      <Button title={had ? 'حفظ التغييرات' : 'حفظ'} icon="check" disabled={!days.length} onPress={save} />

      <PeriodEditor index={editing} periods={periods} onClose={() => setEditing(null)}
        onSave={(i, p) => { const next = periods.map((x, j) => (j === i ? p : x)); setManual(next); setEditing(null); }} />
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

/** تعديل وقت حصة واحدة يدوياً */
function PeriodEditor({ index, periods, onClose, onSave }: {
  index: number | null; periods: PeriodTime[]; onClose: () => void; onSave: (i: number, p: PeriodTime) => void;
}) {
  const p = index != null ? periods[index] : null;
  return (
    <Sheet visible={!!p} onClose={onClose}>
      {p && index != null ? <PeriodForm key={index} index={index} p={p} prev={periods[index - 1]} next={periods[index + 1]} onSave={onSave} /> : null}
    </Sheet>
  );
}

function PeriodForm({ index, p, prev, next, onSave }: { index: number; p: PeriodTime; prev?: PeriodTime; next?: PeriodTime; onSave: (i: number, p: PeriodTime) => void }) {
  const { tone } = useTheme();
  const [a, setA] = useState(toMinutes(p.start));
  const [b, setB] = useState(toMinutes(p.end));
  const clash = (prev && a < toMinutes(prev.end)) || (next && b > toMinutes(next.start));
  const bad = b <= a;
  return (
    <View style={{ gap: 6 }}>
      <T display size={22}>الحصة {periodName(index)}</T>
      <Line label="تبدأ" value={<Stepper value={a} onChange={setA} min={5 * 60} max={23 * 60} step={5} format={(v) => formatClock(fromMinutes(v), true)} />} />
      <Line label="تنتهي" value={<Stepper value={b} onChange={setB} min={5 * 60} max={23 * 60} step={5} format={(v) => formatClock(fromMinutes(v), true)} />} />
      {bad ? <T size={13} color={tone.bad.ink}>وقت النهاية يجب أن يكون بعد البداية.</T> : clash ? <T size={13} color={tone.warn.ink}>تتداخل مع الحصة السابقة أو التالية.</T> : null}
      <Button title="تطبيق" icon="check" disabled={bad} onPress={() => onSave(index, { start: fromMinutes(a), end: fromMinutes(b) })} />
    </View>
  );
}
