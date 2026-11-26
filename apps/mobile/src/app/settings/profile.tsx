import { COMMON_SUBJECTS, GOVERNORATES, schoolYear, type TeacherProfile } from '@nahj/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Group } from '@/components/kit';
import { Button, Chip, Field, Header, Screen, Segmented, T } from '@/components/ui';
import { setSettings, useSettings } from '@/data/db';
import { toast } from '@/lib/toast';

/** ملف المدرس: يظهر في الترويسة والتوقيع عند الطباعة */
export default function Profile() {
  const p = useSettings().profile;
  const [form, setForm] = useState<TeacherProfile>(p ?? { name: '', school: '', subject: '', governorate: '', gender: 'm' });
  const dirty = JSON.stringify(form) !== JSON.stringify(p);
  const set = <K extends keyof TeacherProfile>(k: K, v: TeacherProfile[K]) => setForm((f) => ({ ...f, [k]: v }));
  const save = () => {
    // العام الدراسي يُحسب دائماً من التاريخ (لا يبقى عام التثبيت مطبوعاً في السنوات التالية)
    setSettings({ profile: { ...form, name: form.name.trim(), school: form.school.trim(), subject: form.subject.trim(), principal: form.principal?.trim() || '', year: undefined } });
    toast('حُفظ الملف', { icon: 'check' });
    if (router.canGoBack()) router.back();
  };
  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="ملفك" subtitle={`يظهر في الطباعة — العام الدراسي ${schoolYear()}`} />
      <Group>
        <View style={{ gap: 12, paddingVertical: 12 }}>
          <Field label="الاسم" value={form.name} onChangeText={(v) => set('name', v)} />
          <Segmented options={[{ key: 'm', label: 'أستاذ' }, { key: 'f', label: 'ست' }]} value={form.gender} onChange={(v) => set('gender', v)} />
          <Field label="المادة" value={form.subject} onChangeText={(v) => set('subject', v)} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {COMMON_SUBJECTS.slice(0, 12).map((x) => <Chip key={x} small label={x} active={form.subject === x} onPress={() => set('subject', x)} />)}
          </View>
        </View>
      </Group>
      <Group title="المدرسة">
        <View style={{ gap: 12, paddingVertical: 12 }}>
          <Field label="اسم المدرسة" value={form.school} onChangeText={(v) => set('school', v)} placeholder="مثال: إعدادية الكرخ للبنين" />
          <Field label="اسم مدير المدرسة (للتوقيع)" value={form.principal ?? ''} onChangeText={(v) => set('principal', v)} />
          <T weight="bold" size={14}>المحافظة (المديرية العامة للتربية)</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {GOVERNORATES.map((g) => <Chip key={g} small label={g} active={form.governorate === g} onPress={() => set('governorate', form.governorate === g ? '' : g)} />)}
          </View>
          {!form.governorate ? <T dim size={12}>بلا محافظة: تُطبع «وزارة التربية» فقط دون اسم المديرية.</T> : null}
        </View>
      </Group>
      <Button title="حفظ" icon="check" disabled={!dirty || form.name.trim().length < 2} onPress={save} />
    </Screen>
  );
}
