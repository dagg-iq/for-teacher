import { timeAgo } from '@nahj/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Icon } from '@/components/icon';
import { Group } from '@/components/kit';
import { Button, Card, Divider, Header, ListItem, Row, Screen, T } from '@/components/ui';
import { cloudBackupAvailable } from '@/data/cloud-backup';
import { syncNow, useSyncStatus, type AccountStatus } from '@/data/sync';
import { SignInGate } from '@/components/gate';
import { useAuth } from '@/lib/auth';
import { Alert } from '@/lib/dialog';
import { isConfigured } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { toast } from '@/lib/toast';

export default function Account() {
  const { c } = useTheme();
  const { session, email } = useAuth();
  if (!isConfigured) {
    return (
      <Screen>
        <Header title="الحساب" />
        <Card style={{ gap: 10 }}>
          <Icon name="cloud-off" size={28} color={c.accent} />
          <T weight="bold" size={17}>بياناتك محفوظة على هذا الهاتف</T>
          <T dim size={14}>المزامنة السحابية غير مفعّلة في هذه النسخة بعد. يمكنك أخذ نسخة احتياطية في أي وقت ونقلها لهاتف آخر.</T>
          <Button title="النسخ الاحتياطي" icon="download" variant="secondary" onPress={() => router.push('/settings')} />
        </Card>
      </Screen>
    );
  }
  return session ? <Signed email={email} /> : <SignInGate />;
}

function Signed({ email }: { email: string | null }) {
  const { signOut, deleteAccount } = useAuth();
  const sync = useSyncStatus();
  const [busy, setBusy] = useState(false);
  const out = () => Alert.alert('تسجيل الخروج', sync.pending
    ? `لديك ${sync.pending} تغيير لم يُرفع بعد. سنحاول رفعه الآن؛ وإن لم يُرفع يبقى محفوظاً ويُرفع حين تدخل بهذا الحساب مرة أخرى. هل تبقى بياناتك على هذا الهاتف؟`
    : 'هل تبقى بياناتك على هذا الهاتف؟', [
    { text: 'إلغاء', style: 'cancel' },
    { text: 'خروج ومسح الهاتف', style: 'destructive', onPress: async () => { await signOut(true); toast('سُجّل الخروج'); router.replace('/welcome'); } },
    { text: 'خروج مع إبقائها', onPress: async () => { await signOut(false); toast('سُجّل الخروج'); } },
  ]);
  return (
    <Screen>
      <Header title="الحساب" subtitle={email ?? ''} />
      {sync.state === 'waiting' ? <Waiting account={sync.account} /> : null}
      <Card style={{ gap: 10 }}>
        <Row>
          <Icon name={sync.state === 'error' ? 'cloud-off' : 'cloud'} size={24} color={sync.state === 'error' ? '#C8312B' : '#0B6B4B'} />
          <View style={{ flex: 1 }}>
            <T weight="bold" size={16}>{sync.state === 'syncing' ? 'تجري المزامنة…' : sync.state === 'error' ? 'تعذّرت المزامنة' : sync.state === 'waiting' ? 'المزامنة متوقفة مؤقتاً' : 'متزامن'}</T>
            <T dim size={13}>{sync.state === 'error' ? sync.error : sync.lastSync ? `آخر مزامنة ${timeAgo(new Date(sync.lastSync))}` : 'لم تتم بعد'}{sync.pending ? ` · ${sync.pending} تغيير ينتظر` : ''}</T>
          </View>
        </Row>
        <Button title="زامن الآن" icon="refresh" loading={busy || sync.state === 'syncing'} onPress={async () => { setBusy(true); await syncNow(); setBusy(false); }} />
      </Card>
      {cloudBackupAvailable ? (
        <Group>
          <ListItem icon="upload" title="النسخ في السحابة" subtitle="نسخة يومية تلقائية — واستعادة يوم سابق" onPress={() => router.push('/settings/backups')} />
        </Group>
      ) : null}
      <Group>
        <ListItem icon="logout" title="تسجيل الخروج" onPress={out} />
        <Divider />
        <ListItem icon="trash" title="حذف الحساب نهائياً" subtitle="يحذف حسابك وكل بياناتك من السحابة" danger onPress={() => Alert.alert('حذف الحساب نهائياً؟', 'ستُحذف كل صفوفك ودرجاتك من السحابة ومن هذا الهاتف ولا يمكن استرجاعها. خذ نسخة احتياطية أولاً إن احتجت.', [
          { text: 'إلغاء', style: 'cancel' },
          { text: 'حذف نهائياً', style: 'destructive', onPress: async () => { try { await deleteAccount(); toast('حُذف الحساب'); router.replace('/welcome'); } catch (e) { Alert.alert('تعذّر', e instanceof Error ? e.message : ''); } } },
        ])} />
      </Group>
    </Screen>
  );
}

/** الحساب لم يُفعّل بعد: البيانات محفوظة على الجهاز وتُرفع بعد موافقة المدير */
function Waiting({ account }: { account?: AccountStatus }) {
  const { c } = useTheme();
  const blocked = account === 'suspended' || account === 'rejected';
  return (
    <Card style={{ gap: 10, borderWidth: 1, borderColor: blocked ? '#C8312B' : c.gold }}>
      <Row>
        <Icon name={blocked ? 'lock' : 'clock'} size={24} color={blocked ? '#C8312B' : c.gold} />
        <T weight="bold" size={16} style={{ flex: 1 }}>{blocked ? (account === 'rejected' ? 'لم تتم الموافقة على حسابك' : 'حسابك موقوف') : 'حسابك بانتظار موافقة الإدارة'}</T>
      </Row>
      <T dim size={14}>
        {blocked
          ? 'المزامنة مع السحابة متوقفة. بياناتك ما زالت محفوظة على هذا الجهاز وتستطيع استعمال التطبيق كاملاً. تواصل مع إدارة نَهج.'
          : 'أُرسل طلبك. استعمل التطبيق عادياً الآن: كل ما تُدخله محفوظ على جهازك، ويُرفع إلى حسابك تلقائياً فور الموافقة.'}
      </T>
      {!blocked ? <Button title="تحقّق الآن" icon="refresh" variant="secondary" small onPress={() => syncNow()} /> : null}
    </Card>
  );
}
