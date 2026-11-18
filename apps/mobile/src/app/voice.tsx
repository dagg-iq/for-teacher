import {
  arDigits, formatScore, isAmbiguous, isConfident, MARK_LABEL, numberToArabicWords, parseCommand,
  type GradeColumn, type GradeMark, type NameCandidate, type Student,
} from '@midad/shared';
import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import Animated, {
  cancelAnimation, Easing, FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/icon';
import { Pill, ToggleRow } from '@/components/kit';
import { PressScale, tap } from '@/components/motion';
import { Sheet } from '@/components/sheet';
import { Button, Card, Chip, Empty, Header, IconButton, Row, Screen, Segmented, T } from '@/components/ui';
import { get, setSettings, useQuery, useSettings } from '@/data/db';
import { getGrade, setGrade } from '@/data/grades';
import { allSections, gradebooksOf, sectionLabel, studentsOf } from '@/data/queries';
import { say, speechAvailable, useRecognizer } from '@/lib/speech';
import { fonts, useTheme } from '@/lib/theme';

type Mode = 'names' | 'ordered';

interface Pending {
  student: Student;
  value: number | null;
  mark: GradeMark | null;
  prev: { value: number | null; mark: GradeMark | null } | null;
}

interface Done {
  key: number;
  student: Student;
  value: number | null;
  mark: GradeMark | null;
  prev: { value: number | null; mark: GradeMark | null } | null;
}

type Notice = { tone: 'bad' | 'warn' | 'info'; text: string } | null;

export default function Voice() {
  const params = useLocalSearchParams<{ section?: string; book?: string; column?: string }>();
  const presetBook = params.book ? get('gradebooks', params.book) : undefined;
  const [sectionId, setSectionId] = useState<string | null>(presetBook?.section_id ?? params.section ?? null);
  const [bookId, setBookId] = useState<string | null>(presetBook?.id ?? null);
  const [columnId, setColumnId] = useState<string | null>(params.column ?? null);
  const [mode, setMode] = useState<Mode>('names');
  const [started, setStarted] = useState(false);

  const book = useQuery(() => (bookId ? get('gradebooks', bookId) : undefined), [bookId]);
  const column = book?.columns.find((c) => c.id === columnId && c.kind === 'input');

  if (!started || !book || !column || !sectionId) {
    return (
      <Setup sectionId={sectionId} bookId={bookId} columnId={columnId} mode={mode}
        onSection={(s) => { setSectionId(s); setBookId(null); setColumnId(null); }}
        onBook={(b) => { setBookId(b); const bk = get('gradebooks', b); const first = bk?.columns.find((c) => c.kind === 'input'); setColumnId(first?.id ?? null); }}
        onColumn={setColumnId} onMode={setMode}
        onStart={() => setStarted(true)} />
    );
  }
  return <Session bookId={book.id} sectionId={sectionId} column={column} mode={mode} onSetup={() => setStarted(false)} />;
}

// ------------------------------------------------------------------ الإعداد
function Setup({ sectionId, bookId, columnId, mode, onSection, onBook, onColumn, onMode, onStart }: {
  sectionId: string | null; bookId: string | null; columnId: string | null; mode: Mode;
  onSection: (s: string) => void; onBook: (b: string) => void; onColumn: (c: string) => void; onMode: (m: Mode) => void; onStart: () => void;
}) {
  const { c } = useTheme();
  const sections = useQuery(() => allSections());
  const books = useQuery(() => (sectionId ? gradebooksOf(sectionId).filter((b) => !b.archived) : []), [sectionId]);
  const book = books.find((b) => b.id === bookId);
  const inputs = book?.columns.filter((x) => x.kind === 'input') ?? [];
  const n = sectionId ? studentsOf(sectionId).length : 0;
  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="الإدخال الصوتي" subtitle="اختر أين تُكتب الدرجات ثم تكلّم" />
      {!sections.length ? (
        <Card><Empty icon="school" title="أضف صفوفك أولاً" action="إضافة صف" onAction={() => router.replace('/class/new')} /></Card>
      ) : (
        <>
          <Step n={1} title="الشعبة">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {sections.map((s) => <Chip key={s.id} label={sectionLabel(s.id, true)} active={s.id === sectionId} onPress={() => onSection(s.id)} />)}
            </View>
          </Step>
          {sectionId ? (
            <Step n={2} title="السجل">
              {books.length ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {books.map((b) => <Chip key={b.id} label={b.title} active={b.id === bookId} onPress={() => onBook(b.id)} />)}
                </View>
              ) : (
                <Button title="أنشئ سجلاً لهذه الشعبة" icon="plus" small variant="secondary" onPress={() => router.push(`/book/new?section=${sectionId}`)} />
              )}
            </Step>
          ) : null}
          {book ? (
            <Step n={3} title="الدرجة (العمود)">
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {inputs.map((x) => <Chip key={x.id} label={`${x.name} (${arDigits(x.max)})`} active={x.id === columnId} onPress={() => onColumn(x.id)} />)}
              </View>
            </Step>
          ) : null}
          {columnId ? (
            <Step n={4} title="طريقة القراءة">
              <Segmented options={[{ key: 'names', label: 'الاسم + الدرجة' }, { key: 'ordered', label: 'بالترتيب' }]} value={mode} onChange={onMode} />
              <T dim size={13}>
                {mode === 'names'
                  ? 'قل اسم الطالب ثم درجته بأي ترتيب: «أحمد علي خمسة وثمانين». يكفي الاسم الأول إن لم يتكرر.'
                  : 'يعرض لك الطلاب واحداً واحداً بترتيب القائمة، وتقول الدرجة فقط. «التالي» للتخطي، «غائب» للغياب.'}
              </T>
            </Step>
          ) : null}
          <Card tone="soft" style={{ gap: 6 }}>
            <T weight="bold" size={14} color={c.softInk}>أوامر تفهمها</T>
            <T size={13} color={c.softInk}>«نعم» تثبيت فوري · «لا» إلغاء · «تراجع» حذف آخر درجة · «غائب» · «التالي» · «السابق» · «توقف»</T>
          </Card>
          <Button title={!columnId ? 'ابدأ' : n ? `ابدأ (${arDigits(n)} طالب)` : 'لا طلاب في الشعبة'} icon="mic" disabled={!columnId || !n} onPress={onStart} />
        </>
      )}
    </Screen>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 10 }}>
      <Row gap={8}>
        <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' }}>
          <T size={12} weight="bold" color={c.bg} style={{ lineHeight: 18 }}>{arDigits(n)}</T>
        </View>
        <T weight="bold" size={16}>{title}</T>
      </Row>
      {children}
    </View>
  );
}

// ------------------------------------------------------------------ الجلسة
function Session({ bookId, sectionId, column, mode, onSetup }: { bookId: string; sectionId: string; column: GradeColumn; mode: Mode; onSetup: () => void }) {
  useKeepAwake();
  const { c, tone } = useTheme();
  const insets = useSafeAreaInsets();
  const prefs = useSettings().prefs;
  const students = useMemo(() => studentsOf(sectionId), [sectionId]);
  const book = useQuery(() => get('gradebooks', bookId), [bookId]);
  // قيم العمود الحالية (تتحدث مع كل كتابة)
  const values = useQuery(() => new Map(students.map((s) => [s.id, getGrade(bookId, s.id, column.id)])), [students, bookId, column.id]);
  const filled = students.filter((s) => { const g = values.get(s.id); return g && (g.value != null || g.mark); }).length;

  const [current, setCurrent] = useState<number>(() => {
    if (mode !== 'ordered') return -1;
    const i = students.findIndex((s) => { const g = getGrade(bookId, s.id, column.id); return !g || (g.value == null && !g.mark); });
    return i < 0 ? 0 : i;
  });
  const [pending, setPending] = useState<Pending | null>(null);
  const [choices, setChoices] = useState<{ list: NameCandidate[]; value: number | null; mark: GradeMark | null } | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [history, setHistory] = useState<Done[]>([]);
  const [heard, setHeard] = useState('');
  const [typed, setTyped] = useState('');
  const [settings, setSettingsOpen] = useState(false);
  const [kb, setKb] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keySeq = useRef(0);
  const scroller = useRef<ScrollView>(null);
  const progress = useSharedValue(0);

  const names = useMemo(() => students.map((s) => s.name), [students]);
  const rec = useRecognizer({ onFinal: (t) => handle(t), contextual: names });

  const warn = (n: Notice, speak?: string) => {
    setNotice(n);
    if (n?.tone === 'bad') tap('medium');
    if (speak && prefs.voiceSpeak) say(speak);
  };

  // ------------------------------------------------ التثبيت
  const commit = (p: Pending) => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    cancelAnimation(progress);
    setGrade(bookId, p.student.id, column.id, p.value, p.mark);
    setHistory((h) => [{ key: ++keySeq.current, student: p.student, value: p.value, mark: p.mark, prev: p.prev }, ...h].slice(0, 50));
    setPending(null);
    tap('success');
    if (prefs.voiceSpeak) {
      const first = p.student.name.split(' ')[0];
      say(p.mark ? `${first} ${MARK_LABEL[p.mark]}` : `${first} ${numberToArabicWords(p.value ?? 0)}`);
    }
    if (mode === 'ordered' && prefs.voiceAdvance) {
      const idx = students.findIndex((s) => s.id === p.student.id);
      setCurrent(nextEmpty(idx));
    } else {
      setCurrent(students.findIndex((s) => s.id === p.student.id));
    }
  };

  const nextEmpty = (from: number) => {
    for (let k = from + 1; k < students.length; k++) {
      const g = getGrade(bookId, students[k].id, column.id);
      if (!g || (g.value == null && !g.mark)) return k;
    }
    return Math.min(from + 1, students.length - 1);
  };

  const propose = (student: Student, value: number | null, mark: GradeMark | null) => {
    if (pending) commit(pending);
    setChoices(null);
    if (value != null && value > column.max) {
      warn({ tone: 'bad', text: `${arDigits(value)} أكبر من الدرجة العظمى (${arDigits(column.max)}) — لم تُكتب.` }, 'الدرجة أكبر من العظمى');
      return;
    }
    if (value != null && value < 0) return;
    const g = getGrade(bookId, student.id, column.id);
    const prev = g && (g.value != null || g.mark) ? { value: g.value, mark: g.mark ?? null } : null;
    const p: Pending = { student, value, mark, prev };
    setNotice(prev ? { tone: 'warn', text: `لديه درجة سابقة (${prev.mark ? MARK_LABEL[prev.mark] : formatScore(prev.value)}) — ستُستبدل.` } : null);
    setCurrent(students.findIndex((s) => s.id === student.id));
    const secs = prefs.voiceConfirm;
    if (secs <= 0) { setPending(p); return; }
    setPending(p);
    progress.value = 0;
    progress.value = withTiming(1, { duration: secs * 1000, easing: Easing.linear });
    timer.current = setTimeout(() => commit(p), secs * 1000);
  };

  const cancelPending = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    cancelAnimation(progress);
    setPending(null);
    setNotice({ tone: 'info', text: 'أُلغيت.' });
  };

  const undo = () => {
    if (pending) { cancelPending(); return; }
    const last = history[0];
    if (!last) { warn({ tone: 'info', text: 'لا شيء للتراجع عنه.' }); return; }
    setGrade(bookId, last.student.id, column.id, last.prev?.value ?? null, last.prev?.mark ?? null);
    setHistory((h) => h.slice(1));
    setCurrent(students.findIndex((s) => s.id === last.student.id));
    warn({ tone: 'info', text: `تراجعت عن ${last.student.name}.` }, 'تم التراجع');
  };

  // ------------------------------------------------ فهم الجملة
  function handle(text: string) {
    setHeard(text);
    const cmd = parseCommand(text, students, { ordered: mode === 'ordered' });
    const cur = current >= 0 ? students[current] : null;
    switch (cmd.type) {
      case 'confirm':
        if (pending) commit(pending);
        else if (choices?.list[0]) pickChoice(choices.list[0].student);
        return;
      case 'cancel': if (pending) cancelPending(); else setChoices(null); return;
      case 'undo': undo(); return;
      case 'stop': if (pending) commit(pending); rec.stop(); return;
      case 'next': if (pending) commit(pending); setCurrent((i) => Math.min(students.length - 1, i + 1)); return;
      case 'skip': if (pending) commit(pending); setCurrent((i) => nextEmpty(i)); return;
      case 'previous': if (pending) commit(pending); setCurrent((i) => Math.max(0, i - 1)); return;
      case 'absent':
        if (cur) propose(cur, null, 'absent');
        else warn({ tone: 'warn', text: 'قل اسم الطالب الغائب.' });
        return;
      case 'value':
        if (cur) propose(cur, cmd.value, null);
        else warn({ tone: 'warn', text: `سمعت ${arDigits(cmd.value)} — لمن؟ قل الاسم مع الدرجة.` }, 'لمن الدرجة؟');
        return;
      case 'grade':
      case 'mark': {
        const value = cmd.type === 'grade' ? cmd.value : null;
        const mark = cmd.type === 'mark' ? cmd.mark : null;
        if (isConfident(cmd.candidates)) { propose(cmd.candidates[0].student, value, mark); return; }
        if (cmd.candidates.length) {
          setChoices({ list: cmd.candidates.slice(0, 4), value, mark });
          warn({ tone: 'warn', text: isAmbiguous(cmd.candidates) ? `أكثر من طالب باسم «${cmd.nameText}» — اختر أو قل الاسم الثاني.` : `هل تقصد ${cmd.candidates[0].student.name}؟` }, isAmbiguous(cmd.candidates) ? 'أي واحد؟' : undefined);
          return;
        }
        if (mode === 'ordered' && cur && value != null) { propose(cur, value, null); return; }
        warn({ tone: 'bad', text: `لم أجد «${cmd.nameText}» في الشعبة.` }, 'لم أجد الاسم');
        return;
      }
      case 'select':
        if (isConfident(cmd.candidates)) {
          setCurrent(students.findIndex((s) => s.id === cmd.candidates[0].student.id));
          setNotice({ tone: 'info', text: `${cmd.candidates[0].student.name} — قل الدرجة.` });
        } else {
          setChoices({ list: cmd.candidates.slice(0, 4), value: null, mark: null });
        }
        return;
      default:
        warn({ tone: 'warn', text: `لم أفهم: «${text}»` });
    }
  }

  function pickChoice(s: Student) {
    const ch = choices;
    setChoices(null);
    if (ch && (ch.value != null || ch.mark)) propose(s, ch.value, ch.mark);
    else { setCurrent(students.findIndex((x) => x.id === s.id)); setNotice({ tone: 'info', text: `${s.name} — قل الدرجة.` }); }
  }

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  // تمرير القائمة إلى الطالب الحالي
  useEffect(() => {
    if (current >= 0) scroller.current?.scrollTo({ y: Math.max(0, current * 52 - 120), animated: true });
  }, [current]);

  const bar = useAnimatedStyle(() => ({ width: `${(1 - progress.value) * 100}%` }));
  const listening = rec.state === 'listening' || rec.state === 'starting';
  const cur = current >= 0 ? students[current] : null;
  const curGrade = cur ? values.get(cur.id) : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, gap: 10 }}>
        <Header title={column.name} subtitle={`${book?.title ?? ''} · ${sectionLabel(sectionId)} · من ${arDigits(column.max)}`}
          right={(
            <>
              <IconButton name="settings" label="إعدادات الصوت" onPress={() => setSettingsOpen(true)} />
              <IconButton name="edit" label="تغيير السجل" onPress={() => { rec.stop(); onSetup(); }} />
            </>
          )} />
        <View style={{ gap: 6 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T size={13} weight="bold">{arDigits(filled)} من {arDigits(students.length)}</T>
            <T size={12} dim>{mode === 'ordered' ? 'بالترتيب' : 'الاسم + الدرجة'}</T>
          </Row>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: c.line, overflow: 'hidden' }}>
            <View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: `${students.length ? (filled / students.length) * 100 : 0}%`, backgroundColor: c.accent }} />
          </View>
        </View>
      </View>

      <ScrollView ref={scroller} style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 260, gap: 4, maxWidth: 720, width: '100%', alignSelf: 'center' }}>
        {students.map((s, i) => {
          const g = values.get(s.id);
          const active = i === current;
          const isPending = pending?.student.id === s.id;
          return (
            <PressScale key={s.id} onPress={() => { setCurrent(i); setNotice({ tone: 'info', text: `${s.name} — قل الدرجة.` }); }} scaleTo={0.98}
              style={{ height: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, borderRadius: 16, backgroundColor: isPending ? c.soft : active ? c.card : 'transparent', borderWidth: active || isPending ? 1.5 : 0, borderColor: isPending ? c.accent : c.line }}>
              <T dim size={12} weight="bold" style={{ width: 22, textAlign: 'center' }}>{arDigits(i + 1)}</T>
              <T size={15} weight={active ? 'bold' : 'medium'} style={{ flex: 1 }} lines={1}>{s.name}</T>
              {isPending ? <Pill small label={pending!.mark ? MARK_LABEL[pending!.mark] : formatScore(pending!.value)} tone="info" />
                : g?.mark ? <Pill small label={MARK_LABEL[g.mark]} tone="warn" />
                  : g?.value != null ? <T weight="bold" size={16} color={g.value / column.max * 100 < (book?.result.pass ?? 50) ? tone.bad.ink : c.ink}>{formatScore(g.value)}</T>
                    : <T dim size={14}>—</T>}
            </PressScale>
          );
        })}
      </ScrollView>

      {/* اللوحة السفلية: الطالب الحالي، التأكيد، التنبيهات، الميكروفون */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: insets.bottom + 14, paddingTop: 14, paddingHorizontal: 16, backgroundColor: c.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, borderColor: c.line, gap: 10 }}>
        {pending ? (
          <Animated.View entering={FadeIn.duration(120)} style={{ backgroundColor: c.heroBg, borderRadius: 20, padding: 14, gap: 10, overflow: 'hidden' }}>
            <Row>
              <View style={{ flex: 1 }}>
                <T size={13} color={c.heroInk2}>{pending.prev ? 'استبدال' : 'كتابة'}</T>
                <T weight="bold" size={17} color={c.heroInk} lines={1}>{pending.student.name}</T>
              </View>
              <T display size={34} color={c.heroInk}>{pending.mark ? MARK_LABEL[pending.mark] : formatScore(pending.value)}</T>
            </Row>
            <Row gap={8}>
              <Button title="إلغاء" small variant="secondary" style={{ flex: 1 }} onPress={cancelPending} />
              <Button title="تثبيت" icon="check" small style={{ flex: 2 }} onPress={() => commit(pending)} />
            </Row>
            {prefs.voiceConfirm > 0 ? <Animated.View style={[{ position: 'absolute', bottom: 0, right: 0, height: 4, backgroundColor: c.accent }, bar]} /> : null}
          </Animated.View>
        ) : choices ? (
          <Animated.View entering={FadeIn.duration(120)} style={{ gap: 8 }}>
            <T weight="bold" size={14}>اختر الطالب{choices.value != null ? ` (${formatScore(choices.value)})` : ''}:</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {choices.list.map((x) => <Chip key={x.student.id} label={x.student.name} onPress={() => pickChoice(x.student)} />)}
              <Chip label="إلغاء" onPress={() => setChoices(null)} />
            </View>
          </Animated.View>
        ) : cur ? (
          <Row>
            <View style={{ flex: 1 }}>
              <T size={12} dim>{mode === 'ordered' ? 'الطالب الحالي' : 'المحدد'}</T>
              <T weight="bold" size={17} lines={1}>{cur.name}</T>
            </View>
            {curGrade?.value != null || curGrade?.mark ? <Pill label={curGrade.mark ? MARK_LABEL[curGrade.mark] : formatScore(curGrade.value)} /> : null}
          </Row>
        ) : (
          <T dim size={14}>قل اسم الطالب ودرجته…</T>
        )}

        {notice ? (
          <Animated.View key={notice.text} entering={FadeIn.duration(120)} exiting={FadeOut.duration(100)}
            style={{ backgroundColor: notice.tone === 'bad' ? tone.bad.bg : notice.tone === 'warn' ? tone.warn.bg : c.soft, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 }}>
            <T size={13} weight="medium" color={notice.tone === 'bad' ? tone.bad.ink : notice.tone === 'warn' ? tone.warn.ink : c.softInk}>{notice.text}</T>
          </Animated.View>
        ) : null}

        <Row gap={12}>
          <IconButton name="refresh" label="تراجع" onPress={undo} size={48} />
          <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <T size={13} dim lines={1} center>{rec.partial || (heard ? `«${heard}»` : listening ? 'أستمع…' : rec.error ?? 'اضغط الميكروفون وتكلّم')}</T>
          </View>
          <MicButton active={listening} volume={rec.volume} onPress={() => (listening ? rec.stop() : rec.start())} />
        </Row>
        {!speechAvailable() || rec.state === 'error' || kb ? (
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TextInput value={typed} onChangeText={setTyped} placeholder="أو اكتب: أحمد علي ٨٥" placeholderTextColor={c.ink3}
              onSubmitEditing={() => { if (typed.trim()) { handle(typed.trim()); setTyped(''); } }} returnKeyType="send" blurOnSubmit={false}
              style={{ flex: 1, height: 44, borderRadius: 22, borderWidth: 1, borderColor: c.line, backgroundColor: c.bg, paddingHorizontal: 16, fontFamily: fonts.regular, fontSize: 15, color: c.ink, textAlign: 'right' }} />
            <IconButton name="send" label="إرسال" filled onPress={() => { if (typed.trim()) { handle(typed.trim()); setTyped(''); } }} />
          </View>
        ) : null}
      </View>

      <Sheet visible={settings} onClose={() => setSettingsOpen(false)}>
        <T display size={22}>إعدادات الصوت</T>
        <View style={{ gap: 6, marginTop: 8 }}>
          <T weight="bold" size={14}>مؤقت التأكيد</T>
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            {[0, 2, 3, 5].map((s) => <Chip key={s} label={s ? `${arDigits(s)} ث` : 'يدوي'} active={prefs.voiceConfirm === s} onPress={() => setSettings({ prefs: { ...prefs, voiceConfirm: s } })} />)}
          </Row>
          <T dim size={12}>تُكتب الدرجة تلقائياً بعد انتهاء المؤقت، ويمكنك إلغاؤها قبل ذلك بقول «لا». «يدوي» = بعد «نعم» فقط.</T>
          <ToggleRow title="قراءة الدرجة بصوت عالٍ" subtitle="يقول اسم الطالب ودرجته بعد كتابتها" value={prefs.voiceSpeak} onChange={(v) => setSettings({ prefs: { ...prefs, voiceSpeak: v } })} />
          <ToggleRow title="الانتقال للطالب التالي تلقائياً" subtitle="في وضع «بالترتيب»" value={prefs.voiceAdvance} onChange={(v) => setSettings({ prefs: { ...prefs, voiceAdvance: v } })} />
          <ToggleRow title="خانة الكتابة" subtitle="اكتب الأوامر بدل قولها (مثلاً في مكان صاخب)" value={kb} onChange={setKb} />
        </View>
      </Sheet>
    </View>
  );
}

/** زر الميكروفون: ينبض أثناء الاستماع ويتمدد مع ارتفاع الصوت */
function MicButton({ active, volume, onPress }: { active: boolean; volume: number; onPress: () => void }) {
  const { c } = useTheme();
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (active) pulse.value = withRepeat(withSequence(withTiming(1.12, { duration: 700 }), withTiming(1, { duration: 700 })), -1);
    else { cancelAnimation(pulse); pulse.value = withTiming(1, { duration: 150 }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
  const halo = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value + volume * 0.35 }], opacity: active ? 0.25 : 0 }));
  return (
    <PressScale onPress={() => { tap('medium'); onPress(); }} scaleTo={0.92} accessibilityRole="button" accessibilityLabel={active ? 'إيقاف الاستماع' : 'ابدأ الاستماع'}
      style={{ width: 72, height: 72, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[{ position: 'absolute', width: 72, height: 72, borderRadius: 36, backgroundColor: c.gold }, halo]} />
      <View style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: active ? c.gold : c.heroBg, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="mic" size={28} color={active ? c.goldInk : '#FFFFFF'} />
      </View>
    </PressScale>
  );
}
