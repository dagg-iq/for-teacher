import { DarkTheme, DefaultTheme, Stack, ThemeProvider, router, useSegments } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { setDateStyle, setDigitStyle, teacherTitle } from '@nahj/shared';
import { ActivityIndicator, I18nManager, LogBox, Platform, ScrollView, Text, View } from 'react-native';
import type { ErrorBoundaryProps } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PortalProvider } from '@/components/portal';
import { Intro } from '@/components/intro';
import { UpdateSheet } from '@/components/update-sheet';
import { cleanOldApks } from '@/lib/updater';
import { IS_DESKTOP } from '@/lib/config';
import { useWide } from '@/lib/hooks';
import { Sidebar } from '@/components/sidebar';
import { getSettings, loadDB, useSettings } from '@/data/db';
import { startSync, syncNow } from '@/data/sync';
import { AuthProvider, consumeSignIn, useAuth } from '@/lib/auth';
import { SignInGate, WaitingGate } from '@/components/gate';
import { AppLock } from '@/lib/applock';
import { NotifyPrompt } from '@/components/notify-prompt';
import { isConfigured } from '@/lib/supabase';
import { DialogHost } from '@/lib/dialog';
import { useClassReminders } from '@/lib/notify';
import { registerDevice } from '@/lib/push';
import { AppThemeProvider, fontAssets, loadThemeMode, useTheme } from '@/lib/theme';
import { toast, ToastHost } from '@/lib/toast';
import { T } from '@/components/ui';
import { useWidgetSync } from '@/widgets/sync';

// التطبيق عربي بالكامل: من اليمين لليسار
if (Platform.OS !== 'web') {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
  I18nManager.swapLeftAndRightInRTL(true);
} else if (typeof document !== 'undefined') {
  document.documentElement.dir = 'rtl';
  document.documentElement.lang = 'ar';
}

LogBox.ignoreLogs(['WebCrypto API is not supported']);

SplashScreen.preventAutoHideAsync().catch(() => {});
setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 8000);

/** بدل التجمد: نعرض الخطأ بوضوح مع زر إعادة المحاولة */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => { SplashScreen.hideAsync().catch(() => {}); }, []);
  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 28, gap: 14, backgroundColor: '#F5F2EA' }}>
      <Text style={{ fontSize: 24, fontWeight: '700', color: '#111111', textAlign: 'center' }}>حدث خطأ غير متوقع</Text>
      <Text style={{ fontSize: 14, color: '#5C5C5C', textAlign: 'center' }}>بياناتك محفوظة على الهاتف ولن تضيع.</Text>
      <Text selectable style={{ fontSize: 12, color: '#8A8A85', textAlign: 'left', writingDirection: 'ltr' }}>{error.message}</Text>
      <Text onPress={retry} style={{ fontSize: 17, fontWeight: '700', color: '#0F6E66', textAlign: 'center', padding: 12 }}>إعادة المحاولة</Text>
    </ScrollView>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const [dbReady, setDbReady] = useState(false);
  useEffect(() => { Promise.all([loadDB(), loadThemeMode()]).finally(() => setDbReady(true)); }, []);
  if ((!fontsLoaded && !fontError) || !dbReady) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppThemeProvider>
          <AuthProvider>
            <Navigator />
          </AuthProvider>
        </AppThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Navigator() {
  const { c, dark } = useTheme();
  const { ready, session, status } = useAuth();
  const settings = useSettings();
  const segments = useSegments();
  // شكل الأرقام يُضبط قبل رسم أي شاشة؛ تغييره يعيد بناء الشاشات (key) لتظهر الأرقام الجديدة في كل مكان
  const digits = settings.prefs.digits ?? 'latn';
  setDigitStyle(digits);
  const dateStyle = settings.prefs.dateStyle ?? 'numeric';
  setDateStyle(dateStyle);
  const hasProfile = !!settings.profile?.name;
  const wide = useWide();
  const first = (segments as string[])[0];
  // البوابة: بلا حساب ← الدخول بـ Google؛ حساب غير مفعّل ← الانتظار. (رابط العودة من Google يمر دائماً)
  const gate: 'signin' | 'wait' | 'loading' | null = !isConfigured || first === 'auth-callback' ? null
    : !session ? 'signin' : status === 'loading' ? 'loading' : status !== 'approved' ? 'wait' : null;
  const side = !gate && wide && hasProfile && first !== 'welcome' && first !== 'auth-callback';
  // حركة الشعار عند الفتح (الهاتف وتطبيق الحاسوب). على الويب نخفي شاشة البداية مباشرة
  const [introDone, setIntroDone] = useState(Platform.OS === 'web' && !IS_DESKTOP);

  // حساب سابق على جهاز جديد: نستعيد ملفه وبياناته من السحابة أولاً بدل شاشة إنشاء الملف، ثم «أهلاً بعودتك»
  const sessionUid = session?.user.id ?? null;
  const [restored, setRestored] = useState<string | null>(null);
  const needRestore = !gate && isConfigured && !!sessionUid && !hasProfile && restored !== sessionUid;
  useEffect(() => {
    if (!needRestore || !sessionUid) return;
    let alive = true;
    Promise.race([syncNow(), new Promise((r) => setTimeout(r, 20000))]).catch(() => {}).finally(() => {
      if (!alive) return;
      const p = getSettings().profile;
      consumeSignIn();
      if (p?.name) toast(`أهلاً بعودتك، ${teacherTitle(p.name, p.gender)}`, { icon: 'check' });
      setRestored(sessionUid);
    });
    return () => { alive = false; };
  }, [needRestore, sessionUid]);
  // دخول بحساب له ملف محفوظ على هذا الجهاز: ترحيب قصير
  const greeted = useRef<string | null>(null);
  useEffect(() => {
    if (gate || !sessionUid || !hasProfile || greeted.current === sessionUid) return;
    const first = greeted.current === null;
    greeted.current = sessionUid;
    if (!first) return;
    const p = getSettings().profile;
    if (p?.name && consumeSignIn()) toast(`أهلاً بعودتك، ${teacherTitle(p.name, p.gender)}`, { icon: 'check' });
  }, [gate, sessionUid, hasProfile]);

  // أول فتح: شاشة الترحيب وإعداد الملف (بعد محاولة الاستعادة من السحابة)
  useEffect(() => {
    if (!ready) return;
    const hide = introDone ? setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 120) : undefined;
    if (!gate && !needRestore && !hasProfile && first !== 'welcome' && first !== 'account' && first !== 'auth-callback') router.replace('/welcome');
    return () => { if (hide) clearTimeout(hide); };
  }, [ready, hasProfile, first, introDone, gate, needRestore]);

  // المزامنة عند وجود حساب
  const uid = session?.user.id ?? null;
  useEffect(() => startSync(uid), [uid]);
  useEffect(() => { if (uid && status === 'approved') syncNow(); }, [uid, status]);
  useEffect(() => { if (uid) registerDevice(uid); }, [uid]);

  // تذكير الحصص (إشعارات محلية)
  useClassReminders();

  // ويدجت «حصص اليوم» (أندرويد)
  useWidgetSync();

  const navTheme = {
    ...(dark ? DarkTheme : DefaultTheme),
    colors: { ...(dark ? DarkTheme : DefaultTheme).colors, background: c.bg, card: c.card, text: c.ink, border: c.line, primary: c.accent },
  };

  return (
    <ThemeProvider value={navTheme}>
      <PortalProvider>
        <StatusBar style={dark ? 'light' : 'dark'} />
        {!ready || gate === 'loading' ? <View style={{ flex: 1, backgroundColor: c.bg }} /> : needRestore ? <Restoring /> : gate === 'signin' ? <SignInGate /> : gate === 'wait' ? <WaitingGate /> : (
          <View style={{ flex: 1, flexDirection: 'row', backgroundColor: c.bg }}>
            {/* الحاسوب: الشريط الجانبي في كل الشاشات */}
            {side ? <Sidebar /> : null}
            <View style={{ flex: 1 }}>
              <Stack key={`${digits}-${dateStyle}`} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg }, animation: side ? 'fade' : 'ios_from_left' }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
                <Stack.Screen name="voice" options={{ animation: 'fade_from_bottom' }} />
                <Stack.Screen name="book/new" options={{ animation: 'fade_from_bottom' }} />
              </Stack>
            </View>
          </View>
        )}
        {ready && introDone ? <UpdateSheet /> : null}
        {ready && introDone && !gate && !needRestore && hasProfile ? <NotifyPrompt uid={sessionUid} /> : null}
        {!introDone ? <Intro ready={ready} onDone={() => { setIntroDone(true); cleanOldApks(); }} /> : null}
        <ToastHost />
        <DialogHost />
        <AppLock />
      </PortalProvider>
    </ThemeProvider>
  );
}

/** استعادة بيانات حساب سابق (جهاز جديد أو إعادة تثبيت) */
function Restoring() {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 }}>
      <ActivityIndicator color={c.accent} size="large" />
      <T weight="bold" size={17}>جارٍ استعادة بياناتك…</T>
      <T dim size={14} center>صفوفك وطلابك ودرجاتك تعود من حسابك.</T>
    </View>
  );
}
