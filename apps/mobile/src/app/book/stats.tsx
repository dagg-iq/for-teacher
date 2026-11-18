import { arDigits, columnStats, formatScore } from '@midad/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Bars, Pill, Ring, Stat } from '@/components/kit';
import { PressScale } from '@/components/motion';
import { Card, Chip, Empty, Header, Row, Screen, SectionTitle, T } from '@/components/ui';
import { get, useQuery } from '@/data/db';
import { sectionLabel, sheetOf } from '@/data/queries';
import { useTheme } from '@/lib/theme';

export default function Stats() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c, tone } = useTheme();
  const book = useQuery(() => get('gradebooks', id), [id]);
  const rows = useQuery(() => (book ? sheetOf(book) : []), [book]);
  const [colId, setColId] = useState<string | null>(null);
  if (!book) return <Screen><Header /><Empty title="السجل غير موجود" /></Screen>;
  const col = book.columns.find((x) => x.id === (colId ?? book.result.column_id)) ?? book.columns[0];
  const st = columnStats(rows.map((r) => r.values[col.id]), col.max, book.result);
  const ranked = rows.filter((r) => r.values[col.id] != null).sort((a, b) => b.values[col.id]! - a.values[col.id]!);
  const top = ranked.slice(0, 5);
  const bottom = ranked.slice(-5).reverse().filter((r) => !top.includes(r));
  const missing = rows.filter((r) => r.values[col.id] == null && !r.marks[col.id]);

  // مدرج تكراري: عشرة فئات
  const buckets = Array.from({ length: 10 }, (_, i) => ranked.filter((r) => {
    const p = (r.values[col.id]! / col.max) * 100;
    return i === 9 ? p >= 90 : p >= i * 10 && p < (i + 1) * 10;
  }).length);
  const peak = Math.max(1, ...buckets);

  return (
    <Screen>
      <Header title="الإحصاء" subtitle={`${book.title} · ${sectionLabel(book.section_id)}`} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {book.columns.map((x) => <Chip key={x.id} label={x.name} active={x.id === col.id} onPress={() => setColId(x.id)} />)}
      </ScrollView>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
        <Ring value={st.passRate} size={112} stroke={12} color={st.passRate != null && st.passRate < 50 ? tone.bad.ink : c.accent}>
          <T display size={26}>{st.passRate == null ? '—' : `${formatScore(st.passRate, 0)}٪`}</T>
          <T dim size={12} style={{ marginTop: -6 }}>نسبة النجاح</T>
        </Ring>
        <View style={{ flex: 1, gap: 8 }}>
          <Row gap={6} style={{ flexWrap: 'wrap' }}>
            <Pill label={`ناجح ${arDigits(st.passCount)}`} tone="good" />
            <Pill label={`راسب ${arDigits(st.failCount)}`} tone="bad" />
          </Row>
          <T dim size={13}>من {arDigits(st.count)} طالباً أُدخلت درجاتهم{missing.length ? ` · ينقص ${arDigits(missing.length)}` : ''}</T>
        </View>
      </Card>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Stat label="المعدل" value={formatScore(st.avg)} icon="chart" />
        <Stat label="الوسيط" value={formatScore(st.median)} icon="sort" />
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Stat label="الأعلى" value={formatScore(st.max)} icon="up" tone="good" />
        <Stat label="الأدنى" value={formatScore(st.min)} icon="down" tone="bad" />
      </View>

      <SectionTitle title="التقديرات" />
      <Card><Bars items={st.bands} total={st.count} /></Card>

      <SectionTitle title="توزيع الدرجات" />
      <Card style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 4 }}>
          {buckets.map((n, i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              {n ? <T size={10} dim>{arDigits(n)}</T> : null}
              <View style={{ width: '100%', height: Math.max(3, (n / peak) * 92), borderRadius: 6, backgroundColor: i < book.result.pass / 10 ? tone.bad.ink : c.accent, opacity: n ? 1 : 0.25 }} />
            </View>
          ))}
        </View>
        <Row style={{ justifyContent: 'space-between' }}>
          <T size={10} dim>٠٪</T><T size={10} dim>٥٠٪</T><T size={10} dim>١٠٠٪</T>
        </Row>
      </Card>

      {top.length ? (
        <>
          <SectionTitle title="الأوائل" />
          <Card style={{ paddingVertical: 4 }}>
            {top.map((r, i) => <RankRow key={r.student.id} i={i} name={r.student.name} v={r.values[col.id]} id={r.student.id} good />)}
          </Card>
        </>
      ) : null}
      {bottom.length ? (
        <>
          <SectionTitle title="الأقل درجة" />
          <Card style={{ paddingVertical: 4 }}>
            {bottom.map((r, i) => <RankRow key={r.student.id} i={i} name={r.student.name} v={r.values[col.id]} id={r.student.id} />)}
          </Card>
        </>
      ) : null}
      {missing.length ? (
        <>
          <SectionTitle title="لم تُدخل درجاتهم" />
          <Card style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {missing.map((r) => <Chip key={r.student.id} small label={r.student.name} onPress={() => router.push(`/student/${r.student.id}`)} />)}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

function RankRow({ i, name, v, id, good }: { i: number; name: string; v: number | null; id: string; good?: boolean }) {
  const { c, tone } = useTheme();
  return (
    <PressScale onPress={() => router.push(`/student/${id}`)} scaleTo={0.98}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: good ? tone.good.bg : tone.bad.bg, alignItems: 'center', justifyContent: 'center' }}>
        <T size={12} weight="bold" color={good ? tone.good.ink : tone.bad.ink} style={{ lineHeight: 18 }}>{arDigits(i + 1)}</T>
      </View>
      <T size={15} weight="medium" style={{ flex: 1 }} lines={1}>{name}</T>
      <T size={16} weight="bold">{formatScore(v)}</T>
    </PressScale>
  );
}
