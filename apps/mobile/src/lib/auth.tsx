import type { Session } from '@supabase/supabase-js';
import { backend } from '@/data/backends';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { exportBackup, importBackup, syncState, wipeLocal, type Backup } from '@/data/db';
import { syncNow, type AccountStatus } from '@/data/sync';
import { IS_DESKTOP, SYNC_BACKEND } from './config';
import { unregisterDevice } from './push';
import { isConfigured, supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

/** حالة الحساب عند الإدارة؛ unknown = لم نستطع التحقق بعد (بلا إنترنت ولا نسخة محفوظة) */
export type GateStatus = AccountStatus | 'unknown' | 'loading';

interface AuthValue {
  ready: boolean;
  session: Session | null;
  /** حالة الحساب: التطبيق لا يُفتح إلا للحساب المفعّل */
  status: GateStatus;
  /** يعيد التحقق من حالة الحساب الآن */
  checkStatus: () => Promise<void>;
  email: string | null;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<'signed-in' | 'confirm'>;
  signInWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  /** wipe: يمسح بيانات الهاتف أيضاً */
  signOut: (wipe?: boolean) => Promise<void>;
  /** يحذف الحساب وكل بياناته من السحابة نهائياً */
  deleteAccount: () => Promise<void>;
}

const Ctx = createContext<AuthValue | null>(null);
const OWNER = 'nahj.owner';

export const authRedirectUrl = () => Linking.createURL('auth-callback');

const exchanges = new Map<string, Promise<void>>();
export function exchangeCode(code: string): Promise<void> {
  let p = exchanges.get(code);
  if (!p) {
    p = (async () => {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        const { data } = await supabase.auth.getSession();
        if (!data.session) throw new Error(error.message);
      }
    })();
    exchanges.set(code, p);
  }
  return p;
}

/**
 * ربط بيانات الهاتف بالحساب:
 *  - أول دخول على هذا الهاتف: كل ما أُدخل بلا حساب يُرفع إلى الحساب.
 *  - دخول بحساب مختلف عن صاحب البيانات: تُمسح بيانات الحساب السابق من الهاتف، لكن ما لم يُرفع منها بعد
 *    يُحفظ نسخةً جانبية باسم ذلك الحساب، ويُستعاد ويُرفع تلقائياً حين يدخل صاحبه مرة أخرى.
 */
const PARKED = (uid: string) => `nahj.parked.${uid}`;
async function claimLocalData(userId: string) {
  const owner = await AsyncStorage.getItem(OWNER).catch(() => null);
  if (owner === userId) return;
  if (owner && owner !== userId) {
    if (syncState.pendingCount() > 0) {
      await AsyncStorage.setItem(PARKED(owner), JSON.stringify(exportBackup())).catch(() => {});
    }
    await wipeLocal();
  } else {
    syncState.markAllDirty();
  }
  await AsyncStorage.setItem(OWNER, userId).catch(() => {});
  // تغييرات هذا الحساب التي لم تُرفع قبل أن يدخل غيره على الهاتف
  const parked = await AsyncStorage.getItem(PARKED(userId)).catch(() => null);
  if (parked) {
    try { importBackup(JSON.parse(parked) as Backup); } catch { /* نسخة تالفة */ }
    await AsyncStorage.removeItem(PARKED(userId)).catch(() => {});
  }
}

const STATUS = (uid: string) => `nahj.status.${uid}`;

/** حالة الحساب من الخادم (مع نسخة محفوظة للعمل بلا إنترنت بعد أول تفعيل) */
async function fetchStatus(uid: string): Promise<GateStatus> {
  if (SYNC_BACKEND !== 'supabase') return 'approved';
  try {
    const { data, error } = await supabase.from('teacher_accounts').select('status').eq('id', uid).maybeSingle();
    if (error) {
      if (/teacher_accounts|schema cache|does not exist/i.test(error.message)) return 'approved';
      throw error;
    }
    const st = ((data as { status?: AccountStatus } | null)?.status) ?? 'pending';
    await AsyncStorage.setItem(STATUS(uid), st).catch(() => {});
    return st;
  } catch {
    const cached = await AsyncStorage.getItem(STATUS(uid)).catch(() => null);
    return (cached as AccountStatus | null) ?? 'unknown';
  }
}

type DesktopBridge = { openExternal?: (url: string) => Promise<unknown>; onDeepLink?: (cb: (url: string) => void) => () => void };
const desktop = (): DesktopBridge | null => (IS_DESKTOP ? ((window as unknown as { nahjDesktop?: DesktopBridge }).nahjDesktop ?? null) : null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!isConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<GateStatus>('loading');
  const uid = session?.user.id ?? null;

  const checkStatus = useCallback(async () => {
    if (!uid) return;
    setStatus(await fetchStatus(uid));
  }, [uid]);

  // الحالة: النسخة المحفوظة فوراً ثم من الخادم، وعند العودة للتطبيق، وكل نصف دقيقة أثناء الانتظار
  useEffect(() => {
    if (!uid) { setStatus('loading'); return; }
    let alive = true;
    setStatus('loading');
    AsyncStorage.getItem(STATUS(uid)).then((v) => { if (alive && v) setStatus((cur) => (cur === 'loading' ? (v as AccountStatus) : cur)); }).catch(() => {});
    fetchStatus(uid).then((st) => { if (alive) setStatus(st); });
    const sub = AppState.addEventListener('change', (a) => { if (a === 'active') fetchStatus(uid).then((st) => { if (alive) setStatus(st); }); });
    return () => { alive = false; sub.remove(); };
  }, [uid]);
  useEffect(() => {
    if (!uid || status === 'approved' || status === 'loading') return;
    const t = setInterval(() => { fetchStatus(uid).then(setStatus); }, 30000);
    return () => clearInterval(t);
  }, [uid, status]);

  // الحاسوب: رابط العودة من متصفح النظام بعد الدخول بحساب Google
  useEffect(() => {
    const d = desktop();
    if (!d?.onDeepLink) return;
    return d.onDeepLink((url) => {
      const code = /[?&]code=([^&#]+)/.exec(url)?.[1];
      if (code) exchangeCode(decodeURIComponent(code)).catch(() => {});
    });
  }, []);

  useEffect(() => {
    if (!isConfigured) return;
    let alive = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      if (data.session) await claimLocalData(data.session.user.id);
      setSession(data.session);
      setReady(true);
    }).catch(() => setReady(true));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      (async () => {
        if (s) await claimLocalData(s.user.id);
        setSession(s);
      })();
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);

  const value = useMemo<AuthValue>(() => ({
    ready,
    session,
    status,
    checkStatus,
    email: session?.user.email ?? null,
    signInWithEmail: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
    },
    signUpWithEmail: async (email, password) => {
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: authRedirectUrl() } });
      if (error) throw error;
      return data.session ? 'signed-in' : 'confirm';
    },
    signInWithGoogle: async () => {
      // الحاسوب: الدخول في متصفح النظام، والعودة برابط nahj:// يلتقطه التطبيق (انظر onDeepLink أعلاه)
      const d = desktop();
      if (d?.openExternal) {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: 'nahj://auth-callback', skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } },
        });
        if (error || !data.url) throw new Error(error?.message ?? 'تعذّر بدء تسجيل الدخول');
        await d.openExternal(data.url);
        return;
      }
      const redirectTo = authRedirectUrl();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } },
      });
      if (error || !data.url) throw new Error(error?.message ?? 'تعذّر بدء تسجيل الدخول');
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === 'success') {
        const code = Linking.parse(result.url).queryParams?.code;
        if (typeof code === 'string') await exchangeCode(code);
      }
    },
    resetPassword: async (email) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: authRedirectUrl() });
      if (error) throw error;
    },
    signOut: async (wipe) => {
      // محاولة أخيرة لرفع ما لم يُرفع قبل الخروج
      await Promise.race([syncNow(), new Promise((r) => setTimeout(r, 8000))]).catch(() => {});
      await unregisterDevice();
      await supabase.auth.signOut().catch(() => {});
      if (wipe) {
        await wipeLocal();
        await AsyncStorage.removeItem(OWNER).catch(() => {});
      }
    },
    deleteAccount: async () => {
      const error = await backend.deleteAccount().then(() => null, (e: unknown) => e);
      if (error) throw new Error('تعذّر حذف الحساب. تأكد من الإنترنت وحاول مرة أخرى.');
      await supabase.auth.signOut().catch(() => {});
      await wipeLocal();
      await AsyncStorage.removeItem(OWNER).catch(() => {});
    },
  }), [ready, session, status, checkStatus]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside provider');
  return v;
}
