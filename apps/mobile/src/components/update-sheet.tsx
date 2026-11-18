import { arDigits } from '@rasd/shared';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { BUILD_NUMBER, SITE_URL } from '@/lib/config';
import { Icon } from './icon';
import { Sheet } from './sheet';
import { Button, T } from './ui';
import { useTheme } from '@/lib/theme';

/** يفحص الموقع عن نسخة أحدث (download.json) ويعرض «تحديث جديد متاح» */
export function UpdateSheet() {
  const { c } = useTheme();
  const [info, setInfo] = useState<{ url: string; version: string; size_mb?: string } | null>(null);
  useEffect(() => {
    if (Platform.OS !== 'android' || !BUILD_NUMBER) return;
    const t = setTimeout(() => {
      fetch(`${SITE_URL}/download.json`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d?.url && Number(d.version) > BUILD_NUMBER) setInfo(d); })
        .catch(() => {});
    }, 4000);
    return () => clearTimeout(t);
  }, []);
  return (
    <Sheet visible={!!info} onClose={() => setInfo(null)}>
      <View style={{ alignItems: 'center', gap: 10, paddingVertical: 8 }}>
        <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="download" size={26} color={c.accent} />
        </View>
        <T display size={24}>تحديث جديد متاح</T>
        <T dim center size={14}>النسخة {arDigits(info?.version ?? '')}{info?.size_mb ? ` · ${arDigits(info.size_mb)} ميغابايت` : ''}. يُثبَّت فوق الحالية ولا تضيع بياناتك.</T>
        <Button title="تنزيل التحديث" icon="download" style={{ alignSelf: 'stretch', marginTop: 6 }} onPress={() => { if (info) Linking.openURL(info.url); setInfo(null); }} />
        <Button title="لاحقاً" variant="ghost" small onPress={() => setInfo(null)} />
      </View>
    </Sheet>
  );
}
