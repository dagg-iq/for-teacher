import {
  arDigits, ATTENDANCE_LABEL, formatDate, formatScore, iraqiPhone, isoDay, NOTE_KIND_LABEL, parseIsoDay, whatsappLink, type NoteKind,
} from '@nahj/shared';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Icon } from '@/components/icon';
import { Pill } from '@/components/kit';
import { Sheet, SheetItem } from '@/components/sheet';
import { Button, Card, Chip, Empty, Field, Header, IconButton, Row, Screen, SectionTitle, T } from '@/components/ui';
import { all, get, insert, remove, update, useQuery, useSettings } from '@/data/db';
import { absencesOf, allSections, booksOfSection, sectionLabel, sheetOf, studentNo } from '@/data/queries';
import { previewTransfer, transferStudent } from '@/data/transfer';
import { Alert } from '@/lib/dialog';
import { useTheme } from '@/lib/theme';
import { toast } from '@/lib/toast';

export default function StudentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  const settings = useSettings();
  const profile = settings.profile;
  const profile_alert = settings.prefs.absenceAlert;
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [moving, setMoving] = useState(false);
  const [noteKind, setNoteKind] = useState<NoteKind>('positive');
  const [note, setNote] = useState('');
  const s = useQuery(() => get('students', id), [id]);
  const books = useQuery(() => (s ? (() => { const x = booksOfSection(s.section_id); return [...x.sets.flatMap((y) => y.books), ...x.loose]; })().map((b) => {
    const row = sheetOf(b).find((r) => r.student.id === id);
    return { b, row };
  }) : []), [s?.section_id, id]);
  const ab = useQuery(() => absencesOf(id), [id]);
  const no = useQuery(() => studentNo(id), [id]);
  const notes = useQuery(() => all('student_notes').filter((n) => n.student_id === id).sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)), [id]);
  if (!s) return <Screen><Header /><Empty title="الطالب غير موجود" /></Screen>;

  const phone = iraqiPhone(s.parent_phone);
  const results = books.filter((x) => x.row?.verdict);
  const msg = () => {
    const lines = results.map((x) => `• ${x.b.title}: ${formatScore(x.row!.values[x.b.result.column_id!])} (${x.row!.verdict!.label})`);
    return `السلام عليكم، ولي أمر الطالب ${s.name} المحترم.\n${lines.length ? `درجات ${s.name.split(' ')[0]} في مادة ${profile?.subject ?? ''}:\n${lines.join('\n')}\n` : ''}${ab.absent ? `عدد الغيابات: ${ab.absent}\n` : ''}مع التقدير،\n${profile?.gender === 'f' ? 'المدرّسة' : 'المدرّس'} ${profile?.name ?? ''}`;
  };
  const del = () => Alert.alert('حذف الطالب؟', `سيُحذف ${s.name} مع درجاته وغياباته.`, [
    { text: 'إلغاء', style: 'cancel' },
    { text: 'حذف', style: 'destructive', onPress: () => { remove('students', s.id); toast('حُذف الطالب', { icon: 'trash' }); router.back(); } },
  ]);

  return (
    <Screen>
      <Header title={s.name} subtitle={`${sectionLabel(s.section_id)}${no ? ` · رقم ${arDigits(no)} في القائمة` : ''}`}
        right={<IconButton name="more-v" label="خيارات" onPress={() => setMenu(true)} />} />
      {s.history?.length ? (
        <Card style={{ gap: 4, borderWidth: 1, borderColor: c.gold }}>
          {s.history.slice(-3).reverse().map((h, i) => (
            <Row key={`${h.date}-${i}`} gap={8}>
              <Icon name="forward" size={16} color={c.gold} />
              <T size={13} style={{ flex: 1 }}>{`منقول من ${h.from} إلى ${h.to} — ${formatDate(parseIsoDay(h.date))}`}</T>
            </Row>
          ))}
        </Card>
      ) : null}
      <Card style={{ flexDirection: 'row', paddingVertical: 12 }}>
        {[
          { label: 'غياب', v: ab.absent, bad: ab.count >= profile_alert },
          { label: 'تأخير', v: ab.late, bad: false },
          { label: 'إجازة', v: ab.excused, bad: false },
          { label: 'ملاحظات', v: notes.length, bad: false },
        ].map((x, i) => (
          <View key={x.label} style={{ flex: 1, alignItems: 'center', borderRightWidth: i ? 1 : 0, borderRightColor: c.line }}>
            <T display size={24} color={x.bad ? '#C8312B' : c.ink}>{arDigits(x.v)}</T>
            <T dim size={12} style={{ marginTop: -4 }}>{x.label}</T>
          </View>
        ))}
      </Card>

      {phone ? (
        <Row gap={8}>
          <Button title="رسالة واتساب" icon="whatsapp" small style={{ flex: 1 }} onPress={() => Linking.openURL(whatsappLink(phone, msg()))} />
          <Button title="اتصال" icon="phone" small variant="secondary" onPress={() => Linking.openURL(`tel:${s.parent_phone}`)} />
        </Row>
      ) : (
        <Button title="أضف رقم ولي الأمر" icon="phone" small variant="secondary" onPress={() => setEditing(true)} />
      )}

      <SectionTitle title="الدرجات" />
      {books.length === 0 ? <Card><T dim center>لا سجلات درجات لهذه الشعبة بعد.</T></Card> : books.map(({ b, row }) => (
        <Card key={b.id} onPress={() => router.push(`/book/${b.id}?focus=${id}`)} style={{ gap: 10 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T weight="bold" size={15} style={{ flex: 1 }}>{b.title}</T>
            {row?.verdict ? <Pill label={row.verdict.label} tone={row.verdict.tone} small /> : null}
          </Row>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {b.columns.filter((col) => !col.hidden).map((col) => {
              const mark = row?.marks[col.id];
              const v = row?.values[col.id];
              return (
                <View key={col.id} style={{ backgroundColor: col.kind === 'formula' ? c.soft : c.bg, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, minWidth: 64, flexGrow: 1, flexBasis: '22%' }}>
                  <T size={11} dim lines={1}>{arDigits(col.name)}</T>
                  <T weight="bold" size={15} color={col.kind === 'formula' ? c.softInk : c.ink}>{mark === 'absent' && !v ? 'غائب' : mark === 'exempt' ? 'معفى' : formatScore(v)}</T>
                </View>
              );
            })}
          </View>
          {row?.rank ? <T dim size={12}>الترتيب في الشعبة: {arDigits(row.rank)}</T> : null}
        </Card>
      ))}

      <SectionTitle title="الملاحظات والسلوك" />
      <Card style={{ gap: 10 }}>
        <Row gap={8}>
          {(['positive', 'negative', 'note'] as NoteKind[]).map((k) => <Chip key={k} small label={NOTE_KIND_LABEL[k]} active={noteKind === k} onPress={() => setNoteKind(k)} />)}
        </Row>
        <Field value={note} onChangeText={setNote} placeholder="مثال: مشاركة ممتازة في حل المسألة" />
        <Button title="إضافة ملاحظة" small icon="plus" disabled={!note.trim()} onPress={() => { insert('student_notes', { student_id: id, kind: noteKind, text: note.trim(), date: isoDay() }); setNote(''); }} />
        {notes.map((n) => (
          <Row key={n.id} gap={10} style={{ borderTopWidth: 1, borderTopColor: c.line, paddingTop: 10 }}>
            <Pill small label={NOTE_KIND_LABEL[n.kind]} tone={n.kind === 'positive' ? 'good' : n.kind === 'negative' ? 'bad' : 'neutral'} />
            <View style={{ flex: 1 }}>
              <T size={14}>{n.text}</T>
              <T dim size={11}>{formatDate(parseIsoDay(n.date))}</T>
            </View>
            <IconButton name="trash" label="حذف الملاحظة" size={34} onPress={() => remove('student_notes', n.id)} />
          </Row>
        ))}
      </Card>

      {ab.rows.filter((a) => a.status !== 'present').length ? (
        <>
          <SectionTitle title="سجل الغياب" />
          <Card style={{ paddingVertical: 4 }}>
            {ab.rows.filter((a) => a.status !== 'present').slice(0, 30).map((a, i) => (
              <Row key={a.id} style={{ paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: c.line, justifyContent: 'space-between' }}>
                <T size={14}>{formatDate(parseIsoDay(a.date))}</T>
                <Pill small label={ATTENDANCE_LABEL[a.status]} tone={a.status === 'absent' ? 'bad' : a.status === 'late' ? 'warn' : 'info'} />
              </Row>
            ))}
          </Card>
        </>
      ) : null}

      <Sheet visible={menu} onClose={() => setMenu(false)}>
        <SheetItem icon="edit" label="تعديل البيانات" onPress={() => { setMenu(false); setEditing(true); }} />
        <SheetItem icon="forward" label="نقل إلى شعبة أخرى" onPress={() => { setMenu(false); setMoving(true); }} />
        <SheetItem icon="print" label="طباعة تقرير الطالب / PDF" onPress={() => { setMenu(false); router.push(`/print?kind=student&id=${id}`); }} />
        <SheetItem icon="trash" label="حذف الطالب" danger onPress={() => { setMenu(false); del(); }} />
      </Sheet>
      {editing ? <EditStudent visible onClose={() => setEditing(false)} id={id} /> : null}
      <Sheet visible={moving} onClose={() => setMoving(false)}>
        <T display size={22}>نقل {s.name.split(' ')[0]}</T>
        <T dim size={13}>ينتقل الطالب كاملاً: درجاته تُنقل إلى السجلات المقابلة في الشعبة الجديدة (نفس السجل ونفس اسم العمود)، وغياباته وملاحظاته معه، ويُكتب في ملفه أنه منقول.</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          {allSections().filter((x) => x.id !== s.section_id).map((x) => (
            <Chip key={x.id} label={sectionLabel(x.id, true)} onPress={() => {
              const p = previewTransfer(s.id, x.id);
              const lines = [
                `${arDigits(p.grades)} درجة تنتقل${p.books ? ` إلى ${arDigits(p.books)} سجل مقابل` : ''}`,
                `${arDigits(p.attendance)} يوم حضور/غياب ينتقل`,
                p.kept ? `${arDigits(p.kept)} درجة بلا سجل أو عمود مقابل في الشعبة الجديدة — تبقى محفوظة في الشعبة القديمة` : '',
              ].filter(Boolean).join('\n');
              Alert.alert(`نقل ${s.name} إلى ${sectionLabel(x.id)}؟`, lines, [
                { text: 'إلغاء', style: 'cancel' },
                { text: 'نقل', onPress: () => {
                  const r = transferStudent(s.id, x.id);
                  setMoving(false);
                  toast(`نُقل إلى ${sectionLabel(x.id)} مع ${arDigits(r.grades)} درجة`, { icon: 'check' });
                } },
              ]);
            }} />
          ))}
        </View>
      </Sheet>
    </Screen>
  );
}

function EditStudent({ visible, onClose, id }: { visible: boolean; onClose: () => void; id: string }) {
  const s = get('students', id);
  const [name, setName] = useState(s?.name ?? '');
  const [phone, setPhone] = useState(s?.parent_phone ?? '');
  const [notes, setNotes] = useState(s?.notes ?? '');
  return (
    <Sheet visible={visible} onClose={onClose}>
      <T display size={22}>بيانات الطالب</T>
      <View style={{ gap: 10, marginTop: 8 }}>
        <Field label="الاسم" value={name} onChangeText={setName} />
        <Field label="هاتف ولي الأمر" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="07xxxxxxxxx" style={{ textAlign: 'right' }} />
        <T dim size={12}>رقم الطالب يتبع ترتيب القائمة. لتغييره: اجعل الترتيب «حسب التسلسل» من قائمة الطلاب ثم «ترتيب الطلاب يدوياً».</T>
        <Field label="ملاحظة دائمة" value={notes} onChangeText={setNotes} placeholder="اختياري" />
        <Button title="حفظ" icon="check" disabled={name.trim().length < 2} onPress={() => {
          update('students', id, { name: name.trim().replace(/\s+/g, ' '), parent_phone: phone.trim() || null, notes: notes.trim() || null });
          onClose();
        }} />
      </View>
    </Sheet>
  );
}
