import * as Linking from 'expo-linking';
import { Share, View } from 'react-native';
import { LogoMark } from '@/components/icon';
import { Group } from '@/components/kit';
import { Card, Divider, Header, ListItem, Screen, T } from '@/components/ui';
import { APP_VERSION, BUILD_NUMBER, SITE_URL } from '@/lib/config';
import { useTheme } from '@/lib/theme';
import { arDigits } from '@midad/shared';

export default function About() {
  const { c } = useTheme();
  return (
    <Screen>
      <Header />
      <View style={{ alignItems: 'center', gap: 10, paddingVertical: 12 }}>
        <View style={{ width: 96, height: 96, borderRadius: 30, backgroundColor: c.heroBg, alignItems: 'center', justifyContent: 'center' }}>
          <LogoMark size={64} ink="#F5F2EA" dot="#F2B544" check="#173A33" />
        </View>
        <T display size={44}>مِداد</T>
        <T dim size={15}>دفترك كلّه، بصوتك.</T>
        <T dim size={12}>الإصدار {arDigits(APP_VERSION)}{BUILD_NUMBER ? ` · بناء ${arDigits(BUILD_NUMBER)}` : ''}</T>
      </View>
      <Card style={{ gap: 8 }}>
        <T serif size={15} style={{ lineHeight: 28 }}>
          مِداد تطبيق للمدرّس العراقي: يجمع الصفوف والشعب، وسجلات الدرجات بالمعادلات والقوالب الرسمية، والإدخال الصوتي للدرجات، والحضور والغياب، وجدول الحصص، ودفتر التحضير — في مكان واحد يعمل بلا إنترنت.
        </T>
        <T dim size={13}>بياناتك محفوظة على هاتفك أولاً، وتُنسخ إلى حسابك في السحابة إن سجّلت الدخول. لا نشارك بياناتك مع أي جهة.</T>
      </Card>
      <Group>
        <ListItem icon="link" title="الموقع" subtitle={SITE_URL.replace('https://', '')} onPress={() => Linking.openURL(SITE_URL)} />
        <Divider />
        <ListItem icon="share" title="شارك مِداد" onPress={() => Share.share({ message: `مِداد — تطبيق المدرّس العراقي\n${SITE_URL}` }).catch(() => {})} />
        <Divider />
        <ListItem icon="lock" title="سياسة الخصوصية" onPress={() => Linking.openURL(`${SITE_URL}/privacy.html`)} />
      </Group>
    </Screen>
  );
}
