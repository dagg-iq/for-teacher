import { arDigits, detectLayout, formatScore, matchSheet, type Cell, type ImportRow, type SheetLayout } from '@nahj/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Pill } from '@/components/kit';
import { Button, Card, Chip, Empty, Header, Row, Screen, SectionTitle, T } from '@/components/ui';
import { get, useQuery } from '@/data/db';
import { setGrade } from '@/data/grades';
import { studentsOf } from '@/data/queries';
import { pickSheetRows } from '@/lib/export';
import { useTheme } from '@/lib/theme';
import { toast } from '@/lib/toast';

/** استيراد درجات من ملف Excel إلى أعمدة السجل */
export default function ImportGrades() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c, tone } = useTheme();
  const book = useQuery(() => get('gradebooks', id), [id]);
  const [rows, setRows] = useState<Cell[][] | null>(null);
  const [layout, setLayout] = useState<SheetLayout | null>(null);
  const [matched, setMatched] = useState<ImportRow[]>([]);
  const [map, setMap] = useState<Record<number, string | null>>({});
  const [busy, setBusy] = useState(false);
  if (!book) return <Screen><Header /><Empty title="السجل غير موجود" /></Screen>;
  const inputs = book.columns.filter((x) => x.kind === 'input');

  const pick = async () => {
    try {
      setBusy(true);
      const r = await pickSheetRows();
      if (!r) return;
      const l = detectLayout(r);
      if (!l || !l.numeric.length) { toast('لم أجد عمود أسماء وأعمدة درجات في الملف', { tone: 'bad', icon: 'info' }); return; }
      setRows(r);
      setLayout(l);
      setMatched(matchSheet(r, l, studentsOf(book.section_id)));
      // ربط تلقائي بالاسم المتشابه، وإلا بالترتيب
      const auto: Record<number, string | null> = {};
      const taken = new Set<string>();
      const norm = (x: string) => x.replace(/\s/g, '');
      // أولاً: الأعمدة بنفس الاسم، ثم الباقي بالترتيب — ولا يُربط عمودان بنفس عمود السجل
      for (const n of l.numeric) {
        const same = inputs.find((x) => norm(x.name) === norm(n.title) && !taken.has(x.id));
        if (same) { auto[n.col] = same.id; taken.add(same.id); }
      }
      for (const n of l.numeric) {
        if (auto[n.col]) continue;
        const next = inputs.find((x) => !taken.has(x.id));
        auto[n.col] = next?.id ?? null;
        if (next) taken.add(next.id);
      }
      setMap(auto);
    } catch (e) {
      toast(`تعذّر قراءة الملف: ${e instanceof Error ? e.message : ''}`, { tone: 'bad' });
    } finally { setBusy(false); }
  };

  const ok = matched.filter((m) => m.student);
  const apply = () => {
    let n = 0;
    let over = 0;
    for (const m of ok) for (const [col, target] of Object.entries(map)) {
      if (!target) continue;
      const v = m.values[Number(col)];
      if (v == null) continue;
      const max = inputs.find((x) => x.id === target)?.max ?? 100;
      if (v < 0 || v > max) { over++; continue; }
      setGrade(book.id, m.student!.id, target, v, null);
      n++;
    }
    toast(`استُوردت ${arDigits(n)} درجة${over ? ` (تُركت ${arDigits(over)} خارج الحدود)` : ''}`, { icon: 'check' });
    router.back();
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="استيراد درجات" subtitle={book.title} />
      {!rows ? (
        <Card style={{ gap: 12 }}>
          <T size={14} dim>اختر ملف Excel فيه عمود أسماء الطلاب وعمود درجات أو أكثر. يطابق نَهج الأسماء تلقائياً حتى لو اختلفت الكتابة قليلاً.</T>
          <Button title="اختيار ملف Excel" icon="excel" loading={busy} onPress={pick} />
        </Card>
      ) : layout ? (
        <>
          <SectionTitle title="ربط الأعمدة" />
          {layout.numeric.map((n) => (
            <Card key={n.col} style={{ gap: 8 }}>
              <T weight="bold" size={15}>«{n.title}» في الملف ←</T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Chip small label="تجاهل" active={!map[n.col]} onPress={() => setMap((m) => ({ ...m, [n.col]: null }))} />
                {inputs.map((x) => <Chip key={x.id} small label={x.name} active={map[n.col] === x.id} onPress={() => setMap((m) => {
                  // عمود السجل لا يأخذ أكثر من عمود من الملف
                  const next = Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v === x.id ? null : v]));
                  return { ...next, [n.col]: x.id };
                })} />)}
              </View>
            </Card>
          ))}
          <SectionTitle title={`الطلاب (${arDigits(ok.length)} من ${arDigits(matched.length)})`} />
          <Card style={{ paddingVertical: 4 }}>
            {matched.map((m, i) => (
              <Row key={`${m.name}-${i}`} style={{ paddingVertical: 9, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
                <View style={{ flex: 1 }}>
                  <T size={14} weight="medium" lines={1}>{m.name}</T>
                  {m.student && m.student.name !== m.name ? <T size={11} dim lines={1}>← {m.student.name}</T> : null}
                </View>
                <T size={13} dim>{layout.numeric.filter((n) => map[n.col]).map((n) => formatScore(m.values[n.col])).join(' · ')}</T>
                {m.student ? (m.sure ? null : <Pill small label="تحقق" tone="warn" />) : <Pill small label="غير موجود" tone="bad" />}
              </Row>
            ))}
          </Card>
          {matched.some((m) => !m.student) ? <T size={12} color={tone.bad.ink}>الأسماء غير الموجودة في الشعبة لن تُستورد.</T> : null}
          <Row gap={8}>
            <Button title="ملف آخر" variant="secondary" onPress={pick} />
            <Button title="استيراد" icon="check" style={{ flex: 1 }} disabled={!ok.length || !Object.values(map).some(Boolean)} onPress={apply} />
          </Row>
        </>
      ) : null}
    </Screen>
  );
}
