import { arDigits, formatPercent, formatYear, type Gradebook } from '@nahj/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Icon } from '@/components/icon';
import { Pill } from '@/components/kit';
import { PressScale } from '@/components/motion';
import { Card, Chip, Empty, Fab, Header, IconButton, Row, Screen, T } from '@/components/ui';
import { get, getLocal, setLocal, useQuery, useSettings } from '@/data/db';
import { allSections, booksOfSection, bookProgress, criticalCount, resultStats, sectionClass, sectionLabel } from '@/data/queries';
import { useWide } from '@/lib/hooks';
import { useTheme } from '@/lib/theme';

/** مراحل السنة لعناوين سجلات السنة */
const STAGES: { title: string; from: number; to: number }[] = [
  { title: 'الفصل الأول', from: 1, to: 3 },
  { title: 'نصف السنة', from: 4, to: 4 },
  { title: 'الفصل الثاني', from: 5, to: 7 },
  { title: 'نهاية السنة', from: 8, to: 99 },
];

/** الدرجات: المكان الوحيد لكل السجلات — تختار الشعبة فتظهر سجلاتها بترتيب السنة */
export default function Grades() {
  const params = useLocalSearchParams<{ section?: string }>();
  const { c, hue } = useTheme();
  const sections = useQuery(() => allSections());
  const [sel, setSel] = useState<string | null>(params.section ?? getLocal('lastSection'));
  const [archived, setArchived] = useState(false);
  useEffect(() => { if (params.section) setSel(params.section); }, [params.section]);
  const current = sections.find((s) => s.id === sel) ?? sections[0];
  const choose = (id: string) => { setSel(id); setLocal('lastSection', id); };
  const data = useQuery(() => (current ? booksOfSection(current.id, archived) : null), [current?.id, archived]);
  const k = current ? sectionClass(current.id) : undefined;
  const wide = useWide();

  return (
    <View style={{ flex: 1 }}>
      <Screen wide={wide}>
        <Header back={false} title="الدرجات" subtitle={current ? sectionLabel(current.id) : 'سجلات الدرجات لكل شعبة'}
          right={(
            <>
              {current ? <IconButton name="mic" label="الإدخال الصوتي" onPress={() => router.push(`/voice?section=${current.id}`)} /> : null}
              <IconButton name="settings" label="إعدادات الدرجات" onPress={() => router.push('/settings/grades')} />
            </>
          )} />
        {!sections.length ? (
          <Card><Empty icon="school" title="أضف صفوفك أولاً" body="سجلات الدرجات تُنشأ لكل شعبة." action="إضافة صف" onAction={() => router.push('/class/new')} /></Card>
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {sections.map((s) => <Chip key={s.id} label={sectionLabel(s.id, true)} active={s.id === current?.id} onPress={() => choose(s.id)} />)}
            </ScrollView>

            {data && !data.sets.length && !data.loose.length ? (
              archived ? <Card><Empty icon="table" title="لا سجلات مؤرشفة" /></Card> : (
                <PressScale onPress={() => router.push(`/book/year?section=${current!.id}`)} scaleTo={0.98}
                  style={{ backgroundColor: c.heroBg, borderRadius: 24, padding: 20, gap: 10 }}>
                  <Row gap={12}>
                    <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="calendar" size={24} color="#FFFFFF" accent={c.gold} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <T weight="bold" size={18} color={c.heroInk}>ابدأ سجلات السنة</T>
                      <T size={13} color={c.heroInk2}>{sectionLabel(current!.id)}</T>
                    </View>
                    <Icon name="forward" size={20} color={c.heroInk} />
                  </Row>
                  <T size={13} color={c.heroInk2} style={{ lineHeight: 22 }}>الأشهر الأربعة بحقولها (تحريري، شفهي…)، وسعي الفصلين، ونصف السنة، والسعي السنوي — محسوبة وحدها.</T>
                </PressScale>
              )
            ) : null}

            {data?.sets.map((set) => (
              <View key={set.id} style={{ gap: 10 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Row gap={8}>
                    <View style={{ width: 8, height: 8, backgroundColor: c.gold }} />
                    <T weight="bold" size={16}>سجلات السنة {set.year ? formatYear(set.year) : ''}</T>
                  </Row>
                  <Chip small label="التقرير" onPress={() => router.push(`/reports?section=${current!.id}`)} />
                </Row>
                <View style={wide ? { flexDirection: 'row', flexWrap: 'wrap', gap: 12 } : { gap: 12 }}>
                {STAGES.map((st) => {
                  const books = set.books.filter((b) => (b.ord ?? 0) >= st.from && (b.ord ?? 0) <= st.to);
                  if (!books.length) return null;
                  return (
                    <Card key={st.title} style={{ paddingVertical: 4, ...(wide ? { flexBasis: '48%', flexGrow: 1 } : null) }}>
                      <T dim size={12} weight="bold" style={{ paddingTop: 10, paddingBottom: 2 }}>{st.title}</T>
                      {books.map((b, i) => <BookRow key={b.id} book={b} divider={i > 0} color={hue(k?.hue)} />)}
                    </Card>
                  );
                })}
                </View>
              </View>
            ))}

            {data?.loose.length ? (
              <View style={{ gap: 10 }}>
                <Row gap={8}>
                  <View style={{ width: 8, height: 8, backgroundColor: c.gold }} />
                  <T weight="bold" size={16}>سجلات أخرى</T>
                </Row>
                <Card style={{ paddingVertical: 4 }}>
                  {data.loose.map((b, i) => <BookRow key={b.id} book={b} divider={i > 0} color={hue(k?.hue)} />)}
                </Card>
              </View>
            ) : null}

            <Row style={{ justifyContent: 'center' }}>
              <Chip label={archived ? 'السجلات الحالية' : 'السجلات المؤرشفة'} small onPress={() => setArchived(!archived)} />
            </Row>
          </>
        )}
        <View style={{ height: 70 }} />
      </Screen>
      {current ? <Fab tabs title="سجل جديد" onPress={() => router.push(`/book/new?section=${current.id}`)} /> : null}
    </View>
  );
}

/** ما ينتظره السجل المحسوب قبل أن يظهر فيه شيء */
const WAITING: Record<string, string> = {
  term: 'يُحسب عند إدخال الشهرين',
  annual: 'يُحسب من سعي الفصلين ونصف السنة',
  final: 'يُحسب من السعي والامتحان النهائي',
};

function BookRow({ book, divider, color }: { book: Gradebook; divider: boolean; color: string }) {
  const { c } = useTheme();
  const alerts = useSettings().prefs.criticalAlerts;
  const info = useQuery(() => {
    const p = bookProgress(book);
    const st = resultStats(book);
    return { p, rate: st?.shown ? st.stats.passRate : null, critical: criticalCount(book) };
  }, [book.id]);
  const computed = info.p.computed;
  const pct = info.p.total ? info.p.filled / info.p.total : 0;
  const live = get('gradebooks', book.id);
  return (
    <PressScale onPress={() => router.push(`/book/${book.id}`)} scaleTo={0.98}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: divider ? 1 : 0, borderTopColor: c.line }}>
      <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: computed ? c.accent : c.soft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={computed ? 'formula' : 'edit'} size={17} color={computed ? c.accentInk : c.accent} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Row gap={6}>
          {live?.pinned ? <Icon name="pin" size={13} color={c.accent} /> : null}
          <T weight="bold" size={15} lines={1} style={{ flexShrink: 1 }}>{book.group_id ? book.title.split(' — ')[0] : book.title}</T>
        </Row>
        {computed ? (
          <T dim size={12}>{info.p.filled ? `حُسب ${arDigits(info.p.filled)} من ${arDigits(info.p.total)}` : WAITING[book.role ?? 'custom'] ?? 'يُحسب عند اكتمال مصادره'}</T>
        ) : (
          <Row gap={8}>
            <View style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: c.line, overflow: 'hidden' }}>
              <View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: `${pct * 100}%`, backgroundColor: color }} />
            </View>
            <T dim size={11}>{arDigits(info.p.filled)}/{arDigits(info.p.total)}</T>
          </Row>
        )}
      </View>
      {alerts && info.critical ? <Pill small label={`حرجة ${arDigits(info.critical)}`} tone="warn" /> : null}
      {info.rate != null ? <Pill small label={`نجاح ${formatPercent(info.rate)}`} tone={info.rate >= 50 ? 'good' : 'bad'} /> : null}
      <Icon name="forward" size={16} color={c.ink3} />
    </PressScale>
  );
}
