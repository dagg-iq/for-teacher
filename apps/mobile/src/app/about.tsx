import { arDigits } from '@nahj/shared';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, Share, View } from 'react-native';
import { DeveloperCard } from '@/components/developer';
import { Icon, LogoMark, Wordmark, type IconName } from '@/components/icon';
import { Intro } from '@/components/intro';
import { Group } from '@/components/kit';
import { Portal } from '@/components/portal';
import { DownloadStatus } from '@/components/update-sheet';
import { checkDesktopUpdate, DesktopUpdateSheet, type DesktopUpdateInfo } from '@/components/desktop-update';
import { Button, Card, Divider, Header, ListItem, Row, Screen, SectionTitle, T } from '@/components/ui';
import { APP_VERSION, BUILD_NUMBER, IS_DESKTOP, SITE_URL } from '@/lib/config';
import { useTheme } from '@/lib/theme';
import { toast } from '@/lib/toast';
import { applyOta, checkForApk, fetchOta, otaEnabled, otaLabel, type UpdateInfo } from '@/lib/updater';

const FEATURES: { icon: IconName; title: string; body: string }[] = [
  { icon: 'school', title: 'صفوفك وطلابك', body: 'الصفوف والشعب والطلاب، مع ملف لكل طالب وملاحظاته وغيابه.' },
  { icon: 'chart', title: 'سجلات تحسب وحدها', body: 'قوالب عراقية رسمية ومعادلاتك الخاصة، والتقديرات والإحصاء.' },
  { icon: 'mic', title: 'الدرجات بالصوت', body: 'قل الاسم والدرجة، ويفهم اللهجة العراقية ويؤكد قبل الكتابة.' },
  { icon: 'calendar', title: 'الجدول والتذكير', body: 'حصتك الآن والقادمة، وتذكير قبلها، وويدجت على الشاشة.' },
  { icon: 'print', title: 'طباعة وExcel', body: 'ترويسة رسمية جاهزة للطباعة، وتصدير واستيراد Excel.' },
];

export default function About() {
  const { c } = useTheme();
  const [intro, setIntro] = useState(false);
  const [checking, setChecking] = useState(false);
  const [desk, setDesk] = useState<DesktopUpdateInfo | null>(null);
  const [apk, setApk] = useState<UpdateInfo | null>(null);
  const [otaReady, setOtaReady] = useState(false);
  const ota = otaLabel();

  const check = async () => {
    if (checking) return;
    setChecking(true);
    try {
      const [o, a] = await Promise.all([fetchOta().catch(() => 'none' as const), checkForApk(true).catch(() => null)]);
      if (a) setApk(a);
      if (o === 'downloaded') setOtaReady(true);
      if (!a && o !== 'downloaded') toast('عندك آخر نسخة من نَهج', { icon: 'check' });
    } finally {
      setChecking(false);
    }
  };

  return (
    <Screen>
      {intro ? <Portal><Intro onDone={() => setIntro(false)} /></Portal> : null}
      <Header />

      <View style={{ borderRadius: 24, overflow: 'hidden', backgroundColor: '#0E3B33', alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20, gap: 10 }}>
        {/* الضغط على الشعار يعيد حركته التي تظهر عند فتح التطبيق */}
        <Pressable onPress={() => setIntro(true)} accessibilityRole="button" accessibilityLabel="عرض حركة شعار نَهج"
          style={({ pressed }) => ({ width: 96, height: 96, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.94 : 1 }] })}>
          <LogoMark size={64} ink="#F7F5F0" dot={c.gold} />
        </Pressable>
        <Wordmark height={46} color="#FFFFFF" />
        <Row gap={8}>
          <View style={{ width: 7, height: 7, backgroundColor: c.gold }} />
          <T size={15} color="#AFC8C1">التدريس بنهجٍ أذكى.</T>
        </Row>
        <Row gap={8} style={{ marginTop: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Pill text={`الإصدار ${arDigits(APP_VERSION)}`} />
          {BUILD_NUMBER ? <Pill text={`البناء ${arDigits(BUILD_NUMBER)}`} /> : null}
          {ota ? <Pill text={`تحديث ${arDigits(ota)}`} /> : null}
        </Row>
      </View>

      <Card style={{ gap: 8 }}>
        <T weight="bold" size={17}>ما هو نَهج؟</T>
        <T dim size={14} style={{ lineHeight: 24 }}>
          تطبيق مجاني صُنع للمدرّس العراقي: يجمع عمله اليومي في مكان واحد بدل الدفاتر والأوراق المتفرقة. يعمل بلا إنترنت، وبياناتك على هاتفك أولاً، وتُنسخ إلى حسابك في السحابة إن سجّلت الدخول. لا نشارك بياناتك مع أي جهة.
        </T>
      </Card>

      <SectionTitle title="ماذا يقدّم لك" />
      <Card style={{ paddingVertical: 4 }}>
        {FEATURES.map((f, i) => (
          <View key={f.title}>
            {i ? <Divider /> : null}
            <Row style={{ paddingVertical: 12, alignItems: 'flex-start' }} gap={14}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={f.icon} size={20} color={c.accent} accent={c.gold} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <T weight="bold" size={15}>{f.title}</T>
                <T dim size={13} style={{ lineHeight: 21 }}>{f.body}</T>
              </View>
            </Row>
          </View>
        ))}
      </Card>

      <SectionTitle title="التحديثات" />
      <Card style={{ gap: 12 }}>
        <View style={{ gap: 2 }}>
          <T weight="bold" size={15}>نسختك {arDigits(BUILD_NUMBER || APP_VERSION)}</T>
          <T dim size={13} style={{ lineHeight: 21 }}>
            {otaEnabled()
              ? 'التحسينات الصغيرة تصل وحدها بلا تنزيل وتُطبَّق عند فتح التطبيق. النسخ الكبيرة تُحمَّل من هنا.'
              : 'التطبيق يخبرك عند صدور نسخة جديدة، وتحمّلها من هنا مباشرة.'}
          </T>
        </View>
        {otaReady ? <Button title="طبّق التحديث الآن" icon="refresh" onPress={() => applyOta().catch(() => toast('سيُطبَّق عند الفتح القادم'))} /> : null}
        {apk ? (
          <View style={{ gap: 8 }}>
            <T size={14} weight="bold">النسخة {arDigits(apk.version)} متاحة{apk.sizeMb ? ` (${arDigits(apk.sizeMb)} ميغا)` : ''}</T>
            <DownloadStatus info={apk} />
          </View>
        ) : null}
        {Platform.OS !== 'web' ? <Button title={checking ? 'يتحقق…' : 'التحقق من التحديثات'} variant="secondary" icon="refresh" loading={checking} onPress={check} /> : null}
        {IS_DESKTOP ? <Button title={checking ? 'يتحقق…' : 'التحقق من التحديثات'} variant="secondary" icon="refresh" loading={checking} onPress={async () => {
          setChecking(true);
          const u = await checkDesktopUpdate();
          setChecking(false);
          if (u) setDesk(u); else toast('عندك آخر نسخة', { icon: 'check' });
        }} /> : null}
        {desk ? <DesktopUpdateSheet info={desk} onClose={() => setDesk(null)} /> : null}
      </Card>

      <SectionTitle title="المطوّر" />
      <DeveloperCard />

      <Group title="المزيد">
        <ListItem icon="link" title="موقع نَهج" subtitle={SITE_URL.replace('https://', '')} onPress={() => Linking.openURL(SITE_URL).catch(() => {})} />
        <Divider />
        <ListItem icon="share" title="شارك نَهج مع زملائك" subtitle="أرسل رابط التنزيل" onPress={() => Share.share({ message: `نَهج — تطبيق المدرّس العراقي: الدرجات بالصوت، السجلات، الجدول والحضور.\n${SITE_URL}` }).catch(() => {})} />
        <Divider />
        <ListItem icon="lock" title="سياسة الخصوصية" onPress={() => Linking.openURL(`${SITE_URL}/privacy.html`).catch(() => {})} />
        <Divider />
        <ListItem icon="file" title="شروط الاستخدام" onPress={() => Linking.openURL(`${SITE_URL}/terms.html`).catch(() => {})} />
        <Divider />
        <ListItem icon="note" title="التراخيص" subtitle="المكتبات مفتوحة المصدر والخطوط" onPress={() => router.push('/licenses')} />
      </Group>

      <View style={{ alignItems: 'center', gap: 6, paddingVertical: 12 }}>
        <Row gap={8}>
          <View style={{ width: 6, height: 6, backgroundColor: c.gold }} />
          <T dim size={12}>صُنع في العراق، للمدرّس العراقي</T>
        </Row>
        <T dim size={11}>© {arDigits(new Date().getFullYear())} نَهج</T>
      </View>
    </Screen>
  );
}

function Pill({ text }: { text: string }) {
  return (
    <View style={{ paddingHorizontal: 12, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' }}>
      <T size={12} weight="bold" color="#F7F5F0">{text}</T>
    </View>
  );
}
