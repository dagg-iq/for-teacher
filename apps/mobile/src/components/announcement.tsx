import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { isConfigured, supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { Icon } from './icon';
import { Card, T } from './ui';

const SEEN = 'midad.announce.seen';

/** آخر إعلان من فريق مِداد (جدول announcements) — يختفي بعد إغلاقه */
export function AnnouncementCard() {
  const { c } = useTheme();
  const [a, setA] = useState<{ id: string; title: string; body: string; url: string | null } | null>(null);
  useEffect(() => {
    if (!isConfigured) return;
    (async () => {
      try {
        const { data } = await supabase.from('announcements').select('id,title,body,url').order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (!data) return;
        const seen = await AsyncStorage.getItem(SEEN);
        if (seen !== data.id) setA(data);
      } catch { /* بلا إنترنت */ }
    })();
  }, []);
  if (!a) return null;
  return (
    <Card tone="soft" style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }} onPress={a.url ? () => Linking.openURL(a.url!) : undefined}>
      <Icon name="bell" size={20} color={c.accent} />
      <View style={{ flex: 1 }}>
        <T weight="bold" size={15} color={c.softInk}>{a.title}</T>
        <T size={13} color={c.softInk}>{a.body}</T>
      </View>
      <Pressable hitSlop={10} accessibilityLabel="إغلاق" onPress={() => { AsyncStorage.setItem(SEEN, a.id).catch(() => {}); setA(null); }}>
        <Icon name="close" size={16} color={c.softInk} />
      </Pressable>
    </Card>
  );
}
