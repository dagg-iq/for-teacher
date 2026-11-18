import { teacherTitle } from '@rasd/shared';
import { router } from 'expo-router';
import { Share, View } from 'react-native';
import { LogoMark, type IconName } from '@/components/icon';
import { Group } from '@/components/kit';
import { Card, Divider, Header, ListItem, Row, Screen, T } from '@/components/ui';
import { useSettings } from '@/data/db';
import { useSyncStatus } from '@/data/sync';
import { useAuth } from '@/lib/auth';
import { SITE_URL } from '@/lib/config';
import { useTheme } from '@/lib/theme';

const TOOLS: { icon: IconName; title: string; subtitle: string; href: string }[] = [
  { icon: 'check-square', title: 'الحضور والغياب', subtitle: 'تسجيل يومي سريع وتقارير', href: '/attendance' },
  { icon: 'clipboard', title: 'التحضير اليومي', subtitle: 'دفتر التحضير: الأهداف والوسائل والخطوات', href: '/plans' },
  { icon: 'flag', title: 'المهام والتقويم', subtitle: 'الامتحانات والاجتماعات والتذكيرات', href: '/tasks' },
  { icon: 'shuffle', title: 'القرعة والمجموعات', subtitle: 'اختيار طالب عشوائياً أو تقسيم الشعبة', href: '/picker' },
  { icon: 'timer', title: 'مؤقت الحصة', subtitle: 'مؤقت للنشاط أو الاختبار القصير', href: '/timer' },
];

export default function More() {
  const { c } = useTheme();
  const p = useSettings().profile;
  const { email } = useAuth();
  const sync = useSyncStatus();
  return (
    <Screen>
      <Header back={false} title="المزيد" />
      <Card onPress={() => router.push('/settings')} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
          <T weight="bold" size={22} color={c.accentInk}>{p?.name?.charAt(0) ?? 'م'}</T>
        </View>
        <View style={{ flex: 1 }}>
          <T weight="bold" size={17}>{p ? teacherTitle(p.name, p.gender) : 'ملفك'}</T>
          <T dim size={13} lines={1}>{[p?.subject, p?.school].filter(Boolean).join(' · ') || 'أكمل معلوماتك'}</T>
        </View>
      </Card>
      <Group title="الأدوات">
        {TOOLS.map((t, i) => (
          <View key={t.href}>
            {i ? <Divider /> : null}
            <ListItem icon={t.icon} title={t.title} subtitle={t.subtitle} onPress={() => router.push(t.href as never)} />
          </View>
        ))}
      </Group>
      <Group title="الحساب">
        <ListItem icon={sync.state === 'error' ? 'cloud-off' : 'cloud'} title="الحساب والمزامنة"
          subtitle={sync.state === 'off' ? 'بياناتك محفوظة على هذا الهاتف' : email ? email : 'سجّل الدخول لحفظ بياناتك في السحابة'} onPress={() => router.push('/account')} />
        <Divider />
        <ListItem icon="settings" title="الإعدادات" subtitle="الملف، المظهر، الإدخال الصوتي، النسخ الاحتياطي" onPress={() => router.push('/settings')} />
      </Group>
      <Group title="رَصد">
        <ListItem icon="share" title="شارك التطبيق مع زملائك" onPress={() => Share.share({ message: `رَصد — تطبيق المدرّس العراقي: سجل الدرجات، الإدخال الصوتي، الحضور، والجدول.\n${SITE_URL}` }).catch(() => {})} />
        <Divider />
        <ListItem icon="info" title="عن رَصد" onPress={() => router.push('/about')} />
      </Group>
      <Row style={{ justifyContent: 'center', gap: 8, marginTop: 8, opacity: 0.6 }}>
        <LogoMark size={20} ink={c.ink} dot={c.gold} />
        <T dim size={12}>رَصد — ارصد بصوتك.</T>
      </Row>
      <View style={{ height: 150 }} />
    </Screen>
  );
}
