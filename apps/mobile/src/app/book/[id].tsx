import {
  arDigits, cloneColumns, formatScore, MARK_LABEL, parseNumber, type GradeColumn, type SheetRow,
} from '@rasd/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { Icon } from '@/components/icon';
import { Pill } from '@/components/kit';
import { PressScale, tap } from '@/components/motion';
import { Sheet, SheetItem } from '@/components/sheet';
import { Button, Card, Chip, Empty, Field, Header, IconButton, Row, Screen, Segmented, T } from '@/components/ui';
import { get, insert, remove, update, useQuery } from '@/data/db';
import { setGrade } from '@/data/grades';
import { allSections, sectionLabel, sheetOf } from '@/data/queries';
import { Alert } from '@/lib/dialog';
import { exportBookXlsx, printBook } from '@/lib/export';
import { fonts, useTheme } from '@/lib/theme';
import { toast } from '@/lib/toast';

type Mode = 'entry' | 'table';

export default function BookScreen() {
  const { id, focus } = useLocalSearchParams<{ id: string; focus?: string }>();
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

  if (!book) return <Screen><Header /><Empty title="السجل غير موجود" /></Screen>;

  const run = (fn: () => Promise<void>) => fn().catch((e) => toast(e instanceof Error ? e.message : 'تعذّر', { tone: 'bad', icon: 'info' }));
  const del = () => Alert.alert('حذف السجل؟', `سيُحذف «${book.title}» وكل درجاته.`, [
    { text: 'إلغاء', style: 'cancel' },
    { text: 'حذف', style: 'destructive', onPress: () => { remove('gradebooks', book.id); toast('حُذف السجل', { icon: 'trash' }); router.back(); } },
  ]);

  return (
    <Screen padded={mode === 'entry'} style={mode === 'table' ? { paddingHorizontal: 0 } : undefined}>
      <View style={{ paddingHorizontal: mode === 'table' ? 20 : 0, gap: 14 }}>
        <Header title={book.title} subtitle={sectionLabel(book.section_id)}
          right={(
            <>
              <IconButton name="mic" label="إدخال صوتي" filled onPress={() => router.push(`/voice?book=${book.id}${activeCol ? `&column=${activeCol.id}` : ''}`)} />
              <IconButton name="more" label="خيارات" onPress={() => setMenu(true)} />
            </>
          )} />
        <Row gap={8}>
          <Button title="الأعمدة والمعادلات" icon="formula" small variant="secondary" style={{ flex: 1 }} onPress={() => router.push(`/book/columns?id=${book.id}`)} />
          <Button title="الإحصاء" icon="pie" small variant="secondary" style={{ flex: 1 }} onPress={() => router.push(`/book/stats?id=${book.id}`)} />
        </Row>
        <Segmented options={[{ key: 'entry', label: 'إدخال سريع' }, { key: 'table', label: 'الجدول' }]} value={mode} onChange={setMode} />
      </View>

      {rows.length === 0 ? (
        <Card><Empty icon="users" title="لا طلاب في الشعبة" body="أضف الطلاب أولاً ثم ارجع لإدخال الدرجات." action="إضافة طلاب" onAction={() => router.push(`/section/import?id=${book.section_id}`)} /></Card>
      ) : mode === 'entry' ? (
        inputs.length ? (
          <EntryList bookId={book.id} columns={inputs} active={activeCol!} onColumn={(c) => setCol(c)} rows={rows} decider={book.columns.find((c) => c.id === book.result.column_id) ?? null} focusStudent={focusStudent} />
        ) : <Card><Empty icon="formula" title="لا أعمدة إدخال" body="أضف عموداً من «الأعمدة والمعادلات»." /></Card>
      ) : (
        <Table rows={rows} columns={book.columns.filter((c) => !c.hidden)} deciderId={book.result.column_id} highlight={focus ?? null}
          onCell={(studentId, columnId) => { setCol(columnId); setFocusStudent(studentId); setMode('entry'); }} />
      )}

      <Sheet visible={menu} onClose={() => setMenu(false)}>
        <SheetItem icon="excel" label="تصدير Excel" onPress={() => { setMenu(false); run(() => exportBookXlsx(book.id)); }} />
        <SheetItem icon="upload" label="استيراد درجات من Excel" onPress={() => { setMenu(false); router.push(`/book/import?id=${book.id}`); }} />
        <SheetItem icon="print" label="طباعة" onPress={() => { setMenu(false); run(() => printBook(book.id, 'print')); }} />
        <SheetItem icon="share" label="مشاركة PDF" onPress={() => { setMenu(false); run(() => printBook(book.id, 'pdf')); }} />
        <SheetItem icon="copy" label="نسخ السجل لشعبة أخرى" onPress={() => { setMenu(false); setCopy(true); }} />
        <SheetItem icon="edit" label="إعادة التسمية" onPress={() => { setMenu(false); setRename(true); }} />
        <SheetItem icon="pin" label={book.pinned ? 'إلغاء التثبيت' : 'تثبيت في الأعلى'} onPress={() => { setMenu(false); update('gradebooks', book.id, { pinned: !book.pinned }); }} />
        <SheetItem icon="lock" label={book.archived ? 'إرجاع من الأرشيف' : 'أرشفة'} onPress={() => { setMenu(false); update('gradebooks', book.id, { archived: !book.archived }); toast(book.archived ? 'أُرجع السجل' : 'أُرشف السجل'); }} />
        <SheetItem icon="trash" label="حذف السجل" danger onPress={() => { setMenu(false); del(); }} />
      </Sheet>
      <RenameSheet visible={rename} onClose={() => setRename(false)} id={book.id} />
      <CopySheet visible={copy} onClose={() => setCopy(false)} id={book.id} />
    </Screen>
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
        {columns.map((col) => <Chip key={col.id} label={col.name} active={col.id === active.id} onPress={() => onColumn(col.id)} />)}
      </ScrollView>
      <Row style={{ justifyContent: 'space-between' }}>
        <T size={13} weight="bold" style={{ flexShrink: 1 }} lines={1}>{active.name} <T dim size={13}>· من {arDigits(active.max)} · أُدخل {arDigits(filled)} من {arDigits(rows.length)}</T></T>
        <T dim size={12}>«غ» = غائب</T>
      </Row>
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
  const v = row.values[col.id];
  const mark = row.marks[col.id] ?? null;
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
    const n = parseNumber(s);
    if (n == null || n < 0) { setBad(true); toast('اكتب رقماً صحيحاً', { tone: 'bad', icon: 'info' }); return false; }
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
        onBlur={() => commit(text)}
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
                  {col.kind === 'formula' ? <Icon name="formula" size={11} color={c.accent} /> : null}
                  <T size={11} weight="bold" color={c.softInk} lines={2} center>{col.name}</T>
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
                    <T size={15} weight={col.kind === 'formula' ? 'bold' : 'medium'} color={fail ? tone.bad.ink : m === 'absent' && !v ? tone.warn.ink : col.kind === 'formula' ? c.accent : c.ink}>
                      {m === 'absent' && !v ? 'غ' : m === 'exempt' ? 'مع' : formatScore(v)}
                    </T>
                    {isDecider && r.verdict ? <T size={9} color={tone[r.verdict.tone].ink} style={{ marginTop: -4 }}>{r.verdict.label}</T> : null}
                  </>
                );
                return col.kind === 'input' ? (
                  <PressScale key={col.id} onPress={() => onCell(r.student.id, col.id)} scaleTo={0.92} style={{ width: COL_W, alignItems: 'center', justifyContent: 'center' }}>{content}</PressScale>
                ) : (
                  <View key={col.id} style={{ width: COL_W, alignItems: 'center', justifyContent: 'center', backgroundColor: isDecider ? (fail ? tone.bad.bg : 'transparent') : 'transparent' }}>{content}</View>
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
