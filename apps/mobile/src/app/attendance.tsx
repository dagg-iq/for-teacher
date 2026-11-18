import {
  arDigits, ATTENDANCE_LABEL, formatDayDate, isoDay, nowState, parseIsoDay, type AttendanceStatus,
} from '@rasd/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Share, View } from 'react-native';
import { Pill } from '@/components/kit';
import { PressScale, tap } from '@/components/motion';
import { Button, Card, Chip, Empty, Header, IconButton, Row, Screen, T } from '@/components/ui';
import { all, getTimetable, upsertMany, useQuery } from '@/data/db';
import { allSections, attendanceId, attendanceOn, sectionLabel, studentsOf } from '@/data/queries';
import { exportAttendanceXlsx } from '@/lib/export';
import { useTheme } from '@/lib/theme';
import { toast } from '@/lib/toast';

const ORDER: AttendanceStatus[] = ['present', 'absent', 'late', 'excused'];
const TONE = { present: 'good', absent: 'bad', late: 'warn', excused: 'info' } as const;

export default function AttendanceScreen() {
  const params = useLocalSearchParams<{ section?: string; date?: string }>();
  const { c, tone } = useTheme();
  const sections = useQuery(() => allSections());
  const [sectionId, setSectionId] = useState<string | null>(() => {
    if (params.section) return params.section;
    // الحصة الحالية إن وُجدت
    const st = nowState(getTimetable(), all('slots'), new Date());
    if (st.kind === 'in' && st.slot?.section_id) return st.slot.section_id;
    return null;
  });
  const [date, setDate] = useState(params.date ?? isoDay());
  const students = useQuery(() => (sectionId ? studentsOf(sectionId) : []), [sectionId]);
  const marks = useQuery(() => (sectionId ? attendanceOn(sectionId, date) : new Map()), [sectionId, date]);
  const taken = marks.size > 0;

  const shift = (d: number) => {
    const x = parseIsoDay(date);
    x.setDate(x.getDate() + d);
    if (isoDay(x) > isoDay()) return;
    setDate(isoDay(x));
  };

  const setStatus = (studentId: string, status: AttendanceStatus) => {
    if (!sectionId) return;
    tap('select');
    // أول تعديل في اليوم: الباقون حاضرون
    const items = (taken ? [] : students.filter((s) => s.id !== studentId)).map((s) => ({
      id: attendanceId(sectionId, date, s.id), data: { section_id: sectionId, student_id: s.id, date, status: 'present' as AttendanceStatus },
    }));
    items.push({ id: attendanceId(sectionId, date, studentId), data: { section_id: sectionId, student_id: studentId, date, status } });
    upsertMany('attendance', items);
  };
  const allPresent = () => {
    if (!sectionId) return;
    upsertMany('attendance', students.map((s) => ({
      id: attendanceId(sectionId, date, s.id), data: { section_id: sectionId, student_id: s.id, date, status: (marks.get(s.id)?.status ?? 'present') as AttendanceStatus },
    })));
    toast('سُجّل الحضور', { icon: 'check' });
  };

  const count = (st: AttendanceStatus) => students.filter((s) => (marks.get(s.id)?.status ?? 'present') === st).length;
  const absentees = students.filter((s) => marks.get(s.id)?.status === 'absent');

  if (!sectionId) {
    return (
      <Screen>
        <Header title="الحضور والغياب" subtitle="اختر الشعبة" />
        {sections.length ? sections.map((s) => (
          <Card key={s.id} onPress={() => setSectionId(s.id)}>
            <T weight="bold" size={16}>{sectionLabel(s.id)}</T>
            <T dim size={13}>{attendanceOn(s.id, isoDay()).size ? 'سُجّل حضور اليوم' : 'لم يُسجّل اليوم بعد'}</T>
          </Card>
        )) : <Card><Empty icon="school" title="لا شعب بعد" action="إضافة صف" onAction={() => router.replace('/class/new')} /></Card>}
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="الحضور" subtitle={sectionLabel(sectionId)}
        right={<IconButton name="excel" label="تصدير سجل الحضور" onPress={() => exportAttendanceXlsx(sectionId).catch((e) => toast(String(e.message ?? e), { tone: 'bad' }))} />} />
      {sections.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {sections.map((s) => <Chip key={s.id} label={sectionLabel(s.id, true)} active={s.id === sectionId} onPress={() => setSectionId(s.id)} />)}
        </ScrollView>
      ) : null}
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 }}>
        <IconButton name="back" label="اليوم السابق" size={40} onPress={() => shift(-1)} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <T weight="bold" size={16}>{formatDayDate(parseIsoDay(date))}</T>
          <T dim size={12}>{date === isoDay() ? 'اليوم' : taken ? 'مسجّل' : 'غير مسجّل'}</T>
        </View>
        <IconButton name="forward" label="اليوم التالي" size={40} onPress={() => shift(1)} />
      </Card>
      <Row gap={6} style={{ flexWrap: 'wrap' }}>
        {ORDER.map((st) => <Pill key={st} label={`${ATTENDANCE_LABEL[st]}: ${arDigits(count(st))}`} tone={TONE[st]} />)}
      </Row>
      <T dim size={12}>اضغط على الطالب لتغيير حالته: حاضر ← غائب ← متأخر ← مُجاز.</T>
      <Card style={{ paddingVertical: 4 }}>
        {students.length === 0 ? <Empty icon="users" title="لا طلاب" /> : students.map((s, i) => {
          const st = (marks.get(s.id)?.status ?? 'present') as AttendanceStatus;
          const t = tone[TONE[st]];
          return (
            <PressScale key={s.id} onPress={() => setStatus(s.id, ORDER[(ORDER.indexOf(st) + 1) % ORDER.length])} scaleTo={0.98}
              accessibilityLabel={`${s.name}: ${ATTENDANCE_LABEL[st]}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
              <T dim size={12} weight="bold" style={{ width: 24, textAlign: 'center' }}>{arDigits(i + 1)}</T>
              <T size={15} weight="medium" style={{ flex: 1 }} lines={1}>{s.name}</T>
              <View style={{ minWidth: 72, height: 32, borderRadius: 16, backgroundColor: taken || st !== 'present' ? t.bg : c.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 }}>
                <T size={13} weight="bold" color={taken || st !== 'present' ? t.ink : c.ink3} style={{ lineHeight: 20 }}>{ATTENDANCE_LABEL[st]}</T>
              </View>
            </PressScale>
          );
        })}
      </Card>
      {students.length ? (
        <Row gap={8}>
          <Button title={taken ? 'محفوظ' : 'تثبيت: الكل حاضر'} icon="check" style={{ flex: 1 }} variant={taken ? 'secondary' : 'primary'} onPress={allPresent} />
          {absentees.length ? (
            <Button title="مشاركة الغائبين" icon="share" variant="secondary" onPress={() => Share.share({
              message: `الغائبون — ${sectionLabel(sectionId)} — ${formatDayDate(parseIsoDay(date))}:\n${absentees.map((s, i) => `${arDigits(i + 1)}. ${s.name}`).join('\n')}`,
            }).catch(() => {})} />
          ) : null}
        </Row>
      ) : null}
    </Screen>
  );
}
