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

type Tab = 'students' | 'books' | 'attendance';

export default function SectionScreen() {
  const { id, tab: initial } = useLocalSearchParams<{ id: string; tab?: Tab }>();
  const { hue } = useTheme();
  const [tab, setTab] = useState<Tab>(initial ?? 'students');
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
        right={(
          <>
            <IconButton name="mic" label="إدخال صوتي" onPress={() => router.push(`/voice?section=${id}`)} />
            <IconButton name="more" label="خيارات" onPress={() => setMenu(true)} />
          </>
        )} />
      <View style={{ height: 4, borderRadius: 2, backgroundColor: hue(k.hue), width: 48 }} />
      <Segmented options={[{ key: 'students', label: 'الطلاب' }, { key: 'books', label: 'الدرجات' }, { key: 'attendance', label: 'الحضور' }]} value={tab} onChange={setTab} />
      {tab === 'students' ? <StudentsTab sectionId={id} /> : tab === 'books' ? <BooksTab sectionId={id} /> : <AttendanceTab sectionId={id} />}

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
        <Field label="القاعة (اختياري)" value={room} onChangeText={setRoom} placeholder="مثال: القاعة ٣" />
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

function BooksTab({ sectionId }: { sectionId: string }) {
  const { c } = useTheme();
  const books = useQuery(() => gradebooksOf(sectionId).map((b) => ({ b, p: bookProgress(b) })), [sectionId]);
  return (
    <>
      {books.length === 0 ? (
        <Card><Empty icon="table" title="لا سجلات درجات" body="أنشئ سجلاً من قالب جاهز (السعي السنوي، شهري…) أو صمّم سجلك." action="سجل جديد" onAction={() => router.push(`/book/new?section=${sectionId}`)} /></Card>
      ) : books.map(({ b, p }) => (
        <Card key={b.id} onPress={() => router.push(`/book/${b.id}`)} style={{ gap: 8 }}>
          <Row>
            <View style={{ flex: 1 }}>
              <T weight="bold" size={16}>{b.title}</T>
              <T dim size={12}>{arDigits(b.columns.length)} عمود · أُدخل {arDigits(p.filled)} من {arDigits(p.total)}</T>
            </View>
            <Icon name="forward" size={18} color={c.ink3} />
          </Row>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: c.line, overflow: 'hidden' }}>
            <View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: `${p.total ? (p.filled / p.total) * 100 : 0}%`, backgroundColor: c.accent }} />
          </View>
        </Card>
      ))}
      {books.length ? <Button title="سجل جديد" icon="plus" variant="secondary" onPress={() => router.push(`/book/new?section=${sectionId}`)} /> : null}
    </>
  );
}

function AttendanceTab({ sectionId }: { sectionId: string }) {
  const { c } = useTheme();
  const days = useQuery(() => attendanceDays(sectionId).slice(0, 20).map((d) => {
    const rows = all('attendance').filter((a) => a.section_id === sectionId && a.date === d);
    return { d, absent: rows.filter((a) => a.status === 'absent').length, late: rows.filter((a) => a.status === 'late').length, total: rows.length };
  }), [sectionId]);
  return (
    <>
      <Button title="تسجيل حضور اليوم" icon="check-square" onPress={() => router.push(`/attendance?section=${sectionId}`)} />
      {days.length === 0 ? (
        <Card><Empty icon="check-square" title="لم يُسجّل حضور بعد" body="سجّل الغياب بضغطة على اسم الطالب، والباقون حاضرون تلقائياً." /></Card>
      ) : (
        <Card style={{ paddingVertical: 4 }}>
          {days.map((x, i) => (
            <PressScale key={x.d} onPress={() => router.push(`/attendance?section=${sectionId}&date=${x.d}`)} scaleTo={0.98}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
              <T weight="bold" size={15} style={{ flex: 1 }}>{formatDayDate(parseIsoDay(x.d))}</T>
              {x.absent ? <Pill label={`غائب ${arDigits(x.absent)}`} tone="bad" small /> : <Pill label="الكل حاضر" tone="good" small />}
              {x.late ? <Pill label={`متأخر ${arDigits(x.late)}`} tone="warn" small /> : null}
            </PressScale>
          ))}
        </Card>
      )}
    </>
  );
}
