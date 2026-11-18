import {
  arDigits, countPeriods, DAY_NAMES, DAY_SHORT, formatClock, nowState, periodName, toMinutes, WEEK_ORDER, weeklyLoad, type Slot,
} from '@midad/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Icon } from '@/components/icon';
import { Pill } from '@/components/kit';
import { PressScale } from '@/components/motion';
import { Sheet } from '@/components/sheet';
import { Button, Card, Chip, Empty, Field, Header, IconButton, Row, Screen, Segmented, T } from '@/components/ui';
import { all, getTimetable, insert, remove, update, useQuery, useSettings } from '@/data/db';
import { allSections, sectionClass, sectionLabel } from '@/data/queries';
import { printTimetable } from '@/lib/export';
import { useNow } from '@/lib/hooks';
import { useTheme } from '@/lib/theme';
import { toast } from '@/lib/toast';

export default function Schedule() {
  const { c, hue } = useTheme();
  const settings = useSettings();
  const now = useNow();
  const cfg = getTimetable();
  const days = WEEK_ORDER.filter((d) => cfg.days.includes(d));
  const [day, setDay] = useState(() => (cfg.days.includes(now.getDay()) ? now.getDay() : days[0] ?? 0));
  const [view, setView] = useState<'day' | 'week'>('day');
  const [edit, setEdit] = useState<{ day: number; period: number } | null>(null);
  const slots = useQuery(() => all('slots'));
  const load = useQuery(() => weeklyLoad(all('slots')));
  const total = slots.filter((s) => s.section_id || s.label).length;

  if (!settings.timetable) {
    return (
      <Screen>
        <Header back={false} title="الجدول" />
        <Card>
          <Empty icon="calendar" title="جدول حصصك" body="حدد أيام الدوام وأوقات الحصص مرة واحدة، ثم ضع شعبك في الجدول. سيذكّرك مِداد قبل كل حصة." action="إعداد الجدول" onAction={() => router.push('/schedule/setup')} />
        </Card>
      </Screen>
    );
  }

  const st = nowState(cfg, slots, now);
  const slotAt = (d: number, p: number) => slots.find((s) => s.day === d && s.period === p);

  return (
    <Screen>
      <Header back={false} title="الجدول" subtitle={`${countPeriods(total)} في الأسبوع`}
        right={(
          <>
            <IconButton name="print" label="طباعة الجدول" onPress={() => printTimetable().catch((e) => toast(String(e.message ?? e), { tone: 'bad' }))} />
            <IconButton name="settings" label="أوقات الدوام" onPress={() => router.push('/schedule/setup')} />
          </>
        )} />
      <Segmented options={[{ key: 'day', label: 'اليوم' }, { key: 'week', label: 'الأسبوع' }]} value={view} onChange={setView} />

      {view === 'day' ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {days.map((d) => (
              <Chip key={d} label={`${DAY_NAMES[d]}${d === now.getDay() ? ' · اليوم' : ''}`} active={day === d} onPress={() => setDay(d)} />
            ))}
          </ScrollView>
          <View style={{ gap: 10 }}>
            {cfg.periods.map((p, i) => {
              const s = slotAt(day, i);
              const k = s?.section_id ? sectionClass(s.section_id) : undefined;
              const live = day === now.getDay() && st.kind === 'in' && st.period === i;
              const past = day === now.getDay() && toMinutes(p.end) <= now.getHours() * 60 + now.getMinutes();
              return (
                <PressScale key={i} onPress={() => setEdit({ day, period: i })} scaleTo={0.98} accessibilityLabel={`الحصة ${periodName(i)}`}
                  style={{
                    flexDirection: 'row', alignItems: 'stretch', gap: 12, backgroundColor: live ? c.heroBg : c.card, borderRadius: 22,
                    borderWidth: live ? 0 : 1, borderColor: c.line, padding: 14, opacity: past && !live ? 0.6 : 1,
                  }}>
                  <View style={{ width: 62, alignItems: 'center', justifyContent: 'center' }}>
                    <T size={12} weight="bold" color={live ? c.heroInk2 : c.ink2}>{periodName(i)}</T>
                    <T size={15} weight="bold" color={live ? c.heroInk : c.ink}>{formatClock(p.start)}</T>
                    <T size={11} color={live ? c.heroInk2 : c.ink3}>{formatClock(p.end)}</T>
                  </View>
                  <View style={{ width: 4, borderRadius: 2, backgroundColor: k ? hue(k.hue) : s?.label ? c.ink3 : c.line }} />
                  <View style={{ flex: 1, justifyContent: 'center' }}>
                    {s && (s.section_id || s.label) ? (
                      <>
                        <T weight="bold" size={16} color={live ? c.heroInk : c.ink} lines={1}>{s.section_id ? sectionLabel(s.section_id) : s.label}</T>
                        <T size={12} color={live ? c.heroInk2 : c.ink2}>{[k?.subject, s.room].filter(Boolean).join(' · ') || ' '}</T>
                      </>
                    ) : (
                      <T size={14} color={live ? c.heroInk2 : c.ink3}>فراغ — اضغط لإضافة حصة</T>
                    )}
                  </View>
                  {live ? <View style={{ alignSelf: 'center' }}><Pill small label="الآن" tone="info" /></View> : null}
                </PressScale>
              );
            })}
          </View>
        </>
      ) : (
        <WeekGrid days={days} onCell={(d, p) => setEdit({ day: d, period: p })} today={now.getDay()} />
      )}

      {load.size ? (
        <Card style={{ gap: 8 }}>
          <T weight="bold" size={15}>نصابك الأسبوعي</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {[...load.entries()].map(([sid, n]) => <Pill key={sid} label={`${sectionLabel(sid, true)}: ${arDigits(n)}`} tone="neutral" />)}
          </View>
        </Card>
      ) : null}
      <View style={{ height: 150 }} />
      {edit ? <SlotEditor day={edit.day} period={edit.period} slot={slotAt(edit.day, edit.period)} onClose={() => setEdit(null)} /> : null}
    </Screen>
  );
}

function WeekGrid({ days, onCell, today }: { days: number[]; onCell: (d: number, p: number) => void; today: number }) {
  const { c, hue } = useTheme();
  const cfg = getTimetable();
  const slots = useQuery(() => all('slots'));
  const W = 92;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <View style={{ width: 54 }} />
          {cfg.periods.map((p, i) => (
            <View key={i} style={{ width: W, alignItems: 'center' }}>
              <T size={12} weight="bold">{periodName(i)}</T>
              <T size={10} dim>{formatClock(p.start)}</T>
            </View>
          ))}
        </View>
        {days.map((d) => (
          <View key={d} style={{ flexDirection: 'row', gap: 6 }}>
            <View style={{ width: 54, justifyContent: 'center' }}>
              <T size={13} weight="bold" color={d === today ? c.accent : c.ink}>{DAY_SHORT[d]}</T>
            </View>
            {cfg.periods.map((_, i) => {
              const s = slots.find((x) => x.day === d && x.period === i);
              const k = s?.section_id ? sectionClass(s.section_id) : undefined;
              const sec = s?.section_id ? allSections().find((x) => x.id === s.section_id) : undefined;
              return (
                <PressScale key={i} onPress={() => onCell(d, i)} scaleTo={0.94}
                  style={{ width: W, height: 58, borderRadius: 14, backgroundColor: k ? hue(k.hue) : s?.label ? c.soft : c.card, borderWidth: k || s?.label ? 0 : 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center', padding: 4 }}>
                  {k ? (
                    <>
                      <T size={11} weight="bold" color="#FFFFFF" lines={1}>{k.name.replace(/^ال/, '')}</T>
                      <T size={13} weight="bold" color="#FFFFFF">{sec?.name}</T>
                    </>
                  ) : s?.label ? <T size={11} weight="bold" color={c.softInk} lines={2} center>{s.label}</T> : <Icon name="plus" size={14} color={c.ink3} />}
                </PressScale>
              );
            })}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function SlotEditor({ day, period, slot, onClose }: { day: number; period: number; slot?: Slot; onClose: () => void }) {
  const { c } = useTheme();
  const sections = allSections();
  const [section, setSection] = useState<string | null>(slot?.section_id ?? null);
  const [label, setLabel] = useState(slot?.label ?? '');
  const [room, setRoom] = useState(slot?.room ?? '');
  const cfg = getTimetable();
  const p = cfg.periods[period];
  const save = () => {
    const data = { day, period, section_id: section, label: section ? null : label.trim() || null, room: room.trim() || (section ? sections.find((s) => s.id === section)?.room ?? null : null) };
    if (!data.section_id && !data.label) { if (slot) remove('slots', slot.id); onClose(); return; }
    if (slot) update('slots', slot.id, data);
    else insert('slots', data);
    onClose();
  };
  return (
    <Sheet visible onClose={onClose}>
      <T display size={22}>{DAY_NAMES[day]} — الحصة {periodName(period)}</T>
      {p ? <T dim size={13}>{formatClock(p.start, true)} – {formatClock(p.end, true)}</T> : null}
      <View style={{ gap: 12, marginTop: 10 }}>
        <T weight="bold" size={14}>الشعبة</T>
        {sections.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {sections.map((s) => <Chip key={s.id} label={sectionLabel(s.id, true)} active={section === s.id} onPress={() => setSection(section === s.id ? null : s.id)} />)}
          </View>
        ) : <T dim size={13}>أضف صفوفك أولاً من تبويب الصفوف.</T>}
        {!section ? <Field label="أو عنوان آخر" value={label} onChangeText={setLabel} placeholder="مثال: إشراف، ريادة، نشاط" /> : null}
        <Field label="القاعة (اختياري)" value={room} onChangeText={setRoom} />
        <Row gap={8}>
          {slot ? <Button title="إفراغ" variant="danger" small onPress={() => { remove('slots', slot.id); onClose(); }} /> : null}
          <Button title="حفظ" icon="check" style={{ flex: 1 }} onPress={save} />
        </Row>
        <View style={{ height: 1, backgroundColor: c.line }} />
      </View>
    </Sheet>
  );
}
