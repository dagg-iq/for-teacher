import {
  arDigits, displayToFormula, evaluateRow, formatScore, formulaToDisplay, FUNCTION_HELP, IRAQI_BANDS, PASS_FAIL_BANDS,
  quickFormula, uuid, validateFormula, type Band, type GradeColumn, type Gradebook, formatPercent } from '@nahj/shared';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Icon } from '@/components/icon';
import { Group, Pill, Stepper, ToggleRow } from '@/components/kit';
import { PressScale } from '@/components/motion';
import { Sheet } from '@/components/sheet';
import { Button, Card, Chip, Empty, Field, Header, IconButton, Row, Screen, Segmented, SectionTitle, T } from '@/components/ui';
import { get, update, useQuery } from '@/data/db';
import { sheetOf } from '@/data/queries';
import { Alert } from '@/lib/dialog';
import { useTheme } from '@/lib/theme';
import { toast } from '@/lib/toast';

/** الأعمدة والمعادلات وقاعدة النجاح */
export default function Columns() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  const book = useQuery(() => get('gradebooks', id), [id]);
  const [editing, setEditing] = useState<GradeColumn | 'new-input' | 'new-formula' | null>(null);
  if (!book) return <Screen><Header /><Empty title="السجل غير موجود" /></Screen>;

  const save = (columns: GradeColumn[], result = book.result) => update('gradebooks', book.id, { columns, result });
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= book.columns.length) return;
    const next = book.columns.slice();
    [next[i], next[j]] = [next[j], next[i]];
    save(next);
  };
  const del = (col: GradeColumn) => {
    const users = book.columns.filter((x) => x.formula?.includes(`{${col.id}}`));
    Alert.alert(`حذف «${col.name}»؟`, users.length ? `تعتمد عليه: ${users.map((u) => u.name).join('، ')}. ستصبح فارغة حتى تعدّل معادلاتها.` : 'ستُحذف درجات هذا العمود من السجل.', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: () => save(book.columns.filter((x) => x.id !== col.id), book.result.column_id === col.id ? { ...book.result, column_id: null } : book.result) },
    ]);
  };

  return (
    <Screen>
      <Header title="الأعمدة والمعادلات" subtitle={book.title} />
      <Card style={{ paddingVertical: 4 }}>
        {book.columns.map((col, i) => (
          <View key={col.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
            <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: col.kind === 'formula' ? c.accent : c.soft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={col.kind === 'formula' ? 'formula' : 'edit'} size={17} color={col.kind === 'formula' ? c.accentInk : c.accent} />
            </View>
            <PressScale style={{ flex: 1 }} onPress={() => setEditing(col)} scaleTo={0.98}>
              <Row gap={6}>
                <T weight="bold" size={15} lines={1} style={{ flexShrink: 1 }}>{col.name}</T>
                {book.result.column_id === col.id ? <Pill small label="النتيجة" tone="info" /> : null}
                {col.hidden ? <Pill small label="مخفي" /> : null}
              </Row>
              <T dim size={12} lines={1}>
                {col.kind === 'formula' ? safeDisplay(col.formula ?? '', book.columns) : `إدخال · من ${arDigits(col.max)}`}
              </T>
            </PressScale>
            <View style={{ gap: 2 }}>
              <IconButton name="up" label="لأعلى" size={30} onPress={() => move(i, -1)} />
              <IconButton name="down" label="لأسفل" size={30} onPress={() => move(i, 1)} />
            </View>
            <IconButton name="trash" label={`حذف ${col.name}`} size={34} onPress={() => del(col)} />
          </View>
        ))}
      </Card>
      <Row gap={8}>
        <Button title="عمود إدخال" icon="plus" variant="secondary" small style={{ flex: 1 }} onPress={() => setEditing('new-input')} />
        <Button title="عمود معادلة" icon="formula" small style={{ flex: 1 }} onPress={() => setEditing('new-formula')} />
      </Row>

      <ResultRuleEditor book={book} onChange={(result) => save(book.columns, result)} />

      {editing ? (
        <ColumnEditor book={book} col={typeof editing === 'string' ? null : editing} kind={editing === 'new-input' ? 'input' : editing === 'new-formula' ? 'formula' : (editing as GradeColumn).kind}
          onClose={() => setEditing(null)}
          onSave={(col) => {
            const exists = book.columns.some((x) => x.id === col.id);
            save(exists ? book.columns.map((x) => (x.id === col.id ? col : x)) : [...book.columns, col]);
            setEditing(null);
            toast('حُفظ العمود', { icon: 'check' });
          }} />
      ) : null}
    </Screen>
  );
}

function safeDisplay(f: string, cols: GradeColumn[]) {
  try { return `= ${formulaToDisplay(f, cols)}`; } catch { return 'معادلة غير صحيحة'; }
}

type Op = 'avg' | 'sum' | 'max' | 'min' | 'weighted' | 'scale' | 'free';
const OPS: { key: Op; label: string; hint: string }[] = [
  { key: 'avg', label: 'معدل', hint: 'معدل الأعمدة المختارة' },
  { key: 'sum', label: 'مجموع', hint: 'مجموع الأعمدة المختارة' },
  { key: 'weighted', label: 'مرجّح', hint: 'لكل عمود وزن (نسبة) مختلف' },
  { key: 'max', label: 'الأعلى', hint: 'أعلى درجة بين الأعمدة' },
  { key: 'min', label: 'الأدنى', hint: 'أدنى درجة بين الأعمدة' },
  { key: 'scale', label: 'تحويل', hint: 'تحويل الدرجة إلى عظمى أخرى (مثل من ١٠ إلى ١٠٠)' },
  { key: 'free', label: 'معادلة حرة', hint: 'اكتب المعادلة بنفسك' },
];

/** محرر عمود: الاسم، العظمى، ومنشئ المعادلة مع معاينة فورية */
function ColumnEditor({ book, col, kind, onClose, onSave }: {
  book: Gradebook; col: GradeColumn | null; kind: 'input' | 'formula'; onClose: () => void; onSave: (c: GradeColumn) => void;
}) {
  const { c, tone } = useTheme();
  const [colId] = useState(col?.id ?? uuid());
  const [name, setName] = useState(col?.name ?? (kind === 'formula' ? 'المعدل' : ''));
  const [max, setMax] = useState(col?.max ?? 100);
  const [round, setRound] = useState<NonNullable<GradeColumn['round']>>(col?.round ?? (kind === 'formula' ? 'int' : 'none'));
  const [hidden, setHidden] = useState(!!col?.hidden);
  const others = book.columns.filter((x) => x.id !== colId);
  const [op, setOp] = useState<Op>(col?.formula ? 'free' : 'avg');
  const [picked, setPicked] = useState<string[]>([]);
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [scaleFrom, setScaleFrom] = useState(10);
  const [free, setFree] = useState(() => (col?.formula ? safeFree(col.formula, book.columns) : ''));

  const formula = useMemo(() => {
    if (kind !== 'formula') return '';
    try {
      switch (op) {
        case 'avg': return picked.length ? quickFormula.avg(picked) : '';
        case 'sum': return picked.length ? quickFormula.sum(picked) : '';
        case 'max': return picked.length ? quickFormula.max(picked) : '';
        case 'min': return picked.length ? quickFormula.min(picked) : '';
        case 'weighted': return picked.length ? quickFormula.weighted(picked.map((p) => ({ id: p, weight: weights[p] ?? 1 }))) : '';
        case 'scale': return picked[0] ? quickFormula.scale(picked[0], scaleFrom, max) : '';
        case 'free': return free.trim() ? displayToFormula(free, [...others, { id: colId, name, kind: 'formula', max }]) : '';
      }
    } catch (e) {
      return `!${e instanceof Error ? e.message : ''}`;
    }
    return '';
  }, [kind, op, picked, weights, scaleFrom, max, free, others, colId, name]);

  const error = kind === 'formula'
    ? (!formula ? 'اختر الأعمدة أو اكتب المعادلة' : formula.startsWith('!') ? formula.slice(1) : validateFormula(formula, [...others, { id: colId, name, kind: 'formula', max }], colId))
    : null;

  // معاينة على أول ثلاثة طلاب
  const preview = useMemo(() => {
    if (error || kind !== 'formula') return [];
    const trial: GradeColumn[] = [...others, { id: colId, name, kind: 'formula', max, formula, round }];
    return sheetOf({ ...book, columns: book.columns }).slice(0, 3).map((r) => {
      const inputs: Record<string, number | null> = {};
      for (const x of others) if (x.kind === 'input') inputs[x.id] = r.values[x.id];
      return { name: r.student.name, value: evaluateRow(trial, inputs)[colId] };
    });
  }, [error, kind, others, colId, name, max, formula, round, book]);

  const pickable = op === 'scale' ? others : others;
  const toggle = (id: string) => setPicked((p) => (op === 'scale' ? [id] : p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const insertToken = (t: string) => setFree((f) => `${f}${f && !f.endsWith(' ') && !f.endsWith('(') ? ' ' : ''}${t}`);

  return (
    <Sheet visible onClose={onClose}>
      <ScrollView style={{ maxHeight: 620 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12, paddingBottom: 8 }}>
        <T display size={22}>{col ? 'تعديل العمود' : kind === 'formula' ? 'عمود معادلة' : 'عمود إدخال'}</T>
        <Field label="اسم العمود" value={name} onChangeText={setName} placeholder={kind === 'formula' ? 'مثال: معدل الفصل' : 'مثال: الشهر الأول'} />
        <Row style={{ justifyContent: 'space-between' }}>
          <T weight="bold" size={14}>الدرجة العظمى</T>
          <Stepper value={max} onChange={setMax} min={1} max={1000} step={max >= 20 ? 10 : 1} />
        </Row>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {[5, 10, 20, 25, 30, 40, 50, 60, 80, 100].map((m) => <Chip key={m} small label={arDigits(m)} active={max === m} onPress={() => setMax(m)} />)}
        </ScrollView>

        {kind === 'formula' ? (
          <>
            <T weight="bold" size={14}>طريقة الحساب</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {OPS.map((o) => <Chip key={o.key} label={o.label} active={op === o.key} onPress={() => { setOp(o.key); if (o.key === 'scale') setPicked((p) => p.slice(0, 1)); }} />)}
            </View>
            <T dim size={12}>{OPS.find((o) => o.key === op)?.hint}</T>

            {op !== 'free' ? (
              <>
                <T weight="bold" size={14}>{op === 'scale' ? 'العمود' : 'الأعمدة'}</T>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {pickable.map((x) => <Chip key={x.id} label={x.name} active={picked.includes(x.id)} onPress={() => toggle(x.id)} />)}
                </View>
                {op === 'weighted' && picked.length ? (
                  <View style={{ gap: 8 }}>
                    {picked.map((p) => (
                      <Row key={p} style={{ justifyContent: 'space-between' }}>
                        <T size={14} style={{ flex: 1 }} lines={1}>{others.find((x) => x.id === p)?.name}</T>
                        <Stepper value={weights[p] ?? 1} min={1} max={100} onChange={(v) => setWeights((w) => ({ ...w, [p]: v }))} suffix="وزن" />
                      </Row>
                    ))}
                  </View>
                ) : null}
                {op === 'scale' ? (
                  <Row style={{ justifyContent: 'space-between' }}>
                    <T size={14}>من عظمى</T>
                    <Stepper value={scaleFrom} onChange={setScaleFrom} min={1} max={1000} />
                  </Row>
                ) : null}
              </>
            ) : (
              <>
                <Field value={free} onChangeText={setFree} multiline placeholder="مثال: ([الشهر الأول] + [نصف السنة]) / 2" style={{ minHeight: 80, textAlign: 'left', writingDirection: 'rtl' }} />
                <T dim size={12}>اضغط لإدراج عمود أو دالة:</T>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {others.map((x) => <Chip key={x.id} small label={x.name} onPress={() => insertToken(`[${x.name}]`)} />)}
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {['+', '-', '×', '÷', '(', ')', '،'].map((t) => <Chip key={t} small label={t} onPress={() => insertToken(t)} />)}
                  {FUNCTION_HELP.map((f) => <Chip key={f.fn} small label={`${f.ar}()`} onPress={() => insertToken(`${f.ar}(`)} />)}
                </View>
              </>
            )}

            <View style={{ backgroundColor: error ? tone.bad.bg : c.soft, borderRadius: 16, padding: 12, gap: 6 }}>
              {error ? <T size={13} weight="bold" color={tone.bad.ink}>{error}</T> : (
                <>
                  <T size={12} weight="bold" color={c.softInk}>= {safeDisplay(formula, [...others, { id: colId, name, kind: 'formula', max }]).slice(2)}</T>
                  {preview.map((p) => (
                    <Row key={p.name} style={{ justifyContent: 'space-between' }}>
                      <T size={13} color={c.softInk} lines={1} style={{ flex: 1 }}>{p.name}</T>
                      <T size={14} weight="bold" color={c.softInk}>{formatScore(p.value)}</T>
                    </Row>
                  ))}
                </>
              )}
            </View>
            <T weight="bold" size={14}>التقريب</T>
            <Segmented options={[{ key: 'int', label: 'عدد صحيح' }, { key: '1dp', label: 'منزلة واحدة' }, { key: 'none', label: 'بلا تقريب' }]} value={round} onChange={setRound} />
          </>
        ) : null}
        <ToggleRow title="إخفاء من الطباعة والتصدير" value={hidden} onChange={setHidden} />
        <Button title="حفظ العمود" icon="check" disabled={!name.trim() || !!error} onPress={() => onSave({
          id: colId, name: name.trim(), kind, max, round, hidden, ...(kind === 'formula' ? { formula } : {}),
        })} />
      </ScrollView>
    </Sheet>
  );
}

function safeFree(f: string, cols: GradeColumn[]) {
  try { return formulaToDisplay(f, cols); } catch { return ''; }
}

/** قاعدة النجاح والتقديرات */
function ResultRuleEditor({ book, onChange }: { book: Gradebook; onChange: (r: Gradebook['result']) => void }) {
  const r = book.result;
  const [editBand, setEditBand] = useState<number | null>(null);
  const preset = sameBands(r.bands, IRAQI_BANDS) ? 'iraqi' : sameBands(r.bands, PASS_FAIL_BANDS) ? 'passfail' : 'custom';
  return (
    <>
      <SectionTitle title="النتيجة والتقديرات" />
      <Group>
        <View style={{ paddingVertical: 12, gap: 8 }}>
          <T weight="bold" size={14}>العمود الذي يحدد النجاح</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {book.columns.map((x) => <Chip key={x.id} small label={x.name} active={r.column_id === x.id} onPress={() => onChange({ ...r, column_id: x.id })} />)}
          </View>
        </View>
        <Row style={{ justifyContent: 'space-between', paddingVertical: 12 }}>
          <View>
            <T weight="bold" size={14}>درجة النجاح</T>
            <T dim size={12}>نسبة من الدرجة العظمى</T>
          </View>
          <Stepper value={r.pass} onChange={(v) => onChange({ ...r, pass: v })} min={1} max={100} step={5} suffix={arDigits('%')} />
        </Row>
        <View style={{ paddingVertical: 12, gap: 8 }}>
          <T weight="bold" size={14}>التقديرات</T>
          <Row gap={8}>
            <Chip small label="عراقية (امتياز…ضعيف)" active={preset === 'iraqi'} onPress={() => onChange({ ...r, bands: IRAQI_BANDS.map((b) => ({ ...b })) })} />
            <Chip small label="ناجح/راسب" active={preset === 'passfail'} onPress={() => onChange({ ...r, bands: PASS_FAIL_BANDS.map((b) => ({ ...b, min: b.min ? r.pass : 0 })) })} />
          </Row>
          {[...r.bands].sort((a, b) => b.min - a.min).map((b) => {
            const i = r.bands.indexOf(b);
            return (
              <PressScale key={`${b.label}-${i}`} onPress={() => setEditBand(i)} scaleTo={0.98}>
                <Row style={{ justifyContent: 'space-between', paddingVertical: 4 }}>
                  <Pill label={b.label} tone={b.tone} />
                  <T dim size={13}>من {formatPercent(b.min)} فأعلى</T>
                </Row>
              </PressScale>
            );
          })}
          <Button small variant="ghost" title="إضافة تقدير" icon="plus" onPress={() => onChange({ ...r, bands: [...r.bands, { min: 0, label: 'تقدير', tone: 'neutral' }] })} />
        </View>
      </Group>
      {editBand != null && r.bands[editBand] ? (
        <BandEditor band={r.bands[editBand]} onClose={() => setEditBand(null)}
          onSave={(b) => { onChange({ ...r, bands: r.bands.map((x, i) => (i === editBand ? b : x)) }); setEditBand(null); }}
          onDelete={() => { onChange({ ...r, bands: r.bands.filter((_, i) => i !== editBand) }); setEditBand(null); }} />
      ) : null}
    </>
  );
}

function sameBands(a: Band[], b: Band[]) {
  return a.length === b.length && a.every((x, i) => x.label === b[i].label && x.min === b[i].min);
}

function BandEditor({ band, onClose, onSave, onDelete }: { band: Band; onClose: () => void; onSave: (b: Band) => void; onDelete: () => void }) {
  const [label, setLabel] = useState(band.label);
  const [min, setMin] = useState(band.min);
  const [toneKey, setTone] = useState(band.tone);
  return (
    <Sheet visible onClose={onClose}>
      <T display size={22}>تقدير</T>
      <View style={{ gap: 12, marginTop: 8 }}>
        <Field label="الاسم" value={label} onChangeText={setLabel} />
        <Row style={{ justifyContent: 'space-between' }}>
          <T weight="bold" size={14}>يبدأ من</T>
          <Stepper value={min} onChange={setMin} min={0} max={100} step={5} suffix={arDigits('%')} />
        </Row>
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          {(['good', 'info', 'neutral', 'warn', 'bad'] as const).map((t) => (
            <PressScale key={t} onPress={() => setTone(t)}><View style={{ opacity: toneKey === t ? 1 : 0.45 }}><Pill label={label || 'تقدير'} tone={t} /></View></PressScale>
          ))}
        </Row>
        <Row gap={8}>
          <Button title="حذف" variant="danger" small onPress={onDelete} />
          <Button title="حفظ" icon="check" style={{ flex: 1 }} disabled={!label.trim()} onPress={() => onSave({ label: label.trim(), min, tone: toneKey })} />
        </Row>
      </View>
    </Sheet>
  );
}
