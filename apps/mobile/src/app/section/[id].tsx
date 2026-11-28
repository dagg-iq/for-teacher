import { arDigits, countStudents, normalizeArabic, parseNameList } from '@nahj/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { Icon } from '@/components/icon';
import { Pill, SearchBar } from '@/components/kit';
import { PressScale } from '@/components/motion';
import { Sheet, SheetItem } from '@/components/sheet';
import { Button, Card, Divider, Empty, Field, Header, IconButton, Row, Screen, Segmented, T } from '@/components/ui';
import { get, insertMany, remove, setPrefs, update, updateMany, useQuery, useSettings, where } from '@/data/db';
import { absencesOf, nextSeq, sectionClass, sectionLabel, studentsOf } from '@/data/queries';
import { Alert } from '@/lib/dialog';
import { exportStudentList } from '@/lib/export';
import { fonts, useTheme } from '@/lib/theme';
import { toast } from '@/lib/toast';

export default function SectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c, hue } = useTheme();
  const [menu, setMenu] = useState(false);
  const [edit, setEdit] = useState(false);
  const section = useQuery(() => get('sections', id), [id]);
  const k = useQuery(() => sectionClass(id), [id]);
  const students = useQuery(() => studentsOf(id), [id]);
  if (!section || !k) return <Screen><Header /><Empty title="الشعبة غير موجودة" /></Screen>;

  const del = () => Alert.alert('حذف الشعبة؟', `ستُحذف شعبة ${section.name} وطلابها (${countStudents(students.length)}) وسجلاتها وحضورها. لا يمكن التراجع.`, [
    { text: 'إلغاء', style: 'cancel' },
    { text: 'حذف', style: 'destructive', onPress: () => { remove('sections', section.id); toast('حُذفت الشعبة', { icon: 'trash' }); if (router.canGoBack()) router.back(); else router.replace('/classes'); } },
  ]);

  return (
    <Screen>
      <Header title={sectionLabel(id)} subtitle={`${countStudents(students.length)}${section.room ? ` · ${arDigits(section.room)}` : ''}${k.subject ? ` · ${k.subject}` : ''}`}
        right={<IconButton name="more-v" label="خيارات الشعبة" onPress={() => setMenu(true)} />} />
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
      <StudentsTab sectionId={id} />

      <Sheet visible={menu} onClose={() => setMenu(false)}>
        <T display size={20}>الشعبة</T>
        <SheetItem icon="edit" label="اسم الشعبة والقاعة" onPress={() => { setMenu(false); setEdit(true); }} />
        <SheetItem icon="settings" label="إعدادات الطلاب" onPress={() => { setMenu(false); router.push('/settings/students'); }} />
        <SheetItem icon="trash" label="حذف الشعبة" danger onPress={() => { setMenu(false); del(); }} />
      </Sheet>
      {edit ? <EditSection onClose={() => setEdit(false)} sectionId={id} /> : null}
    </Screen>
  );
}

function EditSection({ onClose, sectionId }: { onClose: () => void; sectionId: string }) {
  const s = get('sections', sectionId);
  const [name, setName] = useState(s?.name ?? '');
  const [room, setRoom] = useState(s?.room ?? '');
  const clash = !!s && where('sections', (x) => x.class_id === s.class_id && x.id !== s.id && normalizeArabic(x.name) === normalizeArabic(name.trim())).length > 0;
  return (
    <Sheet visible onClose={onClose}>
      <T display size={22}>الشعبة</T>
      <View style={{ gap: 12, marginTop: 8 }}>
        <Field label="اسم الشعبة" value={name} onChangeText={setName} hint={clash ? 'يوجد شعبة بهذا الاسم في الصف نفسه' : undefined} />
        <Field label="القاعة (اختياري)" value={room} onChangeText={setRoom} placeholder={`مثال: القاعة ${arDigits(3)}`} />
        <Button title="حفظ" icon="check" disabled={!name.trim() || clash} onPress={() => { update('sections', sectionId, { name: name.trim(), room: room.trim() || null }); toast('حُفظت', { icon: 'check' }); onClose(); }} />
      </View>
    </Sheet>
  );
}

function StudentsTab({ sectionId }: { sectionId: string }) {
  const { c, tone } = useTheme();
  const prefs = useSettings().prefs;
  const [q, setQ] = useState('');
  const [newName, setNewName] = useState('');
  const [menu, setMenu] = useState(false);
  const [reorder, setReorder] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const students = useQuery(() => studentsOf(sectionId), [sectionId]);
  const absences = useQuery(() => new Map(students.map((s) => [s.id, absencesOf(s.id).count])), [students]);
  const shown = q.trim() ? students.filter((s) => normalizeArabic(s.name).includes(normalizeArabic(q))) : students;
  const alpha = prefs.studentOrder !== 'number';

  const addNames = (names: string[]) => {
    const seq = nextSeq(sectionId);
    const rows = insertMany('students', names.map((name, i) => ({ section_id: sectionId, name, number: seq + i, sort: seq + i })));
    setNewName('');
    if (rows.length === 1) {
      const pos = studentsOf(sectionId).findIndex((s) => s.id === rows[0].id) + 1;
      setFlash(rows[0].id);
      setTimeout(() => setFlash(null), 2500);
      toast(`أُضيف ${rows[0].name.split(' ')[0]} — رقمه ${arDigits(pos)} في القائمة${alpha ? ' (أبجدياً)' : ''}`, { icon: 'check' });
    } else toast(`أُضيف ${countStudents(rows.length)}`, { icon: 'check' });
  };

  const add = () => {
    // لصق قائمة كاملة في الخانة: كل سطر طالب (بدل أن تصبح القائمة اسماً واحداً)
    const list = parseNameList(newName);
    if (list.length > 1) {
      const have = new Set(students.map((s) => normalizeArabic(s.name)));
      const fresh = list.filter((n) => !have.has(normalizeArabic(n)));
      if (!fresh.length) { toast('كل هذه الأسماء موجودة في الشعبة', { tone: 'bad', icon: 'info' }); return; }
      Alert.alert(`إضافة ${countStudents(fresh.length)}؟`, list.length > fresh.length ? `${arDigits(list.length - fresh.length)} مكرر لن يُضاف.` : undefined, [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'إضافة', onPress: () => addNames(fresh) },
      ]);
      return;
    }
    const name = newName.trim().replace(/\s+/g, ' ');
    if (name.length < 2) return;
    if (students.some((s) => normalizeArabic(s.name) === normalizeArabic(name))) {
      // اسمان متطابقان يحدث فعلاً في المدارس: نسأل بدل أن نمنع
      Alert.alert('الاسم موجود في الشعبة', `«${name}» مسجّل مسبقاً. أضفه طالباً آخر بالاسم نفسه؟ (يُفضّل كتابة الاسم الثلاثي للتمييز)`, [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'إضافة', onPress: () => addNames([name]) },
      ]);
      return;
    }
    addNames([name]);
  };

  /** يعتمد الترتيب الحالي تسلسلاً ثابتاً (١…ن) */
  const lockOrder = (list = students) => updateMany('students', list.map((s, i) => ({ id: s.id, patch: { number: i + 1, sort: i + 1 } })));
  const move = (i: number, d: -1 | 1) => {
    const list = [...students];
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    lockOrder(list);
  };
  const toSequence = (fromAlpha: boolean) => {
    if (fromAlpha) lockOrder();
    setPrefs({ studentOrder: 'number' });
  };

  return (
    <>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row gap={8}>
          <View style={{ width: 8, height: 8, backgroundColor: c.gold }} />
          <T weight="bold" size={16}>الطلاب</T>
          <Pill small label={alpha ? 'أبجدي' : 'حسب التسلسل'} tone="neutral" />
        </Row>
        <Row gap={8}>
          {reorder ? <Button title="تم" icon="check" small onPress={() => setReorder(false)} /> : null}
          <IconButton name="more-v" label="خيارات الطلاب" size={40} onPress={() => setMenu(true)} />
        </Row>
      </Row>
      {reorder ? (
        <Card tone="soft"><T size={13} color={c.softInk}>رتّب الطلاب بالأسهم. يُحفظ الترتيب فوراً ويُعتمد في السجلات والحضور والطباعة.</T></Card>
      ) : (
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <TextInput value={newName} onChangeText={setNewName} onSubmitEditing={add} blurOnSubmit={false} returnKeyType="done" multiline={false}
            placeholder="اسم طالب جديد أو الصق قائمة" placeholderTextColor={c.ink3} accessibilityLabel="اسم طالب جديد"
            style={{ flex: 1, minWidth: 0, height: 50, borderRadius: 16, borderWidth: 1, borderColor: c.line, backgroundColor: c.card, paddingHorizontal: 16, fontFamily: fonts.regular, fontSize: 16, color: c.ink, textAlign: 'right' }} />
          <IconButton name="plus" label="إضافة طالب" filled onPress={add} size={50} />
        </View>
      )}
      {students.length === 0 ? (
        <Card>
          <Empty icon="users" title="لا طلاب بعد" body="اكتب الأسماء واحداً واحداً، أو الصق القائمة كاملة من واتساب أو Excel." action="لصق قائمة أسماء" onAction={() => router.push(`/section/import?id=${sectionId}`)} />
        </Card>
      ) : (
        <>
          {students.length > 8 && !reorder ? <SearchBar value={q} onChange={setQ} placeholder="بحث في الشعبة" /> : null}
          <Card style={{ paddingVertical: 4 }}>
            {(reorder ? students : shown).map((s, i) => {
              const pos = reorder ? i + 1 : students.indexOf(s) + 1;
              const ab = absences.get(s.id) ?? 0;
              return (
                <PressScale key={s.id} onPress={reorder ? undefined : () => router.push(`/student/${s.id}`)} disabled={reorder} scaleTo={0.98}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: reorder ? 6 : 11, borderTopWidth: i ? 1 : 0, borderTopColor: c.line, backgroundColor: flash === s.id ? c.soft : 'transparent', borderRadius: 8 }}>
                  <View style={{ width: 30, alignItems: 'center' }}>
                    <T dim size={13} weight="bold">{arDigits(pos)}</T>
                  </View>
                  <T size={15} weight="medium" style={{ flex: 1 }} lines={2}>{s.name}</T>
                  {reorder ? (
                    <>
                      <View style={{ opacity: i === 0 ? 0.3 : 1 }}><IconButton name="up" label={`تقديم ${s.name}`} size={34} onPress={i === 0 ? undefined : () => move(i, -1)} /></View>
                      <View style={{ opacity: i === students.length - 1 ? 0.3 : 1 }}><IconButton name="down" label={`تأخير ${s.name}`} size={34} onPress={i === students.length - 1 ? undefined : () => move(i, 1)} /></View>
                    </>
                  ) : (
                    <>
                      {s.parent_phone ? <Icon name="phone" size={14} color={c.ink3} /> : null}
                      {prefs.showAbsences && ab ? <Pill label={`غياب ${arDigits(ab)}`} tone={ab >= prefs.absenceAlert ? 'bad' : 'warn'} small /> : null}
                    </>
                  )}
                </PressScale>
              );
            })}
            {!shown.length ? <T dim center style={{ paddingVertical: 14 }}>لا نتائج</T> : null}
          </Card>
        </>
      )}

      <Sheet visible={menu} onClose={() => setMenu(false)}>
        <T display size={20}>الطلاب</T>
        <View style={{ gap: 6, paddingVertical: 8 }}>
          <T weight="bold" size={14}>ترتيب القائمة والأرقام</T>
          <Segmented options={[{ key: 'alpha', label: 'أبجدي' }, { key: 'number', label: 'حسب التسلسل' }]} value={alpha ? 'alpha' : 'number'}
            onChange={(v) => {
              if (v === 'alpha') { setPrefs({ studentOrder: 'alpha' }); setReorder(false); return; }
              Alert.alert('الترتيب حسب التسلسل', 'كيف يبدأ التسلسل؟', [
                { text: 'إلغاء', style: 'cancel' },
                { text: 'كما هو الآن (أبجدياً)', onPress: () => toSequence(true) },
                { text: 'حسب ترتيب الإضافة', onPress: () => toSequence(false) },
              ]);
            }} />
          <T dim size={12}>{alpha ? 'الرقم «ت» = مكان الطالب أبجدياً، والطالب الجديد يأخذ مكانه حسب اسمه.' : 'الطالب الجديد يُضاف آخر القائمة، ويمكنك ترتيب الطلاب يدوياً.'}</T>
        </View>
        <Divider />
        {!alpha ? <SheetItem icon="sort" label="ترتيب الطلاب يدوياً" onPress={() => { setMenu(false); setQ(''); setReorder(true); }} /> : null}
        <SheetItem icon="upload" label="إضافة قائمة (لصق أو Excel)" onPress={() => { setMenu(false); router.push(`/section/import?id=${sectionId}`); }} />
        <SheetItem icon="excel" label="تصدير القائمة Excel" onPress={() => { setMenu(false); exportStudentList(sectionId).catch((e) => toast(String(e.message ?? e), { tone: 'bad' })); }} />
        <SheetItem icon="print" label="طباعة قائمة الأسماء / PDF" onPress={() => { setMenu(false); router.push(`/print?kind=list&id=${sectionId}`); }} />
        <SheetItem icon="settings" label="إعدادات الطلاب" onPress={() => { setMenu(false); router.push('/settings/students'); }} />
      </Sheet>
    </>
  );
}

