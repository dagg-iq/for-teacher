/**
 * طلب تفعيل الإشعارات عند الدخول للتطبيق (الهاتف): تذكير الحصص، إعلانات نَهج، والتحديثات.
 * يظهر إن لم تكن مفعّلة؛ «لاحقاً» يؤجله ٣ أيام. إن رفضها المدرس سابقاً نفتح إعدادات الهاتف.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import { ensurePermission, rescheduleAll } from '@/lib/notify';
import { registerDevice } from '@/lib/push';
import { useTheme } from '@/lib/theme';
import { toast } from '@/lib/toast';
import { Icon } from './icon';
import { Sheet } from './sheet';
import { Button, Row, T } from './ui';

const KEY = 'nahj.notifyAsk';
const LATER = 3 * 24 * 60 * 60 * 1000;

const POINTS = [
  { icon: 'bell' as const, text: 'تذكير قبل كل حصة من جدولك' },
  { icon: 'flag' as const, text: 'مواعيد المهام والامتحانات' },
  { icon: 'info' as const, text: 'إعلانات نَهج والتحديثات الجديدة' },
];

export function NotifyPrompt({ uid }: { uid: string | null }) {
  const { c } = useTheme();
  const [show, setShow] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let alive = true;
    (async () => {
      const cur = await Notifications.getPermissionsAsync().catch(() => null);
      if (!cur || cur.granted) return;
      const later = Number(await AsyncStorage.getItem(KEY).catch(() => null)) || 0;
      if (Date.now() - later < LATER) return;
      // بعد ظهور التطبيق بلحظة (لا فوق شاشة البداية)
      setTimeout(() => { if (alive) { setBlocked(!cur.canAskAgain); setShow(true); } }, 1200);
    })();
    return () => { alive = false; };
  }, []);

  const enable = async () => {
    if (blocked) { setShow(false); Linking.openSettings().catch(() => {}); return; }
    const ok = await ensurePermission(true);
    setShow(false);
    if (ok) {
      toast('فُعّلت الإشعارات', { icon: 'check' });
      rescheduleAll(true).catch(() => {});
      if (uid) registerDevice(uid);
    } else {
      await AsyncStorage.setItem(KEY, String(Date.now())).catch(() => {});
    }
  };
  const later = async () => {
    setShow(false);
    await AsyncStorage.setItem(KEY, String(Date.now())).catch(() => {});
  };

  return (
    <Sheet visible={show} onClose={later}>
      <View style={{ alignItems: 'center', gap: 10, paddingTop: 4 }}>
        <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="bell" size={30} color={c.accent} accent={c.gold} />
        </View>
        <T display size={22} center>فعّل الإشعارات</T>
        <T dim size={14} center>حتى لا تفوتك حصة ولا موعد.</T>
      </View>
      <View style={{ gap: 10, marginTop: 14 }}>
        {POINTS.map((p) => (
          <Row key={p.text} gap={10}>
            <Icon name={p.icon} size={18} color={c.accent} />
            <T size={15} style={{ flex: 1 }}>{p.text}</T>
          </Row>
        ))}
      </View>
      {blocked ? <T dim size={12} style={{ marginTop: 10 }}>الإشعارات مرفوضة سابقاً: سنفتح إعدادات الهاتف ← الإشعارات ← فعّلها لنَهج.</T> : null}
      <View style={{ gap: 8, marginTop: 16 }}>
        <Button title={blocked ? 'فتح الإعدادات' : 'تفعيل الإشعارات'} icon="bell" onPress={enable} />
        <Button title="لاحقاً" variant="ghost" onPress={later} />
      </View>
    </Sheet>
  );
}
