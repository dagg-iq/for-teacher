import { arDigits, formatScore , formatPercent } from '@nahj/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Icon } from '@/components/icon';
import { Pill } from '@/components/kit';
import { PressScale } from '@/components/motion';
import { Card, Chip, Empty, Fab, Header, IconButton, Row, Screen, T } from '@/components/ui';
import { useQuery } from '@/data/db';
import { bookProgress, bookStats, classesSorted, gradebooksOf, sectionClass, sectionLabel } from '@/data/queries';
import { useTheme } from '@/lib/theme';

export default function Grades() {
  const { c, hue } = useTheme();
  const [filter, setFilter] = useState<string>('all');
  const [archived, setArchived] = useState(false);
  const classes = useQuery(() => classesSorted());
  const books = useQuery(() => gradebooksOf()
    .filter((b) => !!b.archived === archived)
    .filter((b) => filter === 'all' || sectionClass(b.section_id)?.id === filter)
    .map((b) => {
      const st = bookStats(b);
      return { b, p: bookProgress(b), rate: st?.stats.passRate ?? null, k: sectionClass(b.section_id) };
    }), [filter, archived]);

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <Header back={false} title="الدرجات" subtitle="سجلات الدرجات، المعادلات، والإدخال الصوتي"
          right={<IconButton name="formula" label="القوالب والمعادلات" onPress={() => router.push('/book/new')} />} />

        <Card onPress={() => router.push('/voice')} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="mic" size={22} color={c.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <T weight="bold" size={16}>الإدخال الصوتي</T>
            <T dim size={13}>أدخل درجات الشعبة بقول الاسم والدرجة</T>
          </View>
          <Icon name="forward" size={18} color={c.ink3} />
        </Card>

        {classes.length > 1 || archived ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <Chip label="الكل" active={filter === 'all'} onPress={() => setFilter('all')} />
            {classes.map((k) => <Chip key={k.id} label={k.name} active={filter === k.id} onPress={() => setFilter(k.id)} />)}
          </ScrollView>
        ) : null}

        {books.length === 0 ? (
          <Card>
            {archived ? <Empty icon="table" title="لا سجلات مؤرشفة" /> : classes.length === 0 ? (
              <Empty icon="school" title="أضف صفوفك أولاً" body="سجل الدرجات يُنشأ لشعبة فيها طلاب." action="إضافة صف" onAction={() => router.push('/class/new')} />
            ) : (
              <Empty icon="table" title="لا سجلات درجات" body="ابدأ من قالب «السعي السنوي» أو «امتحان شهري» أو صمّم سجلك بمعادلاتك." action="سجل جديد" onAction={() => router.push('/book/new')} />
            )}
          </Card>
        ) : books.map(({ b, p, rate, k }) => (
          <Card key={b.id} onPress={() => router.push(`/book/${b.id}`)} style={{ gap: 10 }}>
            <Row>
              <View style={{ width: 6, alignSelf: 'stretch', borderRadius: 3, backgroundColor: hue(k?.hue) }} />
              <View style={{ flex: 1 }}>
                <Row gap={6}>
                  {b.pinned ? <Icon name="pin" size={14} color={c.accent} /> : null}
                  <T weight="bold" size={16} lines={1} style={{ flexShrink: 1 }}>{b.title}</T>
                </Row>
                <T dim size={13}>{sectionLabel(b.section_id)}</T>
              </View>
              {rate != null ? <Pill label={`نجاح ${formatPercent(rate)}`} tone={rate >= 50 ? 'good' : 'bad'} small /> : null}
            </Row>
            <View style={{ gap: 4 }}>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: c.line, overflow: 'hidden' }}>
                <View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: `${p.total ? (p.filled / p.total) * 100 : 0}%`, backgroundColor: hue(k?.hue) }} />
              </View>
              <T dim size={12}>{p.total ? `أُدخلت ${arDigits(p.filled)} درجة من ${arDigits(p.total)}` : 'لا طلاب في الشعبة بعد'}</T>
            </View>
          </Card>
        ))}
        <Row style={{ justifyContent: 'center' }}>
          <Chip label={archived ? 'السجلات الحالية' : 'السجلات المؤرشفة'} small onPress={() => setArchived(!archived)} />
        </Row>
        <View style={{ height: 70 }} />
      </Screen>
      <Fab tabs title="سجل جديد" onPress={() => router.push('/book/new')} />
    </View>
  );
}
