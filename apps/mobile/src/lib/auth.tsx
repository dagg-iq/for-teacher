import type { Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { syncState, wipeLocal } from '@/data/db';
import { unregisterDevice } from './push';
import { isConfigured, supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

interface AuthValue {
  ready: boolean;
  session: Session | null;
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
const OWNER = 'rasd.owner';

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
 *  - دخول بحساب مختلف عن صاحب البيانات: تُمسح بيانات الحساب السابق (مرفوعة أصلاً) ثم تُسحب بيانات الحساب الجديد.
 */
async function claimLocalData(userId: string) {
  const owner = await AsyncStorage.getItem(OWNER).catch(() => null);
  if (owner === userId) return;
  if (owner && owner !== userId) await wipeLocal();
  else syncState.markAllDirty();
  await AsyncStorage.setItem(OWNER, userId).catch(() => {});
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!isConfigured);
  const [session, setSession] = useState<Session | null>(null);

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
      await unregisterDevice();
      await supabase.auth.signOut().catch(() => {});
      if (wipe) {
        await wipeLocal();
        await AsyncStorage.removeItem(OWNER).catch(() => {});
      }
    },
    deleteAccount: async () => {
      const { error } = await supabase.functions.invoke('delete-account', { body: {} });
      if (error) throw new Error('تعذّر حذف الحساب. تأكد من الإنترنت وحاول مرة أخرى.');
      await supabase.auth.signOut().catch(() => {});
      await wipeLocal();
      await AsyncStorage.removeItem(OWNER).catch(() => {});
    },
  }), [ready, session]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside provider');
  return v;
}
