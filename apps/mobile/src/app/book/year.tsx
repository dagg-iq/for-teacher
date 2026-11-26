import { arDigits, buildYearSet, COMPONENT_PRESETS, countSections, type Component } from '@nahj/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { ComponentsEditor, SectionPicker, validComponents } from '@/components/components-editor';
import { Icon } from '@/components/icon';
import { Stepper, ToggleRow } from '@/components/kit';
import { Button, Card, Empty, Header, Row, Screen, Segmented, T } from '@/components/ui';
import { count, getSettings, useQuery } from '@/data/db';
import { createYearSet } from '@/data/grades';
import { allSections, booksOfSection } from '@/data/queries';
import { useTheme } from '@/lib/theme';
import { Alert } from '@/lib/dialog';
import { toast } from '@/lib/toast';

/** إعداد سجلات السنة: الحقول مرة واحدة، فتُنشأ كل السجلات مترابطة لكل شعبة مختارة */
export default function YearSetup() {
  const { section } = useLocalSearchParams<{ section?: string }>();
  const { c } = useTheme();
  const sections = useQuery(() => allSections().map((s) => ({ s, n: count('students', (x) => x.section_id === s.id) })));
  const [picked, setPicked] = useState<string[]>(section ? [section] : sections.length === 1 ? [sections[0].s.id] : []);
  const [components, setComponents] = useState<Component[]>(COMPONENT_PRESETS[0].items.map((x) => ({ ...x })));
  const [midSame, setMidSame] = useState<'one' | 'same'>('one');
  // القيم الافتراضية من «إعدادات الدرجات» (مكان واحد لها)
  const prefs = getSettings().prefs;
  const [pass, setPass] = useState(prefs.passMark ?? 50);
  const [boost, setBoost] = useState((prefs.criticalBelow ?? 3) > 0);
  const [below, setBelow] = useState(prefs.criticalBelow || 3);
  const [final, setFinal] = useState(false);
  const total = components.reduce((s, x) => s + (x.max || 0), 0);
  const plan = { components, midComponents: midSame === 'same' ? components : undefined, pass, boostBelow: boost ? below : 0, withFinal: final, round: prefs.rounding ?? 'int' };
  const preview = useMemo(() => (validComponents(components) ? buildYearSet(plan) : []), [JSON.stringify(plan)]); // eslint-disable-line react-hooks/exhaustive-deps
  const existing = picked.filter((id) => booksOfSection(id).sets.length > 0).length;

  if (!sections.length) {
    return (
      <Screen edges={['top', 'bottom']}>
        <Header title="سجلات السنة" />
        <Card><Empty icon="school" title="لا شعب بعد" action="إضافة صف" onAction={() => router.replace('/class/new')} /></Card>
      </Screen>
    );
  }

  const create = () => {
    if (existing) {
      Alert.alert('سجلات سنة موجودة', `${arDigits(existing)} من الشعب المختارة لديها سجلات سنة. إنشاء مجموعة ثانية يكرر الأسماء نفسها — هل تريد ذلك فعلاً؟ (لسنة جديدة: أرشف القديمة أولاً)`, [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'إنشاء مجموعة ثانية', onPress: doCreate },
      ]);
      return;
    }
    doCreate();
  };
  const doCreate = () => {
    const ids = createYearSet(picked, plan);
    toast(picked.length > 1 ? `أُنشئت السجلات لـ${countSections(picked.length)}` : 'أُنشئت سجلات السنة', { icon: 'check' });
    if (picked.length === 1) router.replace(`/book/${ids[0]}`);
    else router.replace('/grades');
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="سجلات السنة" subtitle="حدّد حقول الامتحان مرة واحدة، والباقي يُبنى وحده" />

      <View style={{ gap: 8 }}>
        <T weight="bold" size={15}>١. حقول امتحان الشهر</T>
        <T dim size={12}>تُستعمل في الأشهر الأربعة، ويمكنك تعديل أي سجل لاحقاً.</T>
        <ComponentsEditor value={components} onChange={setComponents} />
      </View>

      <View style={{ gap: 8 }}>
        <T weight="bold" size={15}>٢. امتحان نصف السنة</T>
        <Segmented options={[{ key: 'one', label: `درجة واحدة من ${arDigits(total || 100)}` }, { key: 'same', label: 'نفس حقول الشهر' }]} value={midSame} onChange={setMidSame} />
      </View>

      <View style={{ gap: 4 }}>
        <T weight="bold" size={15}>٣. النجاح والدرجات الحرجة</T>
        <Row style={{ justifyContent: 'space-between', paddingVertical: 6 }}>
          <T size={14}>حد النجاح (من ١٠٠)</T>
          <Stepper value={pass} onChange={setPass} min={30} max={80} step={5} />
        </Row>
        <ToggleRow title="نبّهني بالدرجات القريبة من النجاح" subtitle={`في السعي: إن كانت الدرجة ${arDigits(pass - below)}–${arDigits(pass - 1)} (من ١٠٠) تُعرض عليك لتقرر رفعها إلى ${arDigits(pass)}. لا شيء يتغير بدون موافقتك.`} value={boost} onChange={setBoost} />
        {boost ? (
          <Row style={{ justifyContent: 'space-between' }}>
            <T size={14}>عدد الدرجات تحت النجاح</T>
            <Stepper value={below} onChange={setBelow} min={1} max={10} />
          </Row>
        ) : null}
        <ToggleRow title="إضافة الامتحان النهائي" subtitle="النتيجة النهائية = (السعي السنوي + النهائي) ÷ 2" value={final} onChange={setFinal} />
      </View>

      <View style={{ gap: 8 }}>
        <T weight="bold" size={15}>٤. الشعب</T>
        <SectionPicker sections={sections} picked={picked} onToggle={(id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))} onAll={(all) => setPicked(all ? sections.map((x) => x.s.id) : [])} />
        {existing ? <T size={12} color={c.ink2}>تنبيه: {arDigits(existing)} من الشعب المختارة لديها سجلات سنة سابقة — ستُضاف مجموعة جديدة بجانبها.</T> : null}
      </View>

      {preview.length ? (
        <Card style={{ gap: 2, paddingVertical: 8 }}>
          <T weight="bold" size={14} style={{ paddingBottom: 6 }}>سيُنشأ لكل شعبة:</T>
          {preview.map((b) => (
            <Row key={b.id} gap={10} style={{ paddingVertical: 6 }}>
              <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: b.role === 'month' || b.role === 'mid' ? c.soft : c.accent, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={b.role === 'month' || b.role === 'mid' ? 'edit' : 'formula'} size={13} color={b.role === 'month' || b.role === 'mid' ? c.accent : c.accentInk} />
              </View>
              <T size={14} weight="medium" style={{ flex: 1 }}>{b.title}</T>
              <T dim size={12}>{b.role === 'month' || b.role === 'mid' ? b.columns.filter((x) => x.kind === 'input').map((x) => x.name).join(' · ') : 'يُحسب وحده'}</T>
            </Row>
          ))}
        </Card>
      ) : null}

      <Button title={picked.length ? `إنشاء السجلات (${countSections(picked.length)})` : 'اختر شعبة'} icon="check" disabled={!picked.length || !validComponents(components)} onPress={create} />
    </Screen>
  );
}
