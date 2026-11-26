import { arDigits, formatPercent, formatScore } from '@nahj/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Icon } from '@/components/icon';
import { Pill, Ring } from '@/components/kit';
import { PressScale } from '@/components/motion';
import { Button, Card, Chip, Empty, Header, Row, Screen, T } from '@/components/ui';
import { setSettings, useQuery, useSettings } from '@/data/db';
import { allSections, sectionLabel, sectionReport } from '@/data/queries';
import { exportSectionReportXlsx, printSectionReport } from '@/lib/export';
import { useWide } from '@/lib/hooks';
import { useTheme } from '@/lib/theme';
import { toast } from '@/lib/toast';

/** تقرير كل شعبة: نتيجة كل سجل بترتيب السنة، الراسبون، الدرجات الحرجة، والغياب — مع Excel وPDF */
export default function Reports() {
  const params = useLocalSearchParams<{ section?: string }>();
  const { c, tone } = useTheme();
  const wide = useWide();
  const prefs = useSettings().prefs;
  const sections = useQuery(() => allSections());
  const [sel, setSel] = useState<string | null>(params.section ?? prefs.lastSection ?? null);
  const current = sections.find((s) => s.id === sel) ?? sections[0];
  const rep = useQuery(() => (current ? sectionReport(current.id) : null), [current?.id]);
  const choose = (id: string) => { setSel(id); setSettings({ prefs: { ...prefs, lastSection: id } }); };
  const run = (fn: () => Promise<void>) => fn().catch((e) => toast(e instanceof Error ? e.message : 'تعذّر', { tone: 'bad', icon: 'info' }));

  // البطاقة الرئيسية: آخر سجل محسوب فيه درجات (السعي السنوي ثم الفصل الثاني ثم الأول…)
  const RANK = { final: 5, annual: 4, term: 3, mid: 2, month: 1, custom: 0 } as const;
  const headline = rep?.stages.filter((s) => s.stats?.count)
    .sort((a, b) => (RANK[a.book.role ?? 'custom'] - RANK[b.book.role ?? 'custom']) || ((a.book.ord ?? 0) - (b.book.ord ?? 0))).at(-1);
  const pending = rep?.stages.filter((s) => s.critical) ?? [];

  return (
    <Screen wide={wide}>
      <Header title="التقارير" subtitle={current ? sectionLabel(current.id) : undefined} />
      {!current || !rep ? (
        <Card><Empty icon="school" title="لا شعب بعد" action="إضافة صف" onAction={() => router.replace('/class/new')} /></Card>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {sections.map((s) => <Chip key={s.id} label={sectionLabel(s.id, true)} active={s.id === current.id} onPress={() => choose(s.id)} />)}
          </ScrollView>
          <Row gap={8}>
            <Button title="Excel" icon="excel" small variant="secondary" style={{ flex: 1 }} onPress={() => run(() => exportSectionReportXlsx(current.id))} />
            <Button title="طباعة / PDF" icon="print" small style={{ flex: 1 }} onPress={() => run(() => printSectionReport(current.id, 'print'))} />
          </Row>

          {!rep.stages.length ? (
            <Card><Empty icon="table" title="لا سجلات درجات لهذه الشعبة" body="أنشئ سجلات السنة من تبويب الدرجات، فيظهر التقرير هنا." action="فتح الدرجات" onAction={() => router.push({ pathname: '/grades', params: { section: current.id } })} /></Card>
          ) : (
            <>
              {headline?.stats ? (
                <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
                  <Ring value={headline.stats.passRate} size={104} color={headline.stats.passRate != null && headline.stats.passRate < 50 ? tone.bad.ink : c.accent}>
                    <T display size={24}>{headline.stats.passRate == null ? '—' : formatPercent(headline.stats.passRate)}</T>
                    <T dim size={11} style={{ marginTop: -6 }}>نجاح</T>
                  </Ring>
                  <View style={{ flex: 1, gap: 6 }}>
                    <T weight="bold" size={16}>{headline.book.title}</T>
                    <Row gap={6} style={{ flexWrap: 'wrap' }}>
                      <Pill label={`ناجح ${arDigits(headline.stats.passCount)}`} tone="good" small />
                      <Pill label={`راسب ${arDigits(headline.stats.failCount)}`} tone="bad" small />
                    </Row>
                    <T dim size={13}>المعدل {formatScore(headline.stats.avg)} · الأعلى {formatScore(headline.stats.max)} · الأدنى {formatScore(headline.stats.min)}</T>
                  </View>
                </Card>
              ) : null}

              {pending.length ? (
                <Card tone="soft" style={{ gap: 8 }}>
                  <Row gap={8}><Icon name="info" size={18} color={tone.warn.ink} /><T weight="bold" size={14} color={tone.warn.ink}>درجات حرجة تنتظر قرارك</T></Row>
                  {pending.map((s) => (
                    <PressScale key={s.book.id} onPress={() => router.push(`/book/${s.book.id}`)} scaleTo={0.98}>
                      <Row style={{ justifyContent: 'space-between' }}>
                        <T size={14}>{s.book.title}</T>
                        <Pill small label={`${arDigits(s.critical)} طالب`} tone="warn" />
                      </Row>
                    </PressScale>
                  ))}
                </Card>
              ) : null}

              <Row gap={8}><View style={{ width: 8, height: 8, backgroundColor: c.gold }} /><T weight="bold" size={16}>النتائج حسب السجل</T></Row>
              <Card style={{ paddingVertical: 4 }}>
                {wide ? (
                  <View style={{ flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.line }}>
                    {['السجل', 'أُدخلت', 'الناجحون', 'الراسبون', 'النجاح', 'المعدل', 'الأعلى', 'الأدنى'].map((h, i) => (
                      <T key={h} size={12} weight="bold" dim style={{ flex: i ? 1 : 2.4, textAlign: i ? 'center' : 'right' }}>{h}</T>
                    ))}
                  </View>
                ) : null}
                {rep.stages.map((s, i) => (
                  <PressScale key={s.book.id} onPress={() => router.push(`/book/${s.book.id}`)} scaleTo={0.99}
                    style={{ paddingVertical: 12, borderTopWidth: i && !wide ? 1 : wide && i ? 1 : 0, borderTopColor: c.line, gap: 6 }}>
                    {wide ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <T weight="bold" size={14} style={{ flex: 2.4 }} lines={1}>{s.book.title}</T>
                        {[arDigits(s.stats?.count ?? 0), arDigits(s.stats?.passCount ?? 0), arDigits(s.stats?.failCount ?? 0),
                          s.stats?.passRate == null ? '—' : formatPercent(s.stats.passRate), formatScore(s.stats?.avg), formatScore(s.stats?.max), formatScore(s.stats?.min)].map((v, j) => (
                          <T key={j} size={14} weight={j === 3 ? 'bold' : 'medium'} color={j === 2 && s.stats?.failCount ? tone.bad.ink : c.ink} style={{ flex: 1, textAlign: 'center' }}>{v}</T>
                        ))}
                      </View>
                    ) : (
                      <>
                        <Row style={{ justifyContent: 'space-between' }}>
                          <T weight="bold" size={15} lines={1} style={{ flex: 1 }}>{s.book.title}</T>
                          {s.stats?.count ? <Pill small label={`نجاح ${formatPercent(s.stats.passRate ?? 0)}`} tone={(s.stats.passRate ?? 0) >= 50 ? 'good' : 'bad'} /> : <T dim size={12}>لا درجات بعد</T>}
                        </Row>
                        {s.stats?.count ? (
                          <T dim size={12}>ناجح {arDigits(s.stats.passCount)} · راسب {arDigits(s.stats.failCount)} · المعدل {formatScore(s.stats.avg)} · الأعلى {formatScore(s.stats.max)} · الأدنى {formatScore(s.stats.min)}</T>
                        ) : null}
                      </>
                    )}
                  </PressScale>
                ))}
              </Card>

              <FailingList stages={rep.stages.filter((s) => s.failing.length)} />

              {rep.absences.length ? (
                <>
                  <Row gap={8}><View style={{ width: 8, height: 8, backgroundColor: c.gold }} /><T weight="bold" size={16}>الغياب</T></Row>
                  <Card style={{ paddingVertical: 4 }}>
                    {rep.absences.slice(0, 15).map((a, i) => (
                      <PressScale key={a.student.id} onPress={() => router.push(`/student/${a.student.id}`)} scaleTo={0.99}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
                        <T size={14} weight="medium" style={{ flex: 1 }} lines={1}>{a.student.name}</T>
                        {a.absent ? <Pill small label={`غائب ${arDigits(a.absent)}`} tone={a.absent >= 5 ? 'bad' : 'warn'} /> : null}
                        {a.late ? <Pill small label={`متأخر ${arDigits(a.late)}`} tone="neutral" /> : null}
                      </PressScale>
                    ))}
                  </Card>
                </>
              ) : null}
            </>
          )}
        </>
      )}
    </Screen>
  );
}

/** الراسبون في كل سجل (السجلات المحسوبة أولاً لأنها الأهم) */
function FailingList({ stages }: { stages: ReturnType<typeof sectionReport>['stages'] }) {
  const { c, tone } = useTheme();
  const ordered = [...stages.filter((s) => s.book.role && s.book.role !== 'month' && s.book.role !== 'custom').reverse(), ...stages.filter((s) => !s.book.role || s.book.role === 'month' || s.book.role === 'custom')];
  const [open, setOpen] = useState<string | null>(ordered[0]?.book.id ?? null);
  if (!ordered.length) return null;
  return (
    <>
      <Row gap={8}><View style={{ width: 8, height: 8, backgroundColor: c.gold }} /><T weight="bold" size={16}>الراسبون</T></Row>
      <Card style={{ paddingVertical: 4 }}>
        {ordered.map((s, i) => (
          <View key={s.book.id} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
            <PressScale onPress={() => setOpen(open === s.book.id ? null : s.book.id)} scaleTo={0.99} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 }}>
              <T weight="bold" size={14} style={{ flex: 1 }}>{s.book.title}</T>
              <Pill small label={`${arDigits(s.failing.length)} راسب`} tone="bad" />
              <Icon name={open === s.book.id ? 'up' : 'down'} size={16} color={c.ink3} />
            </PressScale>
            {open === s.book.id ? (
              <View style={{ paddingBottom: 10, gap: 6 }}>
                {s.failing.map((f) => (
                  <Row key={f.student.id} style={{ justifyContent: 'space-between', paddingHorizontal: 6 }}>
                    <T size={14} lines={1} style={{ flex: 1 }}>{f.student.name}</T>
                    <T weight="bold" size={14} color={tone.bad.ink}>{formatScore(f.value)}</T>
                  </Row>
                ))}
              </View>
            ) : null}
          </View>
        ))}
      </Card>
    </>
  );
}
