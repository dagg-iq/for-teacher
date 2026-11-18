import { timeAgo } from '@midad/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Icon, LogoMark, type IconName } from '@/components/icon';
import { Group } from '@/components/kit';
import { Button, Card, Divider, Field, Header, ListItem, Row, Screen, Segmented, T } from '@/components/ui';
import { syncNow, useSyncStatus } from '@/data/sync';
import { useAuth } from '@/lib/auth';
import { Alert } from '@/lib/dialog';
import { arabicError, isConfigured } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { toast } from '@/lib/toast';

const PERKS: { icon: IconName; text: string }[] = [
  { icon: 'cloud', text: 'نسخة من كل بياناتك في السحابة تلقائياً' },
  { icon: 'refresh', text: 'تغيّر هاتفك؟ سجّل الدخول وتعود كل الدرجات' },
  { icon: 'lock', text: 'بياناتك لك وحدك — لا يراها أحد غيرك' },
];

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
  return session ? <Signed email={email} /> : <SignIn />;
}

function Signed({ email }: { email: string | null }) {
  const { signOut, deleteAccount } = useAuth();
  const sync = useSyncStatus();
  const [busy, setBusy] = useState(false);
  const out = () => Alert.alert('تسجيل الخروج', 'هل تبقى بياناتك على هذا الهاتف؟', [
    { text: 'إلغاء', style: 'cancel' },
    { text: 'خروج ومسح الهاتف', style: 'destructive', onPress: async () => { await signOut(true); toast('سُجّل الخروج'); router.replace('/welcome'); } },
    { text: 'خروج مع إبقائها', onPress: async () => { await signOut(false); toast('سُجّل الخروج'); } },
  ]);
  return (
    <Screen>
      <Header title="الحساب" subtitle={email ?? ''} />
      <Card style={{ gap: 10 }}>
        <Row>
          <Icon name={sync.state === 'error' ? 'cloud-off' : 'cloud'} size={24} color={sync.state === 'error' ? '#C8312B' : '#0B6B4B'} />
          <View style={{ flex: 1 }}>
            <T weight="bold" size={16}>{sync.state === 'syncing' ? 'تجري المزامنة…' : sync.state === 'error' ? 'تعذّرت المزامنة' : 'متزامن'}</T>
            <T dim size={13}>{sync.state === 'error' ? sync.error : sync.lastSync ? `آخر مزامنة ${timeAgo(new Date(sync.lastSync))}` : 'لم تتم بعد'}{sync.pending ? ` · ${sync.pending} تغيير ينتظر` : ''}</T>
          </View>
        </Row>
        <Button title="زامن الآن" icon="refresh" loading={busy || sync.state === 'syncing'} onPress={async () => { setBusy(true); await syncNow(); setBusy(false); }} />
      </Card>
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

function SignIn() {
  const { c } = useTheme();
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, resetPassword } = useAuth();
  const [mode, setMode] = useState<'in' | 'up'>('up');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try { await fn(); } catch (e) { Alert.alert('تعذّر', arabicError(e)); } finally { setBusy(null); }
  };
  const submit = () => run('email', async () => {
    if (mode === 'in') { await signInWithEmail(email, password); toast('أهلاً بعودتك', { icon: 'check' }); router.back(); }
    else {
      const r = await signUpWithEmail(email, password);
      if (r === 'confirm') Alert.alert('تحقق من بريدك', 'أرسلنا رابط التأكيد إلى بريدك. افتحه ثم سجّل الدخول.');
      else { toast('أُنشئ حسابك وبدأت المزامنة', { icon: 'check' }); router.back(); }
    }
  });
  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="الحساب" subtitle="احفظ بياناتك في السحابة" />
      <Card tone="hero" style={{ gap: 12 }}>
        <LogoMark size={36} ink="#FFFFFF" dot="#8F89FF" />
        {PERKS.map((p) => (
          <Row key={p.text} gap={10}>
            <Icon name={p.icon} size={18} color={c.heroInk2} />
            <T size={14} color={c.heroInk} style={{ flex: 1 }}>{p.text}</T>
          </Row>
        ))}
      </Card>
      <Button title="المتابعة بحساب Google" icon="user" variant="secondary" loading={busy === 'google'} onPress={() => run('google', async () => { await signInWithGoogle(); })} />
      <Row gap={10} style={{ alignItems: 'center' }}>
        <View style={{ flex: 1 }}><Divider /></View>
        <T dim size={12}>أو بالبريد</T>
        <View style={{ flex: 1 }}><Divider /></View>
      </Row>
      <Segmented options={[{ key: 'up', label: 'حساب جديد' }, { key: 'in', label: 'تسجيل الدخول' }]} value={mode} onChange={setMode} />
      <Field label="البريد الإلكتروني" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" style={{ textAlign: 'left', writingDirection: 'ltr' }} />
      <Field label="كلمة السر" value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode === 'up' ? 'new-password' : 'current-password'} hint={mode === 'up' ? '٦ أحرف على الأقل' : undefined} style={{ textAlign: 'left', writingDirection: 'ltr' }} />
      <Button title={mode === 'in' ? 'دخول' : 'إنشاء الحساب'} icon="check" loading={busy === 'email'} disabled={!/.+@.+\..+/.test(email) || password.length < 6} onPress={submit} />
      {mode === 'in' ? (
        <Button title="نسيت كلمة السر" variant="ghost" small onPress={() => {
          if (!/.+@.+\..+/.test(email)) { toast('اكتب بريدك أولاً', { icon: 'info' }); return; }
          run('reset', async () => { await resetPassword(email); Alert.alert('أُرسل الرابط', 'افتح بريدك واتبع الرابط لتعيين كلمة سر جديدة.'); });
        }} />
      ) : null}
      <T dim size={12} center>البيانات التي أدخلتها على هذا الهاتف تُرفع إلى حسابك تلقائياً.</T>
    </Screen>
  );
}
