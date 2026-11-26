import { arDigits, cloneColumns, COMPONENT_PRESETS, countSections, schoolYear, TEMPLATES, type Component, type TemplateDef } from '@nahj/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { ComponentsEditor, SectionPicker, validComponents } from '@/components/components-editor';
import { Icon, type IconName } from '@/components/icon';
import { PressScale } from '@/components/motion';
import { Button, Card, Empty, Field, Header, Row, Screen, T } from '@/components/ui';
import { count, insert, useQuery } from '@/data/db';
import { allSections } from '@/data/queries';
import { useTheme } from '@/lib/theme';
import { toast } from '@/lib/toast';

const ICONS: Record<string, IconName> = { month: 'table', single: 'quiz', blank: 'formula' };

/** سجل جديد: سجلات السنة كاملة (الأنسب)، أو سجل واحد بمكوّنات، أو درجة واحدة، أو سجل مخصص */
export default function NewBook() {
  const { section } = useLocalSearchParams<{ section?: string }>();
  const { c, surface } = useTheme();
  const [tpl, setTpl] = useState<TemplateDef | null>(null);
  const [title, setTitle] = useState('');
  const [components, setComponents] = useState<Component[]>(COMPONENT_PRESETS[0].items.map((x) => ({ ...x })));
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
        <Header title="سجل جديد" subtitle="كل السجلات قابلة للتعديل بعد إنشائها" />
        <PressScale onPress={() => router.replace(`/book/year${section ? `?section=${section}` : ''}`)} scaleTo={0.98}
          style={{ backgroundColor: c.heroBg, borderRadius: 22, padding: 18, gap: 10 }}>
          <Row gap={12}>
            <View style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="calendar" size={22} color="#FFFFFF" accent={c.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <T weight="bold" size={17} color={c.heroInk}>سجلات السنة كاملة</T>
              <T size={13} color={c.heroInk2}>الأنسب لأغلب المدرسين</T>
            </View>
          </Row>
          <T size={13} color={c.heroInk2} style={{ lineHeight: 22 }}>
            الشهر الأول والثاني لكل فصل (تحريري، شفهي…)، وسعي الفصل الأول والثاني، ونصف السنة، والسعي السنوي — كل امتحان في سجله، والسعي يُحسب وحده.
          </T>
        </PressScale>
        {TEMPLATES.map((t) => (
          <PressScale key={t.key} onPress={() => { setTpl(t); setTitle(t.key === 'blank' ? '' : t.key === 'single' ? 'اختبار' : 'امتحان شهري'); }} scaleTo={0.98}
            style={{ backgroundColor: c.card, borderRadius: 22, ...surface, padding: 16, flexDirection: 'row', gap: 14, alignItems: 'center' }}>
            <View style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={ICONS[t.key] ?? 'table'} size={22} color={c.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <T weight="bold" size={16}>{arDigits(t.title)}</T>
              <T dim size={13}>{arDigits(t.description)}</T>
            </View>
          </PressScale>
        ))}
      </Screen>
    );
  }

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const ok = title.trim() && picked.length && (tpl.key !== 'month' || validComponents(components));
  const create = () => {
    const base = tpl.build(components);
    let firstId = '';
    for (const sid of picked) {
      const { columns, result } = cloneColumns(base.columns, base.result);
      const b = insert('gradebooks', { section_id: sid, title: title.trim(), template: tpl.key, columns, result, year: schoolYear(), role: 'custom' });
      if (!firstId) firstId = b.id;
    }
    toast(picked.length > 1 ? `أُنشئ السجل لـ${countSections(picked.length)}` : 'أُنشئ السجل', { icon: 'check' });
    if (tpl.key === 'blank' && picked.length === 1) router.replace(`/book/columns?id=${firstId}`);
    else if (picked.length === 1) router.replace(`/book/${firstId}`);
    else router.replace('/grades');
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title={arDigits(tpl.title)} subtitle="العنوان والشعب" />
      <Field label="عنوان السجل" value={title} onChangeText={setTitle} placeholder="مثال: امتحان الفصل الأول" autoFocus />
      {tpl.key === 'month' ? (
        <View style={{ gap: 8 }}>
          <T weight="bold" size={14}>حقول الدرجة</T>
          <ComponentsEditor value={components} onChange={setComponents} />
        </View>
      ) : tpl.key === 'blank' ? (
        <Card tone="soft"><T size={13} color={c.softInk}>بعد الإنشاء تفتح صفحة الأعمدة: أضف الحقول والمعادلات كما تريد.</T></Card>
      ) : null}
      <SectionPicker sections={sections} picked={picked} onToggle={toggle} onAll={(all) => setPicked(all ? sections.map((x) => x.s.id) : [])} />
      <Row gap={10}>
        <Button title="رجوع" variant="secondary" onPress={() => setTpl(null)} />
        <Button title="إنشاء السجل" icon="check" style={{ flex: 1 }} disabled={!ok} onPress={create} />
      </Row>
    </Screen>
  );
}
