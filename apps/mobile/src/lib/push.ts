/**
 * الإشعارات البعيدة (Firebase Cloud Messaging):
 * بعد تسجيل الدخول يُحفظ رمز الجهاز في جدول devices حتى تصل إعلانات التطبيق والتحديثات.
 * يعمل فقط في نسخة APK المبنية مع google-services.json.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { APP_VERSION } from './config';
import { ensurePermission } from './notify';
import { isConfigured, supabase } from './supabase';

export async function registerDevice(uid: string) {
  if (Platform.OS !== 'android' || !isConfigured) return;
  try {
    const ok = await ensurePermission(false);
    if (!ok) return;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('news', { name: 'أخبار مِداد', importance: Notifications.AndroidImportance.DEFAULT }).catch(() => {});
    }
    const t = await Notifications.getDevicePushTokenAsync();
    if (!t?.data || typeof t.data !== 'string') return;
    await supabase.from('devices').upsert({ token: t.data, owner_id: uid, platform: Platform.OS, app_version: APP_VERSION, updated_at: new Date().toISOString() });
  } catch {
    // بلا Firebase في هذه النسخة: نتجاهل
  }
}

export async function unregisterDevice() {
  if (Platform.OS !== 'android' || !isConfigured) return;
  try {
    const t = await Notifications.getDevicePushTokenAsync();
    if (typeof t?.data === 'string') await supabase.from('devices').delete().eq('token', t.data);
  } catch { /* */ }
}
