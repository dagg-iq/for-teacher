import {
  arDigits, ATTENDANCE_LABEL, formatDayDate, isoDay, normalizeArabic, nowState, parseIsoDay, type AttendanceStatus, type Student,
} from '@nahj/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, Share, View } from 'react-native';
import { DateSheet } from '@/components/date-sheet';
import { Icon } from '@/components/icon';
import { Pill, SearchBar } from '@/components/kit';
import { PressScale, tap } from '@/components/motion';
import { Sheet, SheetItem } from '@/components/sheet';
import { Button, Card, Chip, Empty, Header, IconButton, Row, Screen, Segmented, T } from '@/components/ui';
import { all, getSettings, getTimetable, remove, upsertMany, useQuery, useSettings } from '@/data/db';
import { allSections, attendanceId, attendanceLog, attendanceOn, sectionLabel, studentsOf, type DayLog } from '@/data/queries';
import { Alert } from '@/lib/dialog';
import { exportAttendanceXlsx } from '@/lib/export';
import { useTheme } from '@/lib/theme';
import { toast } from '@/lib/toast';

const TONE = { present: 'good', absent: 'bad', late: 'warn', excused: 'info' } as const;
type Tab = 'take' | 'log';

export default function AttendanceScreen() {
  const params = useLocalSearchParams<{ section?: string; date?: string; tab?: string }>();
  const sections = useQuery(() => allSections());
  const [tab, setTab] = useState<Tab>(params.tab === 'log' ? 'log' : 'take');
  const [sectionId, setSectionId] = useState<string | null>(() => {
    if (params.section) return params.section;
    // الحصة الحالية إن وُجدت
    const st = nowState(getTimetable(), all('slots'), new Date());
    if (st.kind === 'in' && st.slot?.section_id) return st.slot.section_id;
    return null;
  });
  const [date, setDate] = useState(() => (params.date && params.date <= isoDay() ? params.date : isoDay()));
  const [menu, setMenu] = useState(false);

  const header = (
    <Header title="الحضور والغياب" subtitle={sectionId ? sectionLabel(sectionId) : undefined}
      right={(
        <>
          {sectionId ? <IconButton name="print" label="طباعة سجل الحضور" onPress={() => router.push(`/print?kind=attendance&id=${sectionId}`)} /> : null}
          <IconButton name="more-v" label="خيارات الحضور" onPress={() => setMenu(true)} />
        </>
      )} />
  );

  const menuSheet = (
    <Sheet visible={menu} onClose={() => setMenu(false)}>
      <T display size={20}>الحضور</T>
      {sectionId ? <SheetItem icon="print" label="طباعة سجل الحضور / PDF" onPress={() => { setMenu(false); router.push(`/print?kind=attendance&id=${sectionId}`); }} /> : null}
      {sectionId ? <SheetItem icon="excel" label="تصدير سجل الحضور Excel" onPress={() => { setMenu(false); exportAttendanceXlsx(sectionId).catch((e) => toast(String(e.message ?? e), { tone: 'bad' })); }} /> : null}
      {sectionId && tab === 'take' && attendanceOn(sectionId, date).size ? (
        <SheetItem icon="trash" label={`مسح تسجيل ${formatDayDate(parseIsoDay(date))}`} danger onPress={() => {
          setMenu(false);
          Alert.alert('مسح تسجيل هذا اليوم؟', 'يُحذف حضور هذا اليوم لهذه الشعبة كأنه لم يُسجَّل.', [
            { text: 'إلغاء', style: 'cancel' },
            { text: 'مسح', style: 'destructive', onPress: () => { for (const a of attendanceOn(sectionId, date).values()) remove('attendance', a.id); toast('مُسح تسجيل اليوم', { icon: 'trash' }); } },
          ]);
        }} />
      ) : null}
      <SheetItem icon="settings" label="إعدادات الحضور" onPress={() => { setMenu(false); router.push('/settings/attendance'); }} />
    </Sheet>
  );

  if (!sections.length) {
    return (
      <Screen>
        {header}
        <Card><Empty icon="school" title="لا شعب بعد" action="إضافة صف" onAction={() => router.push('/class/new')} /></Card>
        {menuSheet}
      </Screen>
    );
  }

  return (
    <Screen>
      {header}
      <Segmented<Tab> options={[{ key: 'take', label: 'تسجيل الحضور' }, { key: 'log', label: 'سجل الغياب' }]} value={tab} onChange={setTab} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {tab === 'log' ? <Chip label="كل الشعب" active={!sectionId} onPress={() => setSectionId(null)} /> : null}
        {sections.map((s) => <Chip key={s.id} label={sectionLabel(s.id, true)} active={s.id === sectionId} onPress={() => setSectionId(s.id)} />)}
      </ScrollView>
      {tab === 'take' ? (
        sectionId ? <Take sectionId={sectionId} date={date} onDate={setDate} /> : <PickSection onPick={setSectionId} />
      ) : (
        <Log sectionId={sectionId} onOpen={(sid, d) => { setSectionId(sid); setDate(d); setTab('take'); }} />
      )}
      {menuSheet}
    </Screen>
  );
}

function PickSection({ onPick }: { onPick: (id: string) => void }) {
  const sections = useQuery(() => allSections().map((s) => ({ s, taken: attendanceOn(s.id, isoDay()).size > 0 })));
  return (
    <>
      <T dim size={13}>اختر الشعبة لتسجيل حضور اليوم:</T>
      {sections.map(({ s, taken }) => (
        <Card key={s.id} onPress={() => onPick(s.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <T weight="bold" size={16}>{sectionLabel(s.id)}</T>
            <T dim size={13}>{taken ? 'سُجّل حضور اليوم' : 'لم يُسجّل اليوم بعد'}</T>
          </View>
          {taken ? <Pill small label="مسجّل" tone="good" /> : <Pill small label="لم يُسجّل" tone="warn" />}
        </Card>
      ))}
    </>
  );
}

/** تسجيل يوم واحد لشعبة */
function Take({ sectionId, date, onDate }: { sectionId: string; date: string; onDate: (d: string) => void }) {
  const { c, tone } = useTheme();
  const [pick, setPick] = useState(false);
  const students = useQuery(() => studentsOf(sectionId), [sectionId]);
  const marks = useQuery(() => attendanceOn(sectionId, date), [sectionId, date]);
  const takenDays = useQuery(() => new Set(attendanceLog(sectionId).map((d) => d.date)), [sectionId]);
  const taken = marks.size > 0;
  const today = isoDay();
  const statusOf = (id: string) => (marks.get(id)?.status ?? 'present') as AttendanceStatus;
  const offDay = !getTimetable().days.includes(parseIsoDay(date).getDay());

  const shift = (d: number) => {
    const x = parseIsoDay(date);
    x.setDate(x.getDate() + d);
    if (isoDay(x) > today) return;
    onDate(isoDay(x));
  };

  const write = (changes: { id: string; status: AttendanceStatus }[]) => {
    // أول تسجيل في اليوم: الباقون حاضرون (اليوم «مسجّل» ويظهر في السجل)
    const ids = new Set(changes.map((x) => x.id));
    const rest = taken ? [] : students.filter((s) => !ids.has(s.id)).map((s) => ({ id: s.id, status: 'present' as AttendanceStatus }));
    // طلاب أضيفوا بعد تسجيل اليوم: يُكتبون حاضرين أيضاً
    const missing = taken ? students.filter((s) => !marks.has(s.id) && !ids.has(s.id)).map((s) => ({ id: s.id, status: 'present' as AttendanceStatus })) : [];
    upsertMany('attendance', [...changes, ...rest, ...missing].map((x) => ({
      id: attendanceId(sectionId, date, x.id), data: { section_id: sectionId, student_id: x.id, date, status: x.status },
    })));
  };
  const setStatus = (studentId: string, status: AttendanceStatus) => { tap('select'); write([{ id: studentId, status }]); };
  const saveRest = () => { write([]); toast('سُجّل الحضور: الباقون حاضرون', { icon: 'check' }); };
  const everyonePresent = () => {
    const off = students.filter((s) => statusOf(s.id) !== 'present');
    const run = () => { write(students.map((s) => ({ id: s.id, status: 'present' as AttendanceStatus }))); toast('الكل حاضر', { icon: 'check' }); };
    if (!off.length) { run(); return; }
    Alert.alert('جعل الكل حاضراً؟', `سيُلغى تسجيل ${arDigits(off.length)} (غياب/تأخير/إجازة) لهذا اليوم.`, [{ text: 'إلغاء', style: 'cancel' }, { text: 'الكل حاضر', onPress: run }]);
  };

  const counts = { present: 0, absent: 0, late: 0, excused: 0 } as Record<AttendanceStatus, number>;
  for (const s of students) counts[statusOf(s.id)]++;
  const absentees = students.filter((s) => statusOf(s.id) === 'absent');
  const prof = getSettings().profile;

  return (
    <>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 }}>
        <IconButton name="back" label="اليوم السابق" size={40} onPress={() => shift(-1)} />
        <PressScale onPress={() => setPick(true)} accessibilityLabel="اختيار التاريخ" style={{ flex: 1, alignItems: 'center' }}>
          <Row gap={6}>
            <Icon name="calendar" size={16} color={c.accent} />
            <T weight="bold" size={16}>{formatDayDate(parseIsoDay(date))}</T>
          </Row>
          <T dim size={12}>{date === today ? 'اليوم · ' : ''}{taken ? 'مسجّل' : 'لم يُسجّل بعد'}{offDay ? ' · ليس يوم دوام' : ''}</T>
        </PressScale>
        <View style={{ opacity: date >= today ? 0.3 : 1 }}><IconButton name="forward" label="اليوم التالي" size={40} onPress={date >= today ? undefined : () => shift(1)} /></View>
      </Card>
      <Row gap={6} style={{ flexWrap: 'wrap' }}>
        {(['present', 'absent', 'late', 'excused'] as AttendanceStatus[]).map((st) => <Pill key={st} label={`${ATTENDANCE_LABEL[st]}: ${arDigits(counts[st])}`} tone={TONE[st]} />)}
      </Row>
      <T dim size={12}>اضغط الاسم ليصبح غائباً (ومرة أخرى ليعود حاضراً). «متأخر» و«مُجاز» بالزرين.</T>
      <Card style={{ paddingVertical: 4 }}>
        {students.length === 0 ? <Empty icon="users" title="لا طلاب" action="إضافة طلاب" onAction={() => router.push(`/section/${sectionId}`)} /> : students.map((s, i) => {
          const st = statusOf(s.id);
          const t = tone[TONE[st]];
          const mini = (k: AttendanceStatus, label: string) => (
            <PressScale key={k} onPress={() => setStatus(s.id, st === k ? 'present' : k)} scaleTo={0.92} accessibilityLabel={`${s.name}: ${label}`} accessibilityState={{ selected: st === k }}
              style={{ height: 36, paddingHorizontal: 10, borderRadius: 18, borderWidth: 1, borderColor: st === k ? 'transparent' : c.line, backgroundColor: st === k ? tone[TONE[k]].bg : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
              <T size={12} weight="bold" color={st === k ? tone[TONE[k]].ink : c.ink3} style={{ lineHeight: 18 }}>{label}</T>
            </PressScale>
          );
          return (
            <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
              <PressScale onPress={() => setStatus(s.id, st === 'absent' ? 'present' : 'absent')} scaleTo={0.98} accessibilityLabel={`${s.name}: ${ATTENDANCE_LABEL[st]}`}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}>
                <T dim size={12} weight="bold" style={{ width: 24, textAlign: 'center' }}>{arDigits(i + 1)}</T>
                <T size={15} weight="medium" style={{ flex: 1 }} lines={2} color={st === 'absent' ? t.ink : c.ink}>{s.name}</T>
                <View style={{ minWidth: 58, height: 30, borderRadius: 15, backgroundColor: taken || st !== 'present' ? t.bg : c.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }}>
                  <T size={12} weight="bold" color={taken || st !== 'present' ? t.ink : c.ink3} style={{ lineHeight: 18 }}>{ATTENDANCE_LABEL[st]}</T>
                </View>
              </PressScale>
              {mini('late', 'متأخر')}
              {mini('excused', 'مُجاز')}
            </View>
          );
        })}
      </Card>
      {students.length ? (
        <Row gap={8}>
          {taken
            ? <Button title="الكل حاضر" icon="check-double" variant="secondary" style={{ flex: 1 }} onPress={everyonePresent} />
            : <Button title="حفظ: الباقون حاضرون" icon="check" style={{ flex: 1 }} onPress={saveRest} />}
          {absentees.length ? (
            <Button title="مشاركة الغائبين" icon="share" variant="secondary" onPress={() => Share.share({
              message: `الغائبون — ${sectionLabel(sectionId)}${prof?.subject ? ` — ${prof.subject}` : ''}\n${formatDayDate(parseIsoDay(date)).replace(/[⁦⁩]/g, '')}:\n${absentees.map((s, i) => `${arDigits(i + 1)}. ${s.name}`).join('\n')}${prof?.name ? `\n\n${prof.gender === 'f' ? 'المدرّسة' : 'المدرّس'} ${prof.name}` : ''}`,
            }).catch(() => {})} />
          ) : null}
        </Row>
      ) : null}
      <DateSheet visible={pick} value={date} onClose={() => setPick(false)} onPick={onDate} marked={takenDays}
        offDays={[0, 1, 2, 3, 4, 5, 6].filter((d) => !getTimetable().days.includes(d))} />
    </>
  );
}

/** سجل الغياب: كل يوم سُجّل فيه حضور، ومن غاب أو تأخر أو أُجيز بالأسماء */
function Log({ sectionId, onOpen }: { sectionId: string | null; onOpen: (sid: string, date: string) => void }) {
  const { c, tone } = useTheme();
  const prefs = useSettings().prefs;
  const [filter, setFilter] = useState<'all' | 'absent' | 'late' | 'excused'>('all');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(40);
  const log = useQuery(() => attendanceLog(sectionId), [sectionId]);
  const qn = normalizeArabic(q);
  const has = (list: Student[]) => !qn || list.some((s) => normalizeArabic(s.name).includes(qn));
  const days = useMemo(() => log.filter((d) => {
    if (filter !== 'all' && !d[filter].length) return false;
    if (!qn) return true;
    return has(filter === 'all' ? [...d.absent, ...d.late, ...d.excused] : d[filter]);
  }), [log, filter, qn]); // eslint-disable-line react-hooks/exhaustive-deps

  // أيام دوام لم يُسجّل فيها حضور (آخر ٣٠ يوماً، لشعبة محددة)
  const missing = useMemo(() => {
    if (!sectionId || filter !== 'all' || qn) return [];
    const cfg = getTimetable();
    const have = new Set(log.map((d) => d.date));
    const first = log.length ? log[log.length - 1].date : isoDay();
    const out: string[] = [];
    for (let i = 0; i < 30; i++) {
      const x = new Date(); x.setDate(x.getDate() - i);
      const d = isoDay(x);
      if (d < first) break;
      if (cfg.days.includes(x.getDay()) && !have.has(d)) out.push(d);
    }
    return out;
  }, [log, sectionId, filter, qn]);

  // الأكثر غياباً في المعروض
  const top = useMemo(() => {
    const m = new Map<string, { s: Student; n: number }>();
    for (const d of log) for (const s of [...d.absent, ...(prefs.excusedCounts ? d.excused : [])]) m.set(s.id, { s, n: (m.get(s.id)?.n ?? 0) + 1 });
    return [...m.values()].sort((a, b) => b.n - a.n).slice(0, 8);
  }, [log, prefs.excusedCounts]);

  // تجميع بالشهر
  const groups: { key: string; items: DayLog[] }[] = [];
  for (const d of days.slice(0, limit)) {
    const key = d.date.slice(0, 7);
    if (groups[groups.length - 1]?.key !== key) groups.push({ key, items: [] });
    groups[groups.length - 1].items.push(d);
  }

  if (!log.length) return <Card><Empty icon="check-square" title="لا أيام مسجّلة بعد" body="سجّل الحضور من «تسجيل الحضور» فتظهر الأيام هنا مع أسماء الغائبين." /></Card>;

  return (
    <>
      {top.length ? (
        <Card style={{ gap: 8 }}>
          <T weight="bold" size={14}>الأكثر غياباً</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {top.map((x) => (
              <PressScale key={x.s.id} onPress={() => router.push(`/student/${x.s.id}`)}>
                <Pill small label={`${x.s.name} · ${arDigits(x.n)}`} tone={x.n >= prefs.absenceAlert ? 'bad' : 'warn'} />
              </PressScale>
            ))}
          </View>
        </Card>
      ) : null}
      <SearchBar value={q} onChange={setQ} placeholder="ابحث عن طالب في السجل" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {([['all', 'كل الأيام'], ['absent', 'فيها غياب'], ['late', 'فيها تأخير'], ['excused', 'فيها إجازة']] as const).map(([k, l]) => (
          <Chip key={k} small label={l} active={filter === k} onPress={() => setFilter(k)} />
        ))}
      </ScrollView>
      {missing.length ? (
        <Card tone="soft" style={{ gap: 6 }}>
          <T weight="bold" size={14} color={c.softInk}>أيام دوام لم يُسجّل فيها الحضور ({arDigits(missing.length)})</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {missing.slice(0, 12).map((d) => <Chip key={d} small label={formatDayDate(parseIsoDay(d))} onPress={() => onOpen(sectionId!, d)} />)}
          </View>
        </Card>
      ) : null}
      {!days.length ? <Card><T dim center>لا نتائج</T></Card> : null}
      {groups.map((g) => (
        <View key={g.key} style={{ gap: 8 }}>
          <Row gap={8}><View style={{ width: 8, height: 8, backgroundColor: c.gold }} /><T weight="bold" size={15}>{arDigits(`${g.key.slice(5)}/${g.key.slice(0, 4)}`)}</T><T dim size={12}>({arDigits(g.items.length)} يوم)</T></Row>
          <Card style={{ paddingVertical: 4 }}>
            {g.items.map((d, i) => {
              const all0 = !d.absent.length && !d.late.length && !d.excused.length;
              const line = (label: string, list: Student[], t: 'bad' | 'warn' | 'info') => list.length && (filter === 'all' || filter === (t === 'bad' ? 'absent' : t === 'warn' ? 'late' : 'excused')) ? (
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                  <View style={{ marginTop: 2 }}><Pill small label={`${label} ${arDigits(list.length)}`} tone={t} /></View>
                  <T size={13} style={{ flex: 1, lineHeight: 22 }} color={tone[t].ink}>{list.map((s) => s.name).join('، ')}</T>
                </View>
              ) : null;
              return (
                <PressScale key={`${d.sectionId}|${d.date}`} onPress={() => onOpen(d.sectionId, d.date)} scaleTo={0.99}
                  style={{ paddingVertical: 12, gap: 6, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <T weight="bold" size={14}>{formatDayDate(parseIsoDay(d.date))}</T>
                    {!sectionId ? <T dim size={12}>{sectionLabel(d.sectionId, true)}</T> : null}
                    {all0 ? <Pill small label="الكل حاضر" tone="good" /> : null}
                  </Row>
                  {line('غائب', d.absent, 'bad')}
                  {line('متأخر', d.late, 'warn')}
                  {line('مُجاز', d.excused, 'info')}
                </PressScale>
              );
            })}
          </Card>
        </View>
      ))}
      {days.length > limit ? <Button title={`عرض المزيد (${arDigits(days.length - limit)})`} variant="secondary" small onPress={() => setLimit(limit + 40)} /> : null}
    </>
  );
}
