import * as Linking from 'expo-linking';
import { useState } from 'react';
import { View } from 'react-native';
import { Group, SearchBar } from '@/components/kit';
import { Divider, Header, ListItem, Screen, T } from '@/components/ui';
import LIBS from '@/data/licenses.json';
import { arDigits } from '@nahj/shared';

/** تراخيص المكتبات مفتوحة المصدر والخطوط المستعملة في التطبيق (تُولَّد بـ scripts/gen-licenses.cjs) */
export default function Licenses() {
  const [q, setQ] = useState('');
  const list = (LIBS as { name: string; version: string; license: string; url: string }[]).filter((l) => !q || l.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <Screen>
      <Header title="التراخيص" subtitle="مكتبات مفتوحة المصدر بُني بها نَهج" />
      <Group title="الخطوط والهوية">
        <ListItem icon="note" title="خطوط ثمانية" subtitle="Thmanyah Sans و Serif — من ثمانية" onPress={() => Linking.openURL('https://thmanyah.com').catch(() => {})} />
        <Divider />
        <ListItem icon="sparkle" title="شعار نَهج والأيقونات" subtitle="رُسمت خصيصاً لنَهج — كل الحقوق محفوظة" />
      </Group>
      <SearchBar value={q} onChange={setQ} placeholder="ابحث عن مكتبة" />
      <Group title={`المكتبات (${arDigits(list.length)})`}>
        {list.map((l, i) => (
          <View key={l.name}>
            {i ? <Divider /> : null}
            <ListItem icon="file" title={`\u2066${l.name}\u2069`} subtitle={`\u2066${l.license} · ${arDigits(l.version)}\u2069`} onPress={l.url ? () => Linking.openURL(l.url).catch(() => {}) : undefined} />
          </View>
        ))}
      </Group>
      <T dim size={12} center style={{ paddingVertical: 8 }}>نشكر كل من بنى هذه المكتبات وشاركها مع العالم.</T>
    </Screen>
  );
}
