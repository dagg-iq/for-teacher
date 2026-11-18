import Constants from 'expo-constants';

/** رابط الموقع التعريفي (للتنزيل والتحقق من التحديثات) */
export const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL || 'https://midad-iq.web.app').replace(/\/$/, '');

/** رقم النسخة (رقم بناء GitHub) */
export const BUILD_NUMBER = Number((Constants.expoConfig?.extra as { buildNumber?: number } | undefined)?.buildNumber ?? 0);
export const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';
