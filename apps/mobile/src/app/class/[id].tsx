import { arDigits, STAGE_LABEL } from '@nahj/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Icon } from '@/components/icon';
import { SectionMark } from '@/components/kit';
import { PressScale } from '@/components/motion';
import { Sheet, SheetItem } from '@/components/sheet';
import { Button, Card, Empty, Header, IconButton, Row, Screen, T } from '@/components/ui';
import { count, get, remove, useQuery } from '@/data/db';
import { sectionsOf } from '@/data/queries';
import { Alert } from '@/lib/dialog';
import { useTheme } from '@/lib/theme';
import { toast } from '@/lib/toast';

export default function ClassDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c, hue } = useTheme();
  const [menu, setMenu] = useState(false);
  const k = useQuery(() => get('classes', id), [id]);
  const sections = useQuery(() => sectionsOf(id).map((s) => ({
    s,
    students: count('students', (x) => x.section_id === s.id),
    books: count('gradebooks', (b) => b.section_id === s.id),
  })), [id]);
  if (!k) return <Screen><Header /><Empty title="الصف غير موجود" /></Screen>;

  const del = () => Alert.alert('حذف الصف؟', `سيُحذف «${k.name}» وكل شعبه وطلابه ودرجاتهم. لا يمكن التراجع.`, [
    { text: 'إلغاء', style: 'cancel' },
    { text: 'حذف', style: 'destructive', onPress: () => { remove('classes', k.id); toast('حُذف الصف', { icon: 'trash' }); router.back(); } },
  ]);

  return (
    <Screen>
      <Header title={k.name} subtitle={[k.subject, STAGE_LABEL[k.stage]].filter(Boolean).join(' · ')}
        right={<IconButton name="more" label="خيارات" onPress={() => setMenu(true)} />} />
      {sections.length === 0 ? (
        <Card><Empty icon="grid" title="لا شعب" body="أضف شعبة لهذا الصف." action="إضافة شعبة" onAction={() => router.push(`/class/new?id=${k.id}`)} /></Card>
      ) : sections.map(({ s, students, books }) => (
        <Card key={s.id} onPress={() => router.push(`/section/${s.id}`)}>
          <Row>
            <SectionMark letter={s.name} hue={hue(k.hue)} />
            <View style={{ flex: 1 }}>
              <T weight="bold" size={17}>شعبة {s.name}</T>
              <T dim size={13}>{arDigits(students)} طالب · {arDigits(books)} سجل{s.room ? ` · ${arDigits(s.room)}` : ''}</T>
            </View>
            <Icon name="forward" size={18} color={c.ink3} />
          </Row>
        </Card>
      ))}
      <Button title="إضافة شعبة" icon="plus" variant="secondary" onPress={() => router.push(`/class/new?id=${k.id}`)} />
      <Sheet visible={menu} onClose={() => setMenu(false)}>
        <SheetItem icon="edit" label="تعديل الصف" onPress={() => { setMenu(false); router.push(`/class/new?id=${k.id}`); }} />
        <SheetItem icon="trash" label="حذف الصف" danger onPress={() => { setMenu(false); del(); }} />
      </Sheet>
    </Screen>
  );
}
