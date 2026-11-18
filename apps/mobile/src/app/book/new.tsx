import { cloneColumns, countSections, schoolYear, TEMPLATES, type TemplateDef } from '@midad/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Icon } from '@/components/icon';
import { PressScale } from '@/components/motion';
import { Button, Card, Chip, Empty, Field, Header, Row, Screen, T } from '@/components/ui';
import { count, insert, useQuery } from '@/data/db';
import { allSections, sectionLabel } from '@/data/queries';
import { useTheme } from '@/lib/theme';
import { toast } from '@/lib/toast';

/** سجل جديد: اختيار القالب ثم العنوان والشعب */
export default function NewBook() {
  const { section } = useLocalSearchParams<{ section?: string }>();
  const { c, surface } = useTheme();
  const [tpl, setTpl] = useState<TemplateDef | null>(null);
  const [title, setTitle] = useState('');
  const [picked, setPicked] = useState<string[]>(section ? [section] : []);
  const sections = useQuery(() => allSections().map((s) => ({ s, n: count('students', (x) => x.section_id === s.id) })));

  if (!sections.length) {
    return (
      <Screen edges={['top', 'bottom']}>
        <Header title="سجل جديد" />
        <Card><Empty icon="school" title="لا شعب بعد" body="أضف صفاً وشعبة أولاً." action="إضافة صف" onAction={() => router.replace('/class/new')} /></Card>
      </Screen>
    );
  }

  if (!tpl) {
    return (
      <Screen edges={['top', 'bottom']}>
        <Header title="سجل جديد" subtitle="اختر قالباً — يمكنك تعديل الأعمدة والمعادلات بعدها" />
        {TEMPLATES.map((t) => (
          <PressScale key={t.key} onPress={() => { setTpl(t); setTitle(t.key === 'blank' ? '' : t.key === 'monthly' ? 'امتحان شهري' : `سجل ${t.title}`); }} scaleTo={0.98}
            style={{ backgroundColor: c.card, borderRadius: 22, ...surface, padding: 16, flexDirection: 'row', gap: 14, alignItems: 'center' }}>
            <View style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: t.key === 'saey' ? c.accent : c.soft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={t.key === 'blank' ? 'plus' : t.key === 'monthly' ? 'quiz' : t.key === 'quizzes' ? 'list' : 'table'} size={22} color={t.key === 'saey' ? c.accentInk : c.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <T weight="bold" size={16}>{t.title}</T>
              <T dim size={13}>{t.description}</T>
            </View>
          </PressScale>
        ))}
      </Screen>
    );
  }

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const create = () => {
    const base = tpl.build();
    let firstId = '';
    for (const sid of picked) {
      const { columns, result } = cloneColumns(base.columns, base.result);
      const b = insert('gradebooks', { section_id: sid, title: title.trim(), template: tpl.key, columns, result, year: schoolYear() });
      if (!firstId) firstId = b.id;
    }
    toast(picked.length > 1 ? `أُنشئ السجل لـ${countSections(picked.length)}` : 'أُنشئ السجل', { icon: 'check' });
    if (picked.length === 1) router.replace(`/book/${firstId}`);
    else router.replace('/grades');
  };

  const preview = tpl.build();
  return (
    <Screen edges={['top', 'bottom']}>
      <Header title={tpl.title} subtitle="العنوان والشعب" />
      <Field label="عنوان السجل" value={title} onChangeText={setTitle} placeholder="مثال: امتحان الشهر الأول" autoFocus />
      <View style={{ gap: 8 }}>
        <T weight="bold" size={14}>الأعمدة</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {preview.columns.map((col) => (
            <View key={col.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: col.kind === 'formula' ? c.soft : c.card, borderWidth: col.kind === 'formula' ? 0 : 1, borderColor: c.line, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 }}>
              {col.kind === 'formula' ? <Icon name="formula" size={13} color={c.accent} /> : null}
              <T size={12} weight="medium" color={col.kind === 'formula' ? c.softInk : c.ink}>{col.name}</T>
            </View>
          ))}
        </View>
      </View>
      <View style={{ gap: 8 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T weight="bold" size={14}>الشعب</T>
          <Chip small label={picked.length === sections.length ? 'إلغاء الكل' : 'الكل'} onPress={() => setPicked(picked.length === sections.length ? [] : sections.map((x) => x.s.id))} />
        </Row>
        <T dim size={12}>اختر أكثر من شعبة لإنشاء نفس السجل لكل منها دفعة واحدة.</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {sections.map(({ s, n }) => <Chip key={s.id} label={`${sectionLabel(s.id, true)} (${n})`.replace(/\d+/g, (d) => d.replace(/[0-9]/g, (x) => '٠١٢٣٤٥٦٧٨٩'[Number(x)]))} active={picked.includes(s.id)} onPress={() => toggle(s.id)} />)}
        </View>
      </View>
      <Row gap={10}>
        <Button title="رجوع" variant="secondary" onPress={() => setTpl(null)} />
        <Button title="إنشاء السجل" icon="check" style={{ flex: 1 }} disabled={!title.trim() || !picked.length} onPress={create} />
      </Row>
    </Screen>
  );
}
