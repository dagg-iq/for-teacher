import { arDigits, countStudents, formatDayDate, parseIsoDay } from '@nahj/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { Icon } from '@/components/icon';
import { Pill, SearchBar } from '@/components/kit';
import { PressScale } from '@/components/motion';
import { Sheet, SheetItem } from '@/components/sheet';
import { Button, Card, Empty, Field, Header, IconButton, Row, Screen, Segmented, T } from '@/components/ui';
import { all, get, insert, remove, update, useQuery } from '@/data/db';
import { absencesOf, attendanceDays, bookProgress, gradebooksOf, sectionClass, sectionLabel, studentsOf } from '@/data/queries';
import { Alert } from '@/lib/dialog';
import { exportStudentList, printStudentList } from '@/lib/export';
import { fonts, useTheme } from '@/lib/theme';
import { toast } from '@/lib/toast';
import { normalizeArabic } from '@nahj/shared';

export default function SectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c, hue } = useTheme();
  const [menu, setMenu] = useState(false);
  const [edit, setEdit] = useState(false);
  const section = useQuery(() => get('sections', id), [id]);
  const k = useQuery(() => sectionClass(id), [id]);
  const students = useQuery(() => studentsOf(id), [id]);
  if (!section || !k) return <Screen><Header /><Empty title="الشعبة غير موجودة" /></Screen>;

  const del = () => Alert.alert('حذف الشعبة؟', `ستُحذف شعبة ${section.name} وطلابها (${countStudents(students.length)}) وسجلاتها وحضورها.`, [
    { text: 'إلغاء', style: 'cancel' },
    { text: 'حذف', style: 'destructive', onPress: () => { remove('sections', section.id); toast('حُذفت الشعبة', { icon: 'trash' }); router.back(); } },
  ]);

  return (
    <Screen>
      <Header title={sectionLabel(id)} subtitle={`${countStudents(students.length)}${section.room ? ` · ${arDigits(section.room)}` : ''}${k.subject ? ` · ${k.subject}` : ''}`}
        right={<IconButton name="more" label="خيارات" onPress={() => setMenu(true)} />} />
      <View style={{ height: 4, borderRadius: 2, backgroundColor: hue(k.hue), width: 48 }} />
      {/* كل ما يخص الشعبة من مكانه الوحيد: الحضور، الدرجات، التقرير */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {([
          { icon: 'check-square', label: 'الحضور', sub: 'تسجيل اليوم', go: () => router.push(`/attendance?section=${id}`) },
          { icon: 'chart', label: 'الدرجات', sub: 'سجلات الشعبة', go: () => router.push({ pathname: '/grades', params: { section: id } }) },
          { icon: 'pie', label: 'التقرير', sub: 'النتائج والراسبون', go: () => router.push(`/reports?section=${id}`) },
        ] as const).map((a) => (
          <PressScale key={a.label} onPress={a.go} scaleTo={0.96} accessibilityRole="button" accessibilityLabel={a.label}
            style={{ flex: 1, backgroundColor: c.card, borderRadius: 20, borderWidth: 1, borderColor: c.line, paddingVertical: 14, alignItems: 'center', gap: 6 }}>
            <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={a.icon} size={21} color={c.accent} accent={c.gold} />
            </View>
            <T weight="bold" size={14}>{a.label}</T>
            <T dim size={11}>{a.sub}</T>
          </PressScale>
        ))}
      </View>
      <Row gap={8}><View style={{ width: 8, height: 8, backgroundColor: c.gold }} /><T weight="bold" size={16}>الطلاب</T></Row>
      <StudentsTab sectionId={id} />

      <Sheet visible={menu} onClose={() => setMenu(false)}>
        <SheetItem icon="upload" label="استيراد طلاب (لصق أو Excel)" onPress={() => { setMenu(false); router.push(`/section/import?id=${id}`); }} />
        <SheetItem icon="excel" label="تصدير القائمة Excel" onPress={() => { setMenu(false); exportStudentList(id).catch((e) => toast(String(e.message ?? e), { tone: 'bad' })); }} />
        <SheetItem icon="print" label="طباعة قائمة الأسماء" onPress={() => { setMenu(false); printStudentList(id).catch((e) => toast(String(e.message ?? e), { tone: 'bad' })); }} />
        <SheetItem icon="edit" label="اسم الشعبة والقاعة" onPress={() => { setMenu(false); setEdit(true); }} />
        <SheetItem icon="trash" label="حذف الشعبة" danger onPress={() => { setMenu(false); del(); }} />
      </Sheet>
      <EditSection visible={edit} onClose={() => setEdit(false)} sectionId={id} />
    </Screen>
  );
}

function EditSection({ visible, onClose, sectionId }: { visible: boolean; onClose: () => void; sectionId: string }) {
  const s = get('sections', sectionId);
  const [name, setName] = useState(s?.name ?? '');
  const [room, setRoom] = useState(s?.room ?? '');
  return (
    <Sheet visible={visible} onClose={onClose}>
      <T display size={22}>الشعبة</T>
      <View style={{ gap: 12, marginTop: 8 }}>
        <Field label="اسم الشعبة" value={name} onChangeText={setName} />
        <Field label="القاعة (اختياري)" value={room} onChangeText={setRoom} placeholder={`مثال: القاعة ${arDigits(3)}`} />
        <Button title="حفظ" icon="check" disabled={!name.trim()} onPress={() => { update('sections', sectionId, { name: name.trim(), room: room.trim() || null }); onClose(); }} />
      </View>
    </Sheet>
  );
}

function StudentsTab({ sectionId }: { sectionId: string }) {
  const { c } = useTheme();
  const [q, setQ] = useState('');
  const [newName, setNewName] = useState('');
  const students = useQuery(() => studentsOf(sectionId), [sectionId]);
  const absences = useQuery(() => new Map(students.map((s) => [s.id, absencesOf(s.id).absent])), [students]);
  const shown = q.trim() ? students.filter((s) => normalizeArabic(s.name).includes(normalizeArabic(q))) : students;

  const add = () => {
    const name = newName.trim().replace(/\s+/g, ' ');
    if (name.length < 2) return;
    if (students.some((s) => normalizeArabic(s.name) === normalizeArabic(name))) {
      toast('هذا الاسم موجود في الشعبة', { tone: 'bad', icon: 'info' });
      return;
    }
    const maxNum = students.reduce((m, s) => Math.max(m, s.number ?? 0), 0);
    insert('students', { section_id: sectionId, name, number: maxNum + 1, sort: maxNum + 1 });
    setNewName('');
  };

  return (
    <>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <TextInput value={newName} onChangeText={setNewName} onSubmitEditing={add} blurOnSubmit={false} returnKeyType="done"
          placeholder="اسم طالب جديد ثم إضافة" placeholderTextColor={c.ink3}
          style={{ flex: 1, height: 50, borderRadius: 16, borderWidth: 1, borderColor: c.line, backgroundColor: c.card, paddingHorizontal: 16, fontFamily: fonts.regular, fontSize: 16, color: c.ink, textAlign: 'right' }} />
        <IconButton name="plus" label="إضافة طالب" filled onPress={add} size={50} />
      </View>
      {students.length === 0 ? (
        <Card>
          <Empty icon="users" title="لا طلاب بعد" body="اكتب الأسماء واحداً واحداً، أو الصق القائمة كاملة من واتساب أو Excel." action="لصق قائمة أسماء" onAction={() => router.push(`/section/import?id=${sectionId}`)} />
        </Card>
      ) : (
        <>
          {students.length > 8 ? <SearchBar value={q} onChange={setQ} placeholder="بحث في الشعبة" /> : null}
          <Card style={{ paddingVertical: 4 }}>
            {shown.map((s, i) => (
              <PressScale key={s.id} onPress={() => router.push(`/student/${s.id}`)} scaleTo={0.98}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
                <View style={{ width: 30, alignItems: 'center' }}>
                  <T dim size={13} weight="bold">{arDigits(s.number ?? i + 1)}</T>
                </View>
                <T size={15} weight="medium" style={{ flex: 1 }} lines={1}>{s.name}</T>
                {absences.get(s.id) ? <Pill label={`غ ${arDigits(absences.get(s.id)!)}`} tone={absences.get(s.id)! >= 5 ? 'bad' : 'warn'} small /> : null}
                {s.parent_phone ? <Icon name="phone" size={14} color={c.ink3} /> : null}
              </PressScale>
            ))}
          </Card>
        </>
      )}
    </>
  );
}
