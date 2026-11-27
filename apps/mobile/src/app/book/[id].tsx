import {
  arDigits, cloneColumns, formatScore, MARK_LABEL, parseNumber, type GradeColumn, type SheetRow, countGrades } from '@nahj/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Icon } from '@/components/icon';
import { Pill } from '@/components/kit';
import { PressScale, tap } from '@/components/motion';
import { Sheet, SheetItem } from '@/components/sheet';
import { Button, Card, Chip, Empty, Field, Header, IconButton, Row, Screen, Segmented, T } from '@/components/ui';
import { all, get, insert, remove, update, useQuery } from '@/data/db';
import { setGrade, setOverride } from '@/data/grades';
import { allSections, linkLabel, sectionLabel, sheetOf } from '@/data/queries';
import { useWide } from '@/lib/hooks';
import { Alert } from '@/lib/dialog';
import { exportBookXlsx } from '@/lib/export';
import { fonts, useTheme } from '@/lib/theme';
import { toast } from '@/lib/toast';

type Mode = 'entry' | 'table';

export default function BookScreen() {
  const { id, focus } = useLocalSearchParams<{ id: string; focus?: string }>();
  const { tone } = useTheme();
  const book = useQuery(() => get('gradebooks', id), [id]);
  const rows = useQuery(() => (book ? sheetOf(book) : []), [book]);
  const inputs = book?.columns.filter((c) => c.kind === 'input') ?? [];
  const [mode, setMode] = useState<Mode>(focus ? 'table' : 'entry');
  // العمود يُختار مرة واحدة عند الفتح (أول عمود ناقص)، ولا يقفز أثناء الكتابة
  const [col, setCol] = useState<string | null>(() => {
    const b = get('gradebooks', id);
    if (!b) return null;
    const ins = b.columns.filter((c) => c.kind === 'input');
    return (firstIncomplete(ins, sheetOf(b)) ?? ins[0])?.id ?? null;
  });
  const [focusStudent, setFocusStudent] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [rename, setRename] = useState(false);
  const [copy, setCopy] = useState(false);
  // السجل وصل متأخراً (مزامنة) أو حُذف العمود المختار: نختار أول عمود ناقص مرة واحدة
  useEffect(() => {
    if (!book || inputs.some((c) => c.id === col)) return;
    setCol((firstIncomplete(inputs, rows) ?? inputs[0])?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book, col]);
  const activeCol = inputs.find((c) => c.id === col) ?? inputs[0];

  const wide = useWide();
  const [review, setReview] = useState(false);
  if (!book) return <Screen><Header /><Empty title="السجل غير موجود" /></Screen>;

  const run = (fn: () => Promise<void>) => fn().catch((e) => toast(e instanceof Error ? e.message : 'تعذّر', { tone: 'bad', icon: 'info' }));
  // السجلات التي تأخذ منه درجاتها (السعي…) تُذكر بأسمائها قبل الحذف
  const dependents = all('gradebooks').filter((b) => b.id !== book.id && b.columns.some((x) => x.kind === 'link' && x.source?.book_id === book.id));
  const del = () => Alert.alert('حذف السجل؟', `سيُحذف «${book.title}» وكل درجاته.${dependents.length ? `\n\nتحذير: ${dependents.map((d) => `«${d.title}»`).join('، ')} ${dependents.length > 1 ? 'تحسب' : 'يحسب'} منه، وستصبح ${dependents.length > 1 ? 'نتائجها' : 'نتيجته'} فارغة. للإخفاء بدل الحذف استعمل «أرشفة».` : ''}`, [
    { text: 'إلغاء', style: 'cancel' },
    { text: 'حذف', style: 'destructive', onPress: () => { remove('gradebooks', book.id); toast('حُذف السجل', { icon: 'trash' }); if (router.canGoBack()) router.back(); else router.replace('/grades'); } },
  ]);
  const sources = [...new Map(book.columns.filter((x) => x.kind === 'link' && x.source).map((x) => [x.source!.book_id, get('gradebooks', x.source!.book_id)])).values()].filter(Boolean);
  const critical = rows.reduce((n, r) => n + Object.keys(r.critical).length, 0);
  const visible = book.columns.filter((x) => !x.hidden);
  const showGrid = wide || mode === 'table' || !inputs.length;

  return (
    <Screen wide={wide} padded={!showGrid || wide} style={showGrid && !wide ? { paddingHorizontal: 0 } : undefined}>
      <View style={{ paddingHorizontal: showGrid && !wide ? 20 : 0, gap: 12 }}>
        <Header title={book.title} subtitle={sectionLabel(book.section_id)}
          right={(
            <>
              {inputs.length ? <IconButton name="mic" label="إدخال صوتي" filled onPress={() => router.push(`/voice?book=${book.id}${activeCol ? `&column=${activeCol.id}` : ''}`)} /> : null}
              <IconButton name="more-v" label="خيارات" onPress={() => setMenu(true)} />
            </>
          )} />
        {sources.length ? (
          <Row gap={6} style={{ flexWrap: 'wrap' }}>
            <T dim size={13}>يُحسب من:</T>
            {sources.map((b) => <Chip key={b!.id} small label={b!.title} onPress={() => router.push(`/book/${b!.id}`)} />)}
          </Row>
        ) : null}
        {critical ? (
          <PressScale onPress={() => setReview(true)} scaleTo={0.98}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, backgroundColor: tone.warn.bg }}>
            <Icon name="info" size={20} color={tone.warn.ink} />
            <View style={{ flex: 1 }}>
              <T weight="bold" size={14} color={tone.warn.ink}>{countGrades(critical)} حرجة قريبة من النجاح</T>
              <T size={12} color={tone.warn.ink}>راجعها وقرر رفعها إلى درجة النجاح — لا يتغير شيء بدون موافقتك.</T>
            </View>
            <T weight="bold" size={13} color={tone.warn.ink}>مراجعة</T>
          </PressScale>
        ) : rows.some((r) => Object.keys(r.overridden).length) ? (
          <Chip small label="الدرجات المرفوعة" onPress={() => setReview(true)} />
        ) : null}
        <Row gap={8}>
          <Button title={wide ? 'الحقول والمعادلات' : 'الحقول'} icon="formula" small variant="secondary" style={wide ? undefined : { flex: 1 }} onPress={() => router.push(`/book/columns?id=${book.id}`)} />
          <Button title="الإحصاء" icon="pie" small variant="secondary" style={wide ? undefined : { flex: 1 }} onPress={() => router.push(`/book/stats?id=${book.id}`)} />
        </Row>
        {!wide && inputs.length ? <Segmented options={[{ key: 'entry', label: 'إدخال سريع' }, { key: 'table', label: 'الجدول' }]} value={mode} onChange={setMode} /> : null}
      </View>

      {rows.length === 0 ? (
        <Card><Empty icon="users" title="لا طلاب في الشعبة" body="أضف الطلاب أولاً ثم ارجع لإدخال الدرجات." action="إضافة طلاب" onAction={() => router.push(`/section/import?id=${book.section_id}`)} /></Card>
      ) : wide ? (
        <Grid bookId={book.id} rows={rows} columns={visible} deciderId={book.result.column_id} onReview={() => setReview(true)} />
      ) : mode === 'entry' && inputs.length ? (
        <EntryList bookId={book.id} columns={inputs} active={activeCol!} onColumn={(c) => setCol(c)} rows={rows} decider={book.columns.find((c) => c.id === book.result.column_id) ?? null} focusStudent={focusStudent} />
      ) : (
        <Table rows={rows} columns={visible} deciderId={book.result.column_id} highlight={focus ?? null}
          onCell={(studentId, columnId) => {
            const colDef = book.columns.find((x) => x.id === columnId);
            if (colDef?.kind !== 'input') { setReview(true); return; }
            setCol(columnId); setFocusStudent(studentId); setMode('entry');
          }} />
      )}

      <Sheet visible={menu} onClose={() => setMenu(false)}>
        <SheetItem icon="excel" label="تصدير Excel" onPress={() => { setMenu(false); run(() => exportBookXlsx(book.id)); }} />
        {inputs.length ? <SheetItem icon="upload" label="استيراد درجات من Excel" onPress={() => { setMenu(false); router.push(`/book/import?id=${book.id}`); }} /> : null}
        <SheetItem icon="print" label="طباعة / PDF" onPress={() => { setMenu(false); router.push(`/print?kind=book&id=${book.id}`); }} />
        {!book.group_id ? <SheetItem icon="copy" label="نسخ السجل لشعبة أخرى" onPress={() => { setMenu(false); setCopy(true); }} /> : null}
        <SheetItem icon="edit" label="إعادة التسمية" onPress={() => { setMenu(false); setRename(true); }} />
        <SheetItem icon="pin" label={book.pinned ? 'إلغاء التثبيت' : 'تثبيت في الأعلى'} onPress={() => { setMenu(false); update('gradebooks', book.id, { pinned: !book.pinned }); }} />
        <SheetItem icon="lock" label={book.archived ? 'إرجاع من الأرشيف' : 'أرشفة'} onPress={() => { setMenu(false); update('gradebooks', book.id, { archived: !book.archived }); toast(book.archived ? 'أُرجع السجل' : 'أُرشف السجل'); }} />
        <SheetItem icon="trash" label="حذف السجل" danger onPress={() => { setMenu(false); del(); }} />
      </Sheet>
      <RenameSheet visible={rename} onClose={() => setRename(false)} id={book.id} />
      <CopySheet visible={copy} onClose={() => setCopy(false)} id={book.id} />
      {review ? <CriticalSheet bookId={book.id} rows={rows} columns={book.columns} onClose={() => setReview(false)} /> : null}
    </Screen>
  );
}

/** مراجعة الدرجات الحرجة: يختار المدرس من يرفعها إلى درجة النجاح، ويمكنه التراجع */
function CriticalSheet({ bookId, rows, columns, onClose }: { bookId: string; rows: SheetRow[]; columns: GradeColumn[]; onClose: () => void }) {
  const { c, tone } = useTheme();
  const boosted = columns.filter((x) => x.kind !== 'input');
  const pending = rows.flatMap((r) => boosted.filter((x) => r.critical[x.id]).map((x) => ({ r, x, key: `${r.student.id}|${x.id}` })));
  const done = rows.flatMap((r) => boosted.filter((x) => r.overridden[x.id]).map((x) => ({ r, x, key: `${r.student.id}|${x.id}` })));
  const [picked, setPicked] = useState<string[]>(() => pending.map((p) => p.key));
  const apply = () => {
    const items = pending.filter((p) => picked.includes(p.key));
    if (!items.length) return;
    Alert.alert('رفع الدرجات المحددة؟', `ستُرفع ${arDigits(items.length)} درجة إلى درجة النجاح، وتتغير بها النتائج والسعي المحسوب منها. يمكنك التراجع لاحقاً من هنا.`, [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'رفع', onPress: () => { for (const p of items) setOverride(bookId, p.r.student.id, p.x.id, p.x.boost!.to); toast('رُفعت الدرجات', { icon: 'check' }); onClose(); } },
    ]);
  };
  return (
    <Sheet visible onClose={onClose}>
      <ScrollView style={{ maxHeight: 620 }} contentContainerStyle={{ gap: 12, paddingBottom: 8 }}>
        <T display size={22}>الدرجات الحرجة</T>
        {pending.length ? (
          <>
            <T dim size={13}>درجات قريبة من النجاح. اختر من تريد رفعها — تظهر بعدها بعلامة ذهبية، وتبقى الدرجة الأصلية محفوظة.</T>
            <View style={{ borderRadius: 18, borderWidth: 1, borderColor: c.line, overflow: 'hidden' }}>
              {pending.map((p, i) => {
                const on = picked.includes(p.key);
                return (
                  <PressScale key={p.key} onPress={() => setPicked((x) => (on ? x.filter((k) => k !== p.key) : [...x, p.key]))} scaleTo={0.98}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderTopWidth: i ? 1 : 0, borderTopColor: c.line, backgroundColor: on ? c.soft : c.card }}>
                    <View style={{ width: 22, height: 22, borderRadius: 7, borderWidth: on ? 0 : 1.5, borderColor: c.ink3, backgroundColor: on ? c.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                      {on ? <Icon name="check" size={14} color={c.accentInk} strokeWidth={2.6} /> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <T weight="bold" size={14} lines={1}>{p.r.student.name}</T>
                      <T dim size={12}>{arDigits(p.x.name)}</T>
                    </View>
                    <T weight="bold" size={16} color={tone.warn.ink}>{formatScore(p.r.values[p.x.id])}</T>
                    <Icon name="back" size={14} color={c.ink3} />
                    <T weight="bold" size={16} color={tone.good.ink}>{formatScore(p.x.boost!.to)}</T>
                  </PressScale>
                );
              })}
            </View>
            <Button title={`رفع المحدد (${arDigits(picked.length)})`} icon="check" disabled={!picked.length} onPress={apply} />
          </>
        ) : <T dim size={13}>لا درجات حرجة تنتظر قرارك.</T>}
        {done.length ? (
          <>
            <T weight="bold" size={15} style={{ marginTop: 6 }}>درجات رُفعت</T>
            <View style={{ borderRadius: 18, borderWidth: 1, borderColor: c.line, overflow: 'hidden' }}>
              {done.map((p, i) => (
                <View key={p.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
                  <View style={{ flex: 1 }}>
                    <T weight="bold" size={14} lines={1}>{p.r.student.name}</T>
                    <T dim size={12}>{arDigits(p.x.name)}: {formatScore(p.r.raw[p.x.id])} ← {formatScore(p.r.values[p.x.id])}</T>
                  </View>
                  <Button title="تراجع" small variant="secondary" onPress={() => setOverride(bookId, p.r.student.id, p.x.id, null)} />
                </View>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </Sheet>
  );
}

/** جدول الحاسوب: كل الحقول في جدول واحد قابل للكتابة مباشرة (Enter للأسفل، Tab للتالي) */
function Grid({ bookId, rows, columns, deciderId, onReview }: {
  bookId: string; rows: SheetRow[]; columns: GradeColumn[]; deciderId: string | null; onReview: () => void;
}) {
  const { c, tone } = useTheme();
  const refs = useRef<Record<string, TextInput | null>>({});
  const inputs = columns.filter((x) => x.kind === 'input');
  const NAME_W = 260;
  const COL_W = 108;
  const H = 48;
  const move = (ri: number, colId: string, d: number) => refs.current[`${ri + d}:${colId}`]?.focus();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ flexGrow: 1 }}>
      <View style={{ flexGrow: 1, borderRadius: 18, borderWidth: 1, borderColor: c.line, backgroundColor: c.card, overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', backgroundColor: c.soft, borderBottomWidth: 1, borderBottomColor: c.line }}>
          <View style={{ width: 44, justifyContent: 'center', alignItems: 'center' }}><T size={12} weight="bold" color={c.softInk}>ت</T></View>
          <View style={{ flexGrow: 1, flexBasis: NAME_W, minWidth: NAME_W, justifyContent: 'center', paddingHorizontal: 10, paddingVertical: 10 }}><T weight="bold" size={13} color={c.softInk}>اسم الطالب</T></View>
          {columns.map((x) => (
            <View key={x.id} style={{ width: COL_W, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 4, borderStartWidth: 1, borderStartColor: c.line, backgroundColor: x.kind === 'input' ? 'transparent' : c.accent + '14' }}>
              <Row gap={4}>
                {x.kind !== 'input' ? <Icon name={x.kind === 'link' ? 'link' : 'formula'} size={11} color={c.accent} /> : null}
                <T size={12} weight="bold" color={c.softInk} lines={2} center>{arDigits(x.name)}</T>
              </Row>
              <T size={11} dim>من {arDigits(x.max)}</T>
            </View>
          ))}
        </View>
        {rows.map((r, ri) => (
          <View key={r.student.id} style={{ flexDirection: 'row', height: H, borderTopWidth: ri ? 1 : 0, borderTopColor: c.line, backgroundColor: ri % 2 ? c.bg : c.card }}>
            <View style={{ width: 44, justifyContent: 'center', alignItems: 'center' }}><T dim size={12} weight="bold">{arDigits(ri + 1)}</T></View>
            <View style={{ flexGrow: 1, flexBasis: NAME_W, minWidth: NAME_W, justifyContent: 'center', paddingHorizontal: 10 }}><T size={14} weight="medium" lines={1}>{r.student.name}</T></View>
            {columns.map((x) => {
              const v = r.values[x.id];
              const m = r.marks[x.id];
              if (x.kind === 'input') {
                const ci = inputs.findIndex((y) => y.id === x.id);
                return (
                  <View key={x.id} style={{ width: COL_W, borderStartWidth: 1, borderStartColor: c.line, padding: 5 }}>
                    <GridCell bookId={bookId} studentId={r.student.id} col={x} value={v} mark={m ?? null}
                      inputRef={(el) => { refs.current[`${ri}:${x.id}`] = el; }}
                      onDown={() => move(ri, x.id, 1)} onUp={() => move(ri, x.id, -1)}
                      onNextCol={() => { const nx = inputs[ci + 1]; if (nx) refs.current[`${ri}:${nx.id}`]?.focus(); else refs.current[`${ri + 1}:${inputs[0].id}`]?.focus(); }} />
                  </View>
                );
              }
              const crit = r.critical[x.id];
              const fail = x.id === deciderId && r.verdict && !r.verdict.pass;
              return (
                <Pressable key={x.id} onPress={crit || r.overridden[x.id] ? onReview : undefined}
                  style={{ width: COL_W, borderStartWidth: 1, borderStartColor: c.line, alignItems: 'center', justifyContent: 'center', backgroundColor: crit ? tone.warn.bg : fail ? tone.bad.bg : x.id === deciderId ? c.accent + '10' : 'transparent' }}>
                  <T size={16} weight={x.kind === 'link' ? 'medium' : 'bold'} color={crit ? tone.warn.ink : fail ? tone.bad.ink : x.kind === 'link' ? c.ink : c.accent}>{formatScore(v)}</T>
                  {r.overridden[x.id] ? <View style={{ position: 'absolute', top: 6, left: 8, width: 7, height: 7, backgroundColor: c.gold }} /> : null}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function GridCell({ bookId, studentId, col, value, mark, inputRef, onDown, onUp, onNextCol }: {
  bookId: string; studentId: string; col: GradeColumn; value: number | null; mark: string | null;
  inputRef: (el: TextInput | null) => void; onDown: () => void; onUp: () => void; onNextCol: () => void;
}) {
  const { c, tone } = useTheme();
  // الغائب يُحسب صفراً في المعادلات، لكنه يُعرض «غ» لا «0»
  const shown = mark === 'absent' && (value == null || value === 0) ? 'غ' : mark === 'exempt' ? 'م' : mark === 'cheat' ? 'غش' : value == null ? '' : arDigits(value);
  const [text, setText] = useState(shown);
  const [bad, setBad] = useState(false);
  useEffect(() => { setText(shown); }, [shown]);
  const commit = () => {
    const s = text.trim();
    if (s === shown) return true;
    if (!s) { setGrade(bookId, studentId, col.id, null, null); setBad(false); return true; }
    if (s === 'غ' || s === 'غائب') { setGrade(bookId, studentId, col.id, null, 'absent'); setBad(false); return true; }
    // «م» معفى (لا يدخل الحساب)، «غش» يُحسب صفراً
    if (s === 'م' || s === 'معفى' || s === 'معفي') { setGrade(bookId, studentId, col.id, null, 'exempt'); setBad(false); return true; }
    if (s === 'غش') { setGrade(bookId, studentId, col.id, 0, 'cheat'); setBad(false); return true; }
    const n = parseNumber(s);
    if (n == null || n < 0 || n > col.max) { setBad(true); toast(n != null && n > col.max ? `الدرجة أكبر من العظمى (${arDigits(col.max)})` : 'اكتب رقماً، أو «غ» للغائب، «م» للمعفى، «غش»', { tone: 'bad', icon: 'info' }); return false; }
    setBad(false);
    setGrade(bookId, studentId, col.id, n, null);
    return true;
  };
  return (
    <TextInput ref={inputRef} value={text} onChangeText={(t) => { setText(t); setBad(false); }}
      // قيمة غير صالحة عند مغادرة الخانة: تعود الخانة للدرجة المحفوظة (لا تبقى قيمة ظاهرة غير محفوظة)
      onBlur={() => { if (!commit()) { setText(shown); setBad(false); } }}
      onSubmitEditing={() => { if (commit()) onDown(); }} blurOnSubmit={false} selectTextOnFocus keyboardType="decimal-pad"
      onKeyPress={Platform.OS === 'web' ? (e) => {
        const k = (e.nativeEvent as { key?: string }).key;
        if (k === 'ArrowDown') { if (commit()) onDown(); } else if (k === 'ArrowUp') { if (commit()) onUp(); }
      } : undefined}
      accessibilityLabel={`${col.name}`}
      style={{
        flex: 1, borderRadius: 10, borderWidth: bad ? 2 : 1, borderColor: bad ? tone.bad.ink : 'transparent',
        backgroundColor: mark === 'absent' ? tone.warn.bg : value != null ? c.soft : c.field, textAlign: 'center',
        fontFamily: fonts.bold, fontSize: 16, color: mark === 'absent' ? tone.warn.ink : c.ink, paddingVertical: 0,
      }} />
  );
}

function firstIncomplete(inputs: GradeColumn[], rows: SheetRow[]) {
  return inputs.find((c) => rows.some((r) => r.values[c.id] == null && !r.marks[c.id]));
}

/** إدخال سريع: عمود واحد، خانة لكل طالب، «التالي» ينقل للطالب التالي */
function EntryList({ bookId, columns, active, onColumn, rows, decider, focusStudent }: {
  bookId: string; columns: GradeColumn[]; active: GradeColumn; onColumn: (id: string) => void; rows: SheetRow[]; decider: GradeColumn | null; focusStudent: string | null;
}) {
  const { c } = useTheme();
  const refs = useRef<Record<string, TextInput | null>>({});
  const filled = rows.filter((r) => r.values[active.id] != null || r.marks[active.id]).length;
  useEffect(() => {
    if (focusStudent) setTimeout(() => refs.current[focusStudent]?.focus(), 250);
  }, [focusStudent, active.id]);
  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {columns.map((col) => <Chip key={col.id} label={arDigits(col.name)} active={col.id === active.id} onPress={() => onColumn(col.id)} />)}
      </ScrollView>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', rowGap: 2, columnGap: 10 }}>
        <T size={13} weight="bold" style={{ flexShrink: 1 }} lines={1}>{active.name} <T dim size={13}>· من {arDigits(active.max)} · أُدخل {arDigits(filled)} من {arDigits(rows.length)}</T></T>
        <T dim size={12} lines={1}>«غ» غائب · «م» معفى · «غش»</T>
      </View>
      <Card style={{ paddingVertical: 4 }}>
        {rows.map((r, i) => (
          <EntryRow key={`${r.student.id}-${active.id}`} row={r} index={i} col={active} bookId={bookId} decider={decider}
            inputRef={(el) => { refs.current[r.student.id] = el; }}
            onNext={() => { const nx = rows[i + 1]; if (nx) refs.current[nx.student.id]?.focus(); }}
            divider={i > 0} lineColor={c.line} />
        ))}
      </Card>
    </>
  );
}

function EntryRow({ row, index, col, bookId, decider, inputRef, onNext, divider, lineColor }: {
  row: SheetRow; index: number; col: GradeColumn; bookId: string; decider: GradeColumn | null;
  inputRef: (el: TextInput | null) => void; onNext: () => void; divider: boolean; lineColor: string;
}) {
  const { c, tone } = useTheme();
  const mark = row.marks[col.id] ?? null;
  // الغائب يُعرض «غائب» لا «0»
  const v = (mark === 'absent' || mark === 'cheat') && !row.values[col.id] ? null : row.values[col.id];
  const [text, setText] = useState(v == null ? '' : arDigits(v));
  const [bad, setBad] = useState(false);
  useEffect(() => { setText(v == null ? '' : arDigits(v)); }, [v]);

  const commit = (t: string) => {
    const s = t.trim();
    if (!s) {
      if (v != null || mark) setGrade(bookId, row.student.id, col.id, null, null);
      setBad(false);
      return true;
    }
    if (s === 'غ' || s === 'غائب') { setGrade(bookId, row.student.id, col.id, null, 'absent'); setBad(false); return true; }
    if (s === 'م' || s === 'معفى' || s === 'معفي') { setGrade(bookId, row.student.id, col.id, null, 'exempt'); setBad(false); return true; }
    if (s === 'غش') { setGrade(bookId, row.student.id, col.id, 0, 'cheat'); setBad(false); return true; }
    const n = parseNumber(s);
    if (n == null || n < 0) { setBad(true); toast('اكتب رقماً، أو «غ» للغائب، «م» للمعفى، «غش»', { tone: 'bad', icon: 'info' }); return false; }
    if (n > col.max) { setBad(true); tap('medium'); toast(`الدرجة أكبر من العظمى (${arDigits(col.max)})`, { tone: 'bad', icon: 'info' }); return false; }
    setBad(false);
    if (n !== v || mark) setGrade(bookId, row.student.id, col.id, n, null);
    return true;
  };
  const toggleAbsent = () => {
    tap('select');
    if (mark === 'absent') setGrade(bookId, row.student.id, col.id, null, null);
    else setGrade(bookId, row.student.id, col.id, null, 'absent');
  };
  const dv = decider ? row.values[decider.id] : null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: divider ? 1 : 0, borderTopColor: lineColor }}>
      <T dim size={12} weight="bold" style={{ width: 24, textAlign: 'center' }}>{arDigits(index + 1)}</T>
      <View style={{ flex: 1 }}>
        <T size={15} weight="medium" lines={1}>{row.student.name}</T>
        {decider && decider.id !== col.id && dv != null ? (
          <T size={11} color={row.verdict && !row.verdict.pass ? tone.bad.ink : c.ink3}>{decider.name}: {formatScore(dv)}</T>
        ) : null}
      </View>
      <Pressable onPress={toggleAbsent} accessibilityLabel={`غائب ${row.student.name}`} hitSlop={6}
        style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: mark === 'absent' ? tone.warn.bg : 'transparent', borderWidth: mark === 'absent' ? 0 : 1, borderColor: c.line }}>
        <T size={13} weight="bold" color={mark === 'absent' ? tone.warn.ink : c.ink3} style={{ lineHeight: 20 }}>غ</T>
      </Pressable>
      {mark && mark !== 'absent' ? <Pill small label={MARK_LABEL[mark]} tone="info" /> : null}
      <TextInput
        ref={inputRef}
        value={mark === 'absent' && !text ? '' : text}
        onChangeText={(t) => { setText(t); setBad(false); }}
        onBlur={() => { if (!commit(text)) { setText(v == null ? '' : arDigits(v)); setBad(false); } }}
        onSubmitEditing={() => { if (commit(text)) onNext(); }}
        blurOnSubmit={false}
        returnKeyType="next"
        keyboardType="decimal-pad"
        selectTextOnFocus
        placeholder={mark === 'absent' ? 'غائب' : '—'}
        placeholderTextColor={mark === 'absent' ? tone.warn.ink : c.ink3}
        accessibilityLabel={`درجة ${row.student.name}`}
        style={{
          width: 72, height: 44, borderRadius: 14, borderWidth: bad ? 2 : 1, borderColor: bad ? tone.bad.ink : c.line,
          backgroundColor: v != null ? c.soft : c.field, textAlign: 'center', fontFamily: fonts.bold, fontSize: 17, color: c.ink, paddingVertical: 0,
        }}
      />
    </View>
  );
}

/** الجدول الكامل: الأسماء ثابتة يميناً والأعمدة تتمرر أفقياً */
function Table({ rows, columns, deciderId, highlight, onCell }: {
  rows: SheetRow[]; columns: GradeColumn[]; deciderId: string | null; highlight: string | null; onCell: (studentId: string, columnId: string) => void;
}) {
  const { c, tone } = useTheme();
  const H = 46;
  const NAME_W = 150;
  const COL_W = 78;
  return (
    <View style={{ flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.line, backgroundColor: c.card }}>
      <View style={{ width: NAME_W, borderLeftWidth: 1, borderLeftColor: c.line }}>
        <View style={{ height: H + 8, justifyContent: 'center', paddingHorizontal: 12, backgroundColor: c.soft }}>
          <T weight="bold" size={13} color={c.softInk}>الطالب</T>
        </View>
        {rows.map((r, i) => (
          <View key={r.student.id} style={{ height: H, justifyContent: 'center', paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: c.line, backgroundColor: r.student.id === highlight ? c.soft : i % 2 ? c.bg : c.card }}>
            <T size={13} weight="medium" lines={1}>{arDigits(i + 1)}. {r.student.name}</T>
          </View>
        ))}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={{ flexDirection: 'row', height: H + 8, backgroundColor: c.soft }}>
            {columns.map((col) => (
              <View key={col.id} style={{ width: COL_W, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
                <Row gap={3}>
                  {col.kind !== 'input' ? <Icon name={col.kind === 'link' ? 'link' : 'formula'} size={11} color={c.accent} /> : null}
                  <T size={11} weight="bold" color={c.softInk} lines={2} center>{arDigits(col.name)}</T>
                </Row>
                <T size={10} dim>{arDigits(col.max)}</T>
              </View>
            ))}
          </View>
          {rows.map((r, i) => (
            <View key={r.student.id} style={{ flexDirection: 'row', height: H, borderTopWidth: 1, borderTopColor: c.line, backgroundColor: r.student.id === highlight ? c.soft : i % 2 ? c.bg : c.card }}>
              {columns.map((col) => {
                const v = r.values[col.id];
                const m = r.marks[col.id];
                const isDecider = col.id === deciderId;
                const fail = isDecider && r.verdict && !r.verdict.pass;
                const content = (
                  <>
                    <T size={15} weight={col.kind !== 'input' ? 'bold' : 'medium'} color={r.critical[col.id] ? tone.warn.ink : fail ? tone.bad.ink : m === 'absent' && !v ? tone.warn.ink : col.kind === 'formula' ? c.accent : c.ink}>
                      {m === 'absent' && !v ? 'غ' : m === 'exempt' ? 'مع' : formatScore(v)}
                    </T>
                    {r.overridden[col.id] ? <View style={{ position: 'absolute', top: 6, left: 6, width: 6, height: 6, backgroundColor: c.gold }} /> : null}
                  </>
                );
                const crit = r.critical[col.id];
                return (
                  <PressScale key={col.id} onPress={() => onCell(r.student.id, col.id)} scaleTo={0.92} disabled={col.kind !== 'input' && !crit && !r.overridden[col.id]}
                    style={{ width: COL_W, alignItems: 'center', justifyContent: 'center', backgroundColor: crit ? tone.warn.bg : isDecider && fail ? tone.bad.bg : 'transparent' }}>{content}</PressScale>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function RenameSheet({ visible, onClose, id }: { visible: boolean; onClose: () => void; id: string }) {
  const b = get('gradebooks', id);
  const [title, setTitle] = useState(b?.title ?? '');
  return (
    <Sheet visible={visible} onClose={onClose}>
      <T display size={22}>اسم السجل</T>
      <View style={{ gap: 10, marginTop: 8 }}>
        <Field value={title} onChangeText={setTitle} />
        <Button title="حفظ" icon="check" disabled={!title.trim()} onPress={() => { update('gradebooks', id, { title: title.trim() }); onClose(); }} />
      </View>
    </Sheet>
  );
}

/** ينسخ تصميم السجل (بلا درجات) إلى شعب أخرى */
function CopySheet({ visible, onClose, id }: { visible: boolean; onClose: () => void; id: string }) {
  const b = get('gradebooks', id);
  const [picked, setPicked] = useState<string[]>([]);
  const sections = allSections().filter((s) => s.id !== b?.section_id);
  return (
    <Sheet visible={visible} onClose={onClose}>
      <T display size={22}>نسخ السجل</T>
      <T dim size={13}>نفس الأعمدة والمعادلات، بلا درجات.</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 12 }}>
        {sections.length ? sections.map((s) => (
          <Chip key={s.id} label={sectionLabel(s.id, true)} active={picked.includes(s.id)} onPress={() => setPicked((p) => (p.includes(s.id) ? p.filter((x) => x !== s.id) : [...p, s.id]))} />
        )) : <T dim>لا شعب أخرى.</T>}
      </View>
      <Button title="نسخ" icon="copy" disabled={!picked.length || !b} onPress={() => {
        if (!b) return;
        for (const sid of picked) {
          const { columns, result } = cloneColumns(b.columns, b.result);
          insert('gradebooks', { section_id: sid, title: b.title, template: b.template, columns, result, year: b.year });
        }
        toast('نُسخ السجل', { icon: 'check' });
        setPicked([]);
        onClose();
      }} />
    </Sheet>
  );
}
