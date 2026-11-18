import { COMMON_SUBJECTS, GOVERNORATES, schoolYear, type TeacherProfile } from '@nahj/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, LogoMark, Wordmark, type IconName } from '@/components/icon';
import { enter, PressScale } from '@/components/motion';
import { Button, Chip, Field, Row, Segmented, T } from '@/components/ui';
import { setSettings, useSettings } from '@/data/db';
import { seedDemo } from '@/data/demo';
import { isConfigured } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { toast } from '@/lib/toast';

const FEATURES: { icon: IconName; title: string; body: string }[] = [
  { icon: 'school', title: 'صفوفك وطلابك', body: 'الصفوف والشعب والطلاب في مكان واحد، مع ملف لكل طالب.' },
  { icon: 'chart', title: 'سجل درجات يحسب وحده', body: 'السعي السنوي والمعدلات والتقديرات بقوالب عراقية أو بمعادلاتك، مع الإحصاء.' },
  { icon: 'calendar', title: 'جدولك وحضورك وتحضيرك', body: 'حصتك القادمة، الغياب بضغطة، دفتر التحضير، وتذكير قبل كل حصة.' },
  { icon: 'excel', title: 'طباعة رسمية وExcel', body: 'صدّر السجلات أو اطبعها بترويسة رسمية، وأدخل الدرجات بالصوت إن شئت.' },
];

export default function Welcome() {
  const [step, setStep] = useState<0 | 1>(0);
  return step === 0 ? <Intro onNext={() => setStep(1)} /> : <ProfileForm onBack={() => setStep(0)} />;
}

function Intro({ onNext }: { onNext: () => void }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#0E3B33' }} contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: insets.top + 36, paddingBottom: insets.bottom + 24, gap: 26, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
      <Animated.View entering={enter(0)} style={{ gap: 10 }}>
        <LogoMark size={72} ink="#F7F5F0" dot={c.gold} />
        <Wordmark height={64} color="#FFFFFF" />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: -6 }}>
          <View style={{ width: 8, height: 8, backgroundColor: c.gold }} />
          <T size={18} color="#AFC8C1">التدريس بنهجٍ أذكى.</T>
        </View>
      </Animated.View>
      <View style={{ gap: 0, flex: 1 }}>
        {FEATURES.map((f, i) => (
          <Animated.View key={f.title} entering={enter(i + 1)} style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start', paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: 'rgba(255,255,255,0.10)' }}>
            <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={f.icon} size={21} color="#FFFFFF" accent={c.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <T weight="bold" size={16} color="#FFFFFF">{f.title}</T>
              <T size={14} color="#AFC8C1">{f.body}</T>
            </View>
          </Animated.View>
        ))}
      </View>
      <View style={{ gap: 10 }}>
        <PressScale onPress={onNext} haptic scaleTo={0.97} accessibilityRole="button" accessibilityLabel="لنبدأ"
          style={{ height: 56, borderRadius: 28, backgroundColor: '#F7F5F0', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <T weight="bold" size={17} color="#0E3B33">لنبدأ</T>
          <Icon name="forward" size={20} color="#0E3B33" strokeWidth={2.2} />
        </PressScale>
        {isConfigured ? <Button title="لدي حساب — تسجيل الدخول" variant="secondary" onPress={() => router.push("/account")} /> : null}
      </View>
    </ScrollView>
  );
}

function ProfileForm({ onBack }: { onBack: () => void }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const existing = useSettings().profile;
  const [name, setName] = useState(existing?.name ?? '');
  const [gender, setGender] = useState<'m' | 'f'>(existing?.gender ?? 'm');
  const [subject, setSubject] = useState(existing?.subject ?? '');
  const [school, setSchool] = useState(existing?.school ?? '');
  const [gov, setGov] = useState(existing?.governorate ?? 'بغداد');
  const [showAll, setShowAll] = useState(false);

  const ok = name.trim().length >= 2;
  const save = (demo: boolean) => {
    const profile: TeacherProfile = { name: name.trim(), gender, subject: subject.trim(), school: school.trim(), governorate: gov, year: schoolYear() };
    if (demo) {
      seedDemo();
      setSettings({ profile: { ...profile, name: profile.name || 'محمد حازم' } });
      toast('أُضيفت بيانات تجريبية — يمكنك حذفها من الإعدادات', { icon: 'sparkle' });
    } else {
      setSettings({ profile });
    }
    router.replace('/');
  };

  const subjects = showAll ? COMMON_SUBJECTS : COMMON_SUBJECTS.slice(0, 8);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: 20, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32, gap: 18, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Chip label="رجوع" onPress={onBack} />
        <T dim size={13}>الخطوة ٢ من ٢</T>
      </Row>
      <View style={{ gap: 4 }}>
        <T display size={32}>عرّفنا بك</T>
        <T dim size={14}>تظهر هذه المعلومات في الطباعة والتقارير. يمكنك تغييرها لاحقاً.</T>
      </View>
      <Field label="الاسم" value={name} onChangeText={setName} placeholder="مثال: محمد حازم" autoFocus />
      <View style={{ gap: 6 }}>
        <T weight="bold" size={14}>اللقب</T>
        <Segmented options={[{ key: 'm', label: 'أستاذ' }, { key: 'f', label: 'ست' }]} value={gender} onChange={setGender} />
      </View>
      <View style={{ gap: 8 }}>
        <T weight="bold" size={14}>المادة</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {subjects.map((s) => <Chip key={s} label={s} active={subject === s} onPress={() => setSubject(s)} />)}
          {!showAll ? <Chip label="المزيد…" onPress={() => setShowAll(true)} /> : null}
        </View>
        <Field value={subject} onChangeText={setSubject} placeholder="أو اكتب مادتك" />
      </View>
      <Field label="المدرسة" value={school} onChangeText={setSchool} placeholder="مثال: إعدادية الرافدين للبنين" />
      <View style={{ gap: 8 }}>
        <T weight="bold" size={14}>المحافظة</T>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {GOVERNORATES.map((g) => <Chip key={g} label={g} active={gov === g} onPress={() => setGov(g)} />)}
        </ScrollView>
      </View>
      <View style={{ gap: 10, marginTop: 8 }}>
        <Button title="ابدأ" icon="check" disabled={!ok} onPress={() => save(false)} />
        <Button title="جرّب ببيانات تجريبية" variant="secondary" icon="sparkle" onPress={() => save(true)} />
      </View>
    </ScrollView>
  );
}
