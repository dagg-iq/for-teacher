import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

// القيم العامة (آمنة: المفتاح anon محمي بـ RLS). تُضبط من ملف .env أو أسرار البناء.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

/** السحابة مفعّلة؟ بدونها يعمل التطبيق كاملاً على الهاتف فقط */
export const isConfigured = Boolean(url && anonKey);

export const supabase = createClient(url || 'https://placeholder.supabase.co', anonKey || 'placeholder', {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
    flowType: 'pkce',
  },
});

// تجديد الجلسة فقط والتطبيق ظاهر
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (!isConfigured) return;
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/** رسالة خطأ عربية مفهومة من أخطاء Supabase */
export function arabicError(e: unknown): string {
  const m = (e instanceof Error ? e.message : String(e ?? '')).toLowerCase();
  if (m.includes('invalid login')) return 'البريد أو كلمة السر غير صحيحة.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'هذا البريد مسجّل مسبقاً. سجّل الدخول بدلاً من ذلك.';
  if (m.includes('password') && m.includes('6')) return 'كلمة السر قصيرة: 6 أحرف على الأقل.';
  if (m.includes('email not confirmed')) return 'أكّد بريدك أولاً من الرسالة التي وصلتك.';
  if (m.includes('network') || m.includes('fetch')) return 'تعذّر الاتصال. تأكد من الإنترنت.';
  if (m.includes('rate limit')) return 'محاولات كثيرة. انتظر قليلاً ثم أعد المحاولة.';
  if (m.includes('not authorized') && m.includes('email')) return 'تعذّر إرسال البريد إلى هذا العنوان حالياً.';
  if (m.includes('bucket not found')) return 'التخزين السحابي غير مهيّأ بعد على الخادم.';
  if (m.includes('signups not allowed') || m.includes('signup is disabled')) return 'إنشاء الحسابات متوقف مؤقتاً.';
  if (m.includes('invalid email') || m.includes('unable to validate email')) return 'البريد الإلكتروني غير صحيح.';
  return e instanceof Error ? e.message : 'حدث خطأ غير متوقع';
}
