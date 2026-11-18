import { classHues, COMMON_CLASSES, COMMON_SUBJECTS, SECTION_LETTERS, STAGE_LABEL, type Stage } from '@rasd/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { PressScale } from '@/components/motion';
import { Button, Chip, Field, Header, Row, Screen, T } from '@/components/ui';
import { get, insert, insertMany, update, useSettings } from '@/data/db';
import { classesSorted, sectionsOf } from '@/data/queries';
import { useTheme } from '@/lib/theme';
import { toast } from '@/lib/toast';

/** إضافة صف جديد أو تعديل صف (?id=) */
export default function ClassForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = get('classes', id);
  const { c, hue } = useTheme();
  const profile = useSettings().profile;
  const [name, setName] = useState(existing?.name ?? '');
  const [stage, setStage] = useState<Stage>(existing?.stage ?? 'preparatory');
  const [subject, setSubject] = useState(existing?.subject ?? profile?.subject ?? '');
  const [color, setColor] = useState(existing?.hue ?? classesSorted().length % classHues.length);
  const [letters, setLetters] = useState<string[]>(existing ? [] : ['أ']);

  const toggle = (l: string) => setLetters((cur) => (cur.includes(l) ? cur.filter((x) => x !== l) : [...cur, l].sort((a, b) => SECTION_LETTERS.indexOf(a) - SECTION_LETTERS.indexOf(b))));
  const save = () => {
    if (existing) {
      update('classes', existing.id, { name: name.trim(), stage, subject: subject.trim(), hue: color });
      if (letters.length) {
        const have = sectionsOf(existing.id).length;
        insertMany('sections', letters.map((l, i) => ({ class_id: existing.id, name: l, sort: have + i })));
      }
      toast('حُفظ الصف', { icon: 'check' });
      router.back();
      return;
    }
    const k = insert('classes', { name: name.trim(), stage, subject: subject.trim(), hue: color, sort: classesSorted().length });
    insertMany('sections', letters.map((l, i) => ({ class_id: k.id, name: l, sort: i })));
    toast('أُضيف الصف — أضف الطلاب الآن', { icon: 'check' });
    router.replace(`/class/${k.id}`);
  };
  const taken = existing ? new Set(sectionsOf(existing.id).map((s) => s.name)) : new Set<string>();

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title={existing ? 'تعديل الصف' : 'صف جديد'} />
      <Field label="اسم الصف" value={name} onChangeText={setName} placeholder="مثال: الخامس العلمي" />
      {!existing ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {COMMON_CLASSES.map((k) => <Chip key={k.name} label={k.name} active={name === k.name} onPress={() => { setName(k.name); setStage(k.stage); }} />)}
        </ScrollView>
      ) : null}
      <View style={{ gap: 8 }}>
        <T weight="bold" size={14}>المرحلة</T>
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          {(Object.keys(STAGE_LABEL) as Stage[]).map((s) => <Chip key={s} label={STAGE_LABEL[s]} active={stage === s} onPress={() => setStage(s)} />)}
        </Row>
      </View>
      <View style={{ gap: 8 }}>
        <Field label="المادة" value={subject} onChangeText={setSubject} placeholder="المادة التي تدرّسها لهذا الصف" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {COMMON_SUBJECTS.slice(0, 12).map((s) => <Chip key={s} label={s} small active={subject === s} onPress={() => setSubject(s)} />)}
        </ScrollView>
      </View>
      <View style={{ gap: 8 }}>
        <T weight="bold" size={14}>اللون</T>
        <Row gap={10} style={{ flexWrap: 'wrap' }}>
          {classHues.map((_, i) => (
            <PressScale key={i} onPress={() => setColor(i)} accessibilityLabel={`لون ${i + 1}`} scaleTo={0.88}
              style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: hue(i), borderWidth: color === i ? 3 : 0, borderColor: c.ink }} />
          ))}
        </Row>
      </View>
      <View style={{ gap: 8 }}>
        <T weight="bold" size={14}>{existing ? 'إضافة شعب' : 'الشعب'}</T>
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          {SECTION_LETTERS.filter((l) => !taken.has(l)).map((l) => <Chip key={l} label={l} active={letters.includes(l)} onPress={() => toggle(l)} />)}
        </Row>
        <T dim size={12}>{existing ? 'اختر شعباً جديدة لإضافتها (الموجودة لا تتكرر).' : 'اختر شعب هذا الصف التي تدرّسها.'}</T>
      </View>
      <Button title={existing ? 'حفظ' : 'إضافة الصف'} icon="check" disabled={name.trim().length < 2 || (!existing && !letters.length)} onPress={save} />
    </Screen>
  );
}
