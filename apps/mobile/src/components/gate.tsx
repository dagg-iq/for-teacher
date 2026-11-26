/**
 * بوابة التطبيق: لا يُفتح إلا بحساب Google، ولا يُستعمل إلا بعد موافقة الإدارة.
 *  - SignInGate: شاشة الدخول (Google فقط).
 *  - WaitingGate: بانتظار الموافقة / موقوف / تعذّر التحقق — مع تحقق تلقائي كل نصف دقيقة.
 */
import { useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { FEATURES } from '@/app/welcome';
import { useAuth } from '@/lib/auth';
import { Alert } from '@/lib/dialog';
import { arabicError } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { Icon, LogoMark, Wordmark } from './icon';
import { enter, PressScale } from './motion';
import { T } from './ui';

const BG = '#0E3B33';
const INK2 = '#AFC8C1';

function GoogleG({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.8z" />
      <Path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" />
      <Path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1z" />
      <Path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
    </Svg>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: BG }} contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: insets.top + 36, paddingBottom: insets.bottom + 24, gap: 24, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
      {children}
    </ScrollView>
  );
}

function Brand({ sub }: { sub: string }) {
  const { c } = useTheme();
  return (
    <Animated.View entering={enter(0)} style={{ gap: 10 }}>
      <LogoMark size={64} ink="#F7F5F0" dot={c.gold} />
      <Wordmark height={56} color="#FFFFFF" />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: -6 }}>
        <View style={{ width: 8, height: 8, backgroundColor: c.gold }} />
        <T size={17} color={INK2}>{sub}</T>
      </View>
    </Animated.View>
  );
}

const pill = { height: 56, borderRadius: 28, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 10 };

export function SignInGate() {
  const { c } = useTheme();
  const { signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try { await signInWithGoogle(); } catch (e) { Alert.alert('تعذّر الدخول', arabicError(e)); } finally { setBusy(false); }
  };
  return (
    <Shell>
      <Brand sub="التدريس بنهجٍ أذكى." />
      <View style={{ flex: 1 }}>
        {FEATURES.map((f, i) => (
          <Animated.View key={f.title} entering={enter(i + 1)} style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start', paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: 'rgba(255,255,255,0.10)' }}>
            <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={f.icon} size={21} color="#FFFFFF" accent={c.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <T weight="bold" size={16} color="#FFFFFF">{f.title}</T>
              <T size={14} color={INK2}>{f.body}</T>
            </View>
          </Animated.View>
        ))}
      </View>
      <View style={{ gap: 12 }}>
        <PressScale onPress={busy ? undefined : go} haptic scaleTo={0.97} accessibilityRole="button" accessibilityLabel="الدخول بحساب Google"
          style={{ ...pill, backgroundColor: '#FFFFFF', opacity: busy ? 0.7 : 1 }}>
          {busy ? <ActivityIndicator color={BG} /> : <GoogleG />}
          <T weight="bold" size={17} color="#1F1F1F">الدخول بحساب Google</T>
        </PressScale>
        <T size={13} color={INK2} center>الحساب الجديد يحتاج موافقة إدارة نَهج قبل أول استعمال. بياناتك محفوظة في حسابك ولا يراها غيرك.</T>
      </View>
    </Shell>
  );
}

export function WaitingGate() {
  const { c } = useTheme();
  const { status, email, checkStatus, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const blocked = status === 'suspended' || status === 'rejected';
  const title = status === 'unknown' ? 'تعذّر التحقق من حسابك' : status === 'rejected' ? 'لم تتم الموافقة على حسابك' : status === 'suspended' ? 'حسابك موقوف' : 'طلبك بانتظار الموافقة';
  const body = status === 'unknown'
    ? 'نحتاج الإنترنت مرة واحدة للتحقق من حسابك. تأكد من الاتصال ثم اضغط «تحقّق الآن».'
    : blocked
      ? 'لا يمكن استعمال التطبيق بهذا الحساب حالياً. تواصل مع إدارة نَهج، أو ادخل بحساب آخر.'
      : 'وصل طلبك إلى إدارة نَهج. سيُفتح التطبيق تلقائياً فور الموافقة — يمكنك ترك هذه الشاشة مفتوحة.';
  const check = async () => { setBusy(true); try { await checkStatus(); } finally { setBusy(false); } };
  return (
    <Shell>
      <Brand sub="التدريس بنهجٍ أذكى." />
      <Animated.View entering={enter(1)} style={{ flex: 1, justifyContent: 'center', gap: 16 }}>
        <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={blocked ? 'lock' : status === 'unknown' ? 'cloud-off' : 'clock'} size={30} color={blocked ? '#FF8A80' : c.gold} />
        </View>
        <T display size={28} color="#FFFFFF">{title}</T>
        <T size={16} color={INK2}>{body}</T>
        {email ? <T size={14} color={INK2} style={{ writingDirection: 'ltr', textAlign: 'right' }}>{email}</T> : null}
      </Animated.View>
      <View style={{ gap: 10 }}>
        {!blocked ? (
          <PressScale onPress={busy ? undefined : check} haptic scaleTo={0.97} accessibilityRole="button" accessibilityLabel="تحقّق الآن" style={{ ...pill, backgroundColor: '#F7F5F0' }}>
            {busy ? <ActivityIndicator color={BG} /> : <Icon name="refresh" size={20} color={BG} />}
            <T weight="bold" size={17} color={BG}>تحقّق الآن</T>
          </PressScale>
        ) : null}
        <PressScale onPress={() => signOut(false)} scaleTo={0.97} accessibilityRole="button" accessibilityLabel="الدخول بحساب آخر"
          style={{ ...pill, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' }}>
          <Icon name="logout" size={19} color="#FFFFFF" />
          <T weight="bold" size={16} color="#FFFFFF">الدخول بحساب آخر</T>
        </PressScale>
      </View>
    </Shell>
  );
}
