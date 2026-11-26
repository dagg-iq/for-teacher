import { arDigits, isoDay, type LessonPlan } from '@nahj/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { ToggleRow } from '@/components/kit';
import { WhenPicker } from '@/components/when';
import { Button, Chip, Field, Header, IconButton, Row, Screen, T } from '@/components/ui';
import { get, insert, remove, update } from '@/data/db';
import { classesSorted, sectionLabel, sectionsOf } from '@/data/queries';
import { Alert } from '@/lib/dialog';
import { toast } from '@/lib/toast';

const METHODS = ['المحاضرة', 'المناقشة والحوار', 'الاستجواب', 'الاستقراء', 'حل المشكلات', 'التعلّم التعاوني', 'العصف الذهني', 'التجربة العملية', 'الخرائط الذهنية'];
const MATERIALS = ['السبورة', 'الكتاب المدرسي', 'جهاز العرض', 'وسائل توضيحية', 'المختبر', 'أوراق عمل'];

export default function PlanEdit() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  // بعد أول حفظ (مثلاً «طباعة» لتحضير جديد) يصبح التحضير موجوداً: الحفظ التالي يعدّله لا ينشئ نسخة ثانية
  const [savedId, setSavedId] = useState<string | undefined>(id);
  const p = savedId ? get('lesson_plans', savedId) : undefined;
  const classes = classesSorted();
  const [date, setDate] = useState(() => (p ? new Date(`${p.date}T08:00:00`) : new Date()));
  const [title, setTitle] = useState(p?.title ?? '');
  const [classId, setClassId] = useState<string | null>(p?.class_id ?? classes[0]?.id ?? null);
  const [sectionIds, setSectionIds] = useState<string[]>(p?.section_ids ?? []);
  const [objectives, setObjectives] = useState(p?.objectives ?? '');
  const [materials, setMaterials] = useState(p?.materials ?? '');
  const [method, setMethod] = useState(p?.method ?? '');
  const [steps, setSteps] = useState(p?.steps ?? '');
  const [evaluation, setEvaluation] = useState(p?.evaluation ?? '');
  const [homework, setHomework] = useState(p?.homework ?? '');
  const [done, setDone] = useState(!!p?.done);

  const add = (cur: string, set: (v: string) => void, word: string) => set(cur.includes(word) ? cur : cur ? `${cur}، ${word}` : word);
  const data = (): Omit<LessonPlan, 'id' | 'created_at' | 'updated_at'> => ({
    date: isoDay(date), title: title.trim(), class_id: classId, section_ids: sectionIds, objectives, materials, method, steps, evaluation, homework, done,
  });
  const save = (then?: (id: string) => void) => {
    const row = p ? update('lesson_plans', p.id, data()) : insert('lesson_plans', data());
    if (row) setSavedId(row.id);
    toast('حُفظ التحضير', { icon: 'check' });
    if (then && row) then(row.id);
    else if (router.canGoBack()) router.back();
    else router.replace('/plans');
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title={p ? 'التحضير' : 'تحضير جديد'}
        right={p ? <IconButton name="trash" label="حذف" onPress={() => Alert.alert('حذف التحضير؟', undefined, [{ text: 'إلغاء', style: 'cancel' }, { text: 'حذف', style: 'destructive', onPress: () => { remove('lesson_plans', p.id); router.back(); } }])} /> : undefined} />
      <Field label="عنوان الدرس" value={title} onChangeText={setTitle} placeholder="مثال: قانون نيوتن الثاني" />
      <WhenPicker value={date} onChange={setDate} withTime={false} />
      {classes.length ? (
        <View style={{ gap: 8 }}>
          <T weight="bold" size={14}>الصف</T>
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            {classes.map((k) => <Chip key={k.id} label={k.name} active={classId === k.id} onPress={() => { setClassId(k.id); setSectionIds([]); }} />)}
          </Row>
          {classId ? (
            <Row gap={8} style={{ flexWrap: 'wrap' }}>
              {sectionsOf(classId).map((s) => <Chip key={s.id} small label={sectionLabel(s.id, true)} active={sectionIds.includes(s.id)} onPress={() => setSectionIds((x) => (x.includes(s.id) ? x.filter((y) => y !== s.id) : [...x, s.id]))} />)}
            </Row>
          ) : null}
        </View>
      ) : null}
      <Field label="الأهداف السلوكية" value={objectives} onChangeText={setObjectives} multiline placeholder={'أن يعرّف الطالب…\nأن يطبّق الطالب…'} style={{ minHeight: 90 }} />
      <View style={{ gap: 8 }}>
        <Field label="الوسائل التعليمية" value={materials} onChangeText={setMaterials} />
        <Row gap={6} style={{ flexWrap: 'wrap' }}>{MATERIALS.map((m) => <Chip key={m} small label={m} onPress={() => add(materials, setMaterials, m)} />)}</Row>
      </View>
      <View style={{ gap: 8 }}>
        <Field label="طريقة التدريس" value={method} onChangeText={setMethod} />
        <Row gap={6} style={{ flexWrap: 'wrap' }}>{METHODS.map((m) => <Chip key={m} small label={m} onPress={() => add(method, setMethod, m)} />)}</Row>
      </View>
      <Field label="خطوات الدرس (العرض)" value={steps} onChangeText={setSteps} multiline placeholder={arDigits('التمهيد (5 د)\nالعرض (30 د)\nالخاتمة (5 د)')} style={{ minHeight: 110 }} />
      <Field label="التقويم" value={evaluation} onChangeText={setEvaluation} multiline style={{ minHeight: 70 }} />
      <Field label="الواجب البيتي" value={homework} onChangeText={setHomework} />
      <ToggleRow title="نُفّذ الدرس" value={done} onChange={setDone} />
      <Row gap={8}>
        <Button title="طباعة" icon="print" variant="secondary" disabled={!title.trim()} onPress={() => save((pid) => router.push(`/print?kind=plan&id=${pid}`))} />
        <Button title="حفظ" icon="check" style={{ flex: 1 }} disabled={!title.trim()} onPress={() => save()} />
      </Row>
    </Screen>
  );
}
