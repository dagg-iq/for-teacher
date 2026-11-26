import Constants from 'expo-constants';

/** رابط الموقع التعريفي (للتنزيل والتحقق من التحديثات) */
export const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL || 'https://nahj-iq.web.app').replace(/\/$/, '');

/** رقم النسخة (رقم بناء GitHub) */
export const BUILD_NUMBER = Number((Constants.expoConfig?.extra as { buildNumber?: number } | undefined)?.buildNumber ?? 0);
export const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

/** يعمل داخل تطبيق الحاسوب (Electron، apps/desktop) */
export const IS_DESKTOP = typeof window !== 'undefined' && !!(window as unknown as { nahjDesktop?: unknown }).nahjDesktop;

/**
 * أين تُحفظ البيانات في السحابة:
 *  - «supabase» (الافتراضي): مباشرة إلى Supabase.
 *  - «rest»: إلى خادم المزامنة (server/) المتصل بقاعدة Oracle، على العنوان EXPO_PUBLIC_API_URL.
 * الدخول نفسه (الحساب) يبقى من Supabase Auth في الحالتين، والخادم يتحقق من رمزه.
 */
export const SYNC_BACKEND: 'supabase' | 'rest' = process.env.EXPO_PUBLIC_SYNC_BACKEND === 'rest' ? 'rest' : 'supabase';
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/$/, '');

/** زر «المتابعة بحساب Google» — يظهر فقط إن فُعّل مزوّد Google في Supabase (أسرار GOOGLE_CLIENT_ID/SECRET) */
export const GOOGLE_AUTH = process.env.EXPO_PUBLIC_GOOGLE_AUTH === 'true';
/** «نسيت كلمة السر» — يحتاج خادم بريد (أسرار SMTP_*)؛ بريد Supabase المجاني لا يصل إلا لأعضاء فريق المشروع */
export const PASSWORD_RESET = process.env.EXPO_PUBLIC_PASSWORD_RESET === 'true';
