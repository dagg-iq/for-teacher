import { formatDayDate, isoDay, parseIsoDay } from '@nahj/shared';
import { router } from 'expo-router';
import { View } from 'react-native';
import { Icon } from '@/components/icon';
import { Pill } from '@/components/kit';
import { Card, Empty, Fab, Header, Row, Screen, SectionTitle, T } from '@/components/ui';
import { all, get, useQuery } from '@/data/db';
import { sectionLabel } from '@/data/queries';
import { useTheme } from '@/lib/theme';

/** دفتر التحضير اليومي */
export default function Plans() {
  const { c } = useTheme();
  const plans = useQuery(() => all('lesson_plans').sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)));
  const today = isoDay();
  const upcoming = plans.filter((p) => p.date >= today).reverse();
  const past = plans.filter((p) => p.date < today);
  const item = (p: (typeof plans)[number]) => (
    <Card key={p.id} onPress={() => router.push(`/plans/edit?id=${p.id}`)} style={{ gap: 6 }}>
      <Row>
        <View style={{ flex: 1 }}>
          <T weight="bold" size={16}>{p.title}</T>
          <T dim size={13}>{formatDayDate(parseIsoDay(p.date))}{p.class_id ? ` · ${get('classes', p.class_id)?.name ?? ''}` : ''}</T>
        </View>
        {p.done ? <Pill small label="نُفّذ" tone="good" /> : p.date === today ? <Pill small label="اليوم" tone="info" /> : null}
        <Icon name="forward" size={18} color={c.ink3} />
      </Row>
      {p.section_ids?.length ? <T dim size={12}>{p.section_ids.map((s) => sectionLabel(s, true)).filter(Boolean).join('، ')}</T> : null}
    </Card>
  );
  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <Header title="التحضير اليومي" subtitle="الأهداف، الوسائل، الطريقة، الخطوات، التقويم والواجب" />
        {plans.length === 0 ? (
          <Card><Empty icon="clipboard" title="دفتر التحضير فارغ" body="حضّر درسك من هاتفك واطبعه أو شاركه عند الحاجة." action="تحضير جديد" onAction={() => router.push('/plans/edit')} /></Card>
        ) : (
          <>
            {upcoming.length ? <><SectionTitle title="القادم" />{upcoming.map(item)}</> : null}
            {past.length ? <><SectionTitle title="السابق" />{past.map(item)}</> : null}
          </>
        )}
        <View style={{ height: 70 }} />
      </Screen>
      <Fab title="تحضير جديد" onPress={() => router.push('/plans/edit')} />
    </View>
  );
}
