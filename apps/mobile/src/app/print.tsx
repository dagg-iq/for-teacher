/**
 * استوديو الطباعة: معاينة A4 حيّة لكل مطبوع، مع اختيار الأقسام وترتيبها، والقالب والخط والحجم والصفحة،
 * والترويسة والتذييل (ومنها إخفاء علامة نَهج). الإعدادات تُحفظ وتنطبق على كل المطبوعات، والأقسام تُحفظ لكل نوع.
 */
import { arDigits } from '@nahj/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Platform, ScrollView, View } from 'react-native';
import { Icon } from '@/components/icon';
import { Pill, Stepper, ToggleRow } from '@/components/kit';
import { PressScale } from '@/components/motion';
import { PrintPreview } from '@/components/print-preview';
import { Button, Chip, Divider, Empty, Field, Header, IconButton, Row, Screen, Segmented, T } from '@/components/ui';
import { getSettings, setSettings, useDBVersion, useSettings } from '@/data/db';
import { useWide } from '@/lib/hooks';
import { buildDoc, DOC_LABEL, extrasWithDefaults, type DocKind } from '@/lib/print/docs';
import { printPaged, sharePdf } from '@/lib/print/output';
import { renderDoc, type ExtraDef, type PrintDoc } from '@/lib/print/render';
import {
  ACCENTS, DEFAULT_PRINT, FONTS, resolveLayout, resolveStyle, THEMES, type PrintLayout, type PrintStyle,
} from '@/lib/print/style';
import { useTheme } from '@/lib/theme';
import { toast } from '@/lib/toast';

type Tab = 'preview' | 'sections' | 'format';

export default function PrintStudio() {
  const params = useLocalSearchParams<{ kind?: string; id?: string }>();
  const kind = (params.kind ?? 'report') as DocKind;
  const id = params.id;
  const { c } = useTheme();
  const wide = useWide();
  const prefs = useSettings().prefs;
  const version = useDBVersion();
  const style = useMemo(() => resolveStyle(prefs.print), [prefs.print]);
  const savedLayout = prefs.printLayouts?.[kind];
  const [tab, setTab] = useState<Tab>('preview');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState<string | undefined>(undefined);
  const [note, setNote] = useState('');

  // المحتوى من البيانات الحالية (يُعاد بناؤه عند أي تعديل أو تغيير خيار)
  const built = useMemo<{ doc: PrintDoc | null; error: string | null }>(() => {
    try {
      return { doc: buildDoc(kind, id, savedLayout?.extras ?? {}), error: null };
    } catch (e) {
      return { doc: null, error: e instanceof Error ? e.message : 'تعذّر تجهيز المطبوع' };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, id, version, JSON.stringify(savedLayout?.extras ?? {})]);
  const doc = built.doc;
  const layout = useMemo(() => (doc ? resolveLayout(doc.blocks, savedLayout) : null), [doc, savedLayout]);
  const extras = useMemo(() => extrasWithDefaults(doc?.extras, savedLayout?.extras), [doc, savedLayout]);

  const [html, setHtml] = useState<string | null>(null);
  const [landscape, setLandscape] = useState(false);
  const [paged, setPaged] = useState<{ pages: number; html: string } | null>(null);
  const frame = useRef<HTMLIFrameElement | null>(null);
  const [busy, setBusy] = useState(false);

  // إعادة الرسم بعد توقف قصير عن التعديل (الكتابة في العنوان لا تعيد الرسم مع كل حرف)
  useEffect(() => {
    if (!doc || !layout) return;
    let alive = true;
    const t = setTimeout(() => {
      renderDoc(doc, style, layout, { title, subtitle, note }).then((r) => {
        if (!alive) return;
        setPaged(null);
        setHtml(r.html);
        setLandscape(r.landscape);
      }).catch((e) => toast(e instanceof Error ? e.message : 'تعذّرت المعاينة', { tone: 'bad' }));
    }, 220);
    return () => { alive = false; clearTimeout(t); };
  }, [doc, layout, style, title, subtitle, note]);

  const onPaged = useCallback((pages: number, pagedHtml: string) => setPaged({ pages, html: pagedHtml }), []);

  const saveStyle = (patch: Partial<PrintStyle>) => setSettings({ prefs: { ...getSettings().prefs, print: { ...style, ...patch } } });
  const saveLayout = (patch: Partial<PrintLayout>) => {
    if (!layout) return;
    const p = getSettings().prefs;
    setSettings({ prefs: { ...p, printLayouts: { ...(p.printLayouts ?? {}), [kind]: { ...layout, ...patch } } } });
  };
  const setExtra = (k: string, v: number | boolean | string) => saveLayout({ extras: { ...extras, [k]: v } });

  const act = async (what: 'print' | 'pdf') => {
    if (!paged) { toast('انتظر اكتمال المعاينة', { icon: 'clock' }); return; }
    setBusy(true);
    try {
      const o = { html: paged.html, frame: frame.current, landscape, paper: style.paper, fileName: doc?.fileName ?? 'نهج' };
      if (what === 'print') await printPaged(o); else await sharePdf(o);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'تعذّرت الطباعة', { tone: 'bad', icon: 'info' });
    } finally {
      setBusy(false);
    }
  };

  if (!doc || !layout) {
    return <Screen><Header title="الطباعة" /><Empty icon="print" title={built.error ?? 'لا شيء للطباعة'} /></Screen>;
  }

  const enabled = layout.order.filter((b) => !layout.off.includes(b) && !doc.blocks.find((x) => x.id === b)?.empty).length;
  const profile = getSettings().profile;
  const options = (
    <View style={{ gap: 18 }}>
      {!profile?.school ? (
        <PressScale onPress={() => router.push('/settings')} style={{ flexDirection: 'row', gap: 10, alignItems: 'center', padding: 12, borderRadius: 14, backgroundColor: c.soft }}>
          <Icon name="info" size={18} color={c.softInk} />
          <T size={13} color={c.softInk} style={{ flex: 1 }}>أضف اسم المدرسة ومديرها من الإعدادات لتظهر في الترويسة والتوقيع.</T>
        </PressScale>
      ) : null}
      {tab !== 'format' || wide ? (
        <Section title="الأقسام" hint="اختر ما يُطبع ورتّبه بالأسهم. «صفحة جديدة» يبدأ القسم في صفحة مستقلة.">
          {layout.order.map((bid, i) => {
            const b = doc.blocks.find((x) => x.id === bid)!;
            const on = !layout.off.includes(bid) && !b.empty;
            const brk = layout.breaks.includes(bid);
            return (
              <View key={bid} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: c.line, opacity: b.empty ? 0.5 : 1 }}>
                <PressScale disabled={!!b.empty} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={b.title}
                  onPress={() => saveLayout({ off: on ? [...layout.off, bid] : layout.off.filter((x) => x !== bid) })}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: on ? 0 : 1.5, borderColor: c.ink3, backgroundColor: on ? c.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                    {on ? <Icon name="check" size={16} color={c.accentInk} strokeWidth={2.6} /> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <T weight="bold" size={14}>{b.title}</T>
                    {b.empty ? <T dim size={11}>{b.empty}</T> : null}
                  </View>
                </PressScale>
                {i ? <Chip small label={brk ? 'صفحة جديدة ✓' : 'صفحة جديدة'} active={brk} onPress={() => saveLayout({ breaks: brk ? layout.breaks.filter((x) => x !== bid) : [...layout.breaks, bid] })} /> : null}
                <Arrow name="up" label={`تحريك ${b.title} للأعلى`} disabled={i === 0} onPress={() => { const o = [...layout.order]; [o[i - 1], o[i]] = [o[i], o[i - 1]]; saveLayout({ order: o }); }} />
                <Arrow name="down" label={`تحريك ${b.title} للأسفل`} disabled={i === layout.order.length - 1} onPress={() => { const o = [...layout.order]; [o[i + 1], o[i]] = [o[i], o[i + 1]]; saveLayout({ order: o }); }} />
              </View>
            );
          })}
        </Section>
      ) : null}
      {(tab !== 'format' || wide) && doc.extras?.length ? (
        <Section title={`خيارات ${DOC_LABEL[kind]}`}>
          {doc.extras.map((x, i) => <ExtraRow key={x.key} def={x} value={extras[x.key]} first={!i} onChange={(v) => setExtra(x.key, v)} />)}
        </Section>
      ) : null}
      {(tab !== 'format' || wide) ? (
        <Section title="العنوان والملاحظة" hint="لهذه الطباعة فقط">
          <View style={{ gap: 10, paddingVertical: 10 }}>
            <Field label="العنوان" value={title} onChangeText={setTitle} placeholder={doc.title} />
            <Field label="العنوان الفرعي" value={subtitle ?? doc.subtitle} onChangeText={setSubtitle} />
            <Field label="ملاحظة أسفل المحتوى" value={note} onChangeText={setNote} multiline placeholder="اختياري" />
          </View>
        </Section>
      ) : null}

      {tab === 'format' || wide ? (
        <>
          <Section title="القالب">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 10 }}>
              {THEMES.map((t) => <ThemeCard key={t.key} theme={t} active={style.theme === t.key} accent={style.accent} onPress={() => saveStyle({ theme: t.key })} />)}
            </View>
            {style.theme === 'modern' ? (
              <Row gap={10} style={{ paddingBottom: 12 }}>
                <T size={13} weight="bold">اللون</T>
                {ACCENTS.map((a) => (
                  <PressScale key={a} onPress={() => saveStyle({ accent: a })} accessibilityLabel={`اللون ${a}`}
                    style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: a, borderWidth: style.accent === a ? 3 : 0, borderColor: c.gold }} />
                ))}
              </Row>
            ) : null}
          </Section>
          <Section title="الخط">
            <View style={{ paddingVertical: 10, gap: 12 }}>
              <Segmented options={FONTS.map((f) => ({ key: f.key, label: f.label }))} value={style.font} onChange={(v) => saveStyle({ font: v })} />
              <Row style={{ justifyContent: 'space-between' }}>
                <T weight="bold" size={14}>حجم النص</T>
                <Stepper value={style.size} onChange={(v) => saveStyle({ size: v })} min={8} max={14} step={0.5} format={(v) => `${arDigits(v)} نقطة`} />
              </Row>
              <Segmented options={[{ key: 'compact', label: 'مضغوط' }, { key: 'normal', label: 'عادي' }, { key: 'roomy', label: 'مريح' }]} value={style.density} onChange={(v) => saveStyle({ density: v })} />
            </View>
          </Section>
          <Section title="الصفحة">
            <View style={{ paddingVertical: 10, gap: 10 }}>
              <Segmented options={[{ key: 'A4', label: 'A4' }, { key: 'A5', label: 'A5' }]} value={style.paper} onChange={(v) => saveStyle({ paper: v })} />
              <Segmented options={[{ key: 'auto', label: 'تلقائي' }, { key: 'portrait', label: 'عمودي' }, { key: 'landscape', label: 'أفقي' }]} value={style.orientation} onChange={(v) => saveStyle({ orientation: v })} />
              <Segmented options={[{ key: 'narrow', label: 'هوامش ضيقة' }, { key: 'normal', label: 'عادية' }, { key: 'wide', label: 'واسعة' }]} value={style.margins} onChange={(v) => saveStyle({ margins: v })} />
            </View>
          </Section>
          <Section title="الترويسة والتذييل">
            <ToggleRow title="الترويسة الرسمية" subtitle="جمهورية العراق — وزارة التربية — المديرية" value={style.officialHeader} onChange={(v) => saveStyle({ officialHeader: v })} />
            <Divider />
            <ToggleRow title="معلومات المدرسة" subtitle="المدرسة والمادة والعام الدراسي" value={style.schoolInfo} onChange={(v) => saveStyle({ schoolInfo: v })} />
            <Divider />
            <ToggleRow title="التواقيع" value={style.signatures} onChange={(v) => saveStyle({ signatures: v })} />
            <Divider />
            <ToggleRow title="علامة نَهج" subtitle="«أُعدّ بتطبيق نَهج» أسفل كل صفحة" value={style.brand} onChange={(v) => saveStyle({ brand: v })} />
            <Divider />
            <ToggleRow title="أرقام الصفحات" value={style.pageNumbers} onChange={(v) => saveStyle({ pageNumbers: v })} />
            <Divider />
            <ToggleRow title="تاريخ الطباعة" value={style.printDate} onChange={(v) => saveStyle({ printDate: v })} />
          </Section>
          <Section title="الجداول">
            <ToggleRow title="تظليل الصفوف بالتناوب" value={style.zebra} onChange={(v) => saveStyle({ zebra: v })} />
            <Divider />
            <ToggleRow title="الراسب بلون مميز" value={style.highlightFail} onChange={(v) => saveStyle({ highlightFail: v })} />
            <Divider />
            <ToggleRow title="تكرار رأس الجدول في كل صفحة" value={style.repeatHeader} onChange={(v) => saveStyle({ repeatHeader: v })} />
          </Section>
          <Button title="استعادة التنسيق الافتراضي" icon="refresh" variant="secondary" small onPress={() => { setSettings({ prefs: { ...getSettings().prefs, print: DEFAULT_PRINT } }); toast('عاد التنسيق الافتراضي', { icon: 'check' }); }} />
        </>
      ) : null}
    </View>
  );

  const preview = (
    <View style={{ flex: 1, borderRadius: wide ? 20 : 16, overflow: 'hidden', borderWidth: 1, borderColor: c.line, minHeight: 320 }}>
      {html ? <PrintPreview html={html} onPaged={onPaged} onFrame={(f) => { frame.current = f; }} /> : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={c.accent} /></View>}
      {html && !paged ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: 10, left: 10, backgroundColor: c.card, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
          <T size={12} dim>جارٍ التقسيم إلى صفحات…</T>
        </View>
      ) : null}
    </View>
  );

  const actions = (
    <Row gap={8}>
      <Button title="طباعة" icon="print" style={{ flex: 1 }} loading={busy} disabled={!paged || !enabled} onPress={() => act('print')} />
      {Platform.OS !== 'web' ? <Button title="PDF" icon="share" variant="secondary" style={{ flex: 1 }} disabled={!paged || !enabled || busy} onPress={() => act('pdf')} /> : null}
    </Row>
  );
  const headerRight = paged ? <Pill label={`${arDigits(paged.pages)} ${paged.pages === 1 ? 'صفحة' : paged.pages === 2 ? 'صفحتان' : paged.pages <= 10 ? 'صفحات' : 'صفحة'}`} tone="info" /> : null;

  if (wide) {
    return (
      <Screen scroll={false} wide edges={['top', 'bottom']}>
        <Header title="الطباعة" subtitle={`${DOC_LABEL[kind]} — ${doc.subtitle || doc.title}`} right={headerRight} />
        <View style={{ flex: 1, flexDirection: 'row', gap: 20, marginTop: 12 }}>
          <View style={{ width: 400, gap: 12 }}>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 16 }} showsVerticalScrollIndicator={false}>{options}</ScrollView>
            {actions}
            {Platform.OS === 'web' ? <T dim size={12} center>لحفظ PDF: اختر «حفظ بصيغة PDF» في نافذة الطباعة.</T> : null}
          </View>
          {preview}
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll={false} edges={['top', 'bottom']}>
      <Header title="الطباعة" subtitle={`${DOC_LABEL[kind]} — ${doc.subtitle || doc.title}`} right={headerRight} />
      <View style={{ marginTop: 10 }}>
        <Segmented<Tab> options={[{ key: 'preview', label: 'المعاينة' }, { key: 'sections', label: 'الأقسام' }, { key: 'format', label: 'التنسيق' }]} value={tab} onChange={setTab} />
      </View>
      <View style={{ flex: 1, marginTop: 12 }}>
        {tab === 'preview' ? preview : (
          <ScrollView contentContainerStyle={{ paddingBottom: 16 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{options}</ScrollView>
        )}
      </View>
      <View style={{ paddingTop: 12, gap: 6 }}>
        {actions}
        {Platform.OS === 'web' ? <T dim size={12} center>لحفظ PDF: اختر «حفظ بصيغة PDF» في نافذة الطباعة.</T> : null}
      </View>
    </Screen>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Row gap={8}><View style={{ width: 7, height: 7, backgroundColor: c.gold }} /><T weight="bold" size={15}>{title}</T></Row>
      {hint ? <T dim size={12}>{hint}</T> : null}
      <View style={{ backgroundColor: c.card, borderRadius: 18, borderWidth: 1, borderColor: c.line, paddingHorizontal: 14 }}>{children}</View>
    </View>
  );
}

function Arrow({ name, label, onPress, disabled }: { name: 'up' | 'down'; label: string; onPress: () => void; disabled?: boolean }) {
  return <View style={{ opacity: disabled ? 0.3 : 1 }}><IconButton name={name} label={label} size={34} onPress={disabled ? undefined : onPress} /></View>;
}

function ExtraRow({ def, value, onChange, first }: { def: ExtraDef; value: number | boolean | string | undefined; onChange: (v: number | boolean | string) => void; first: boolean }) {
  const { c } = useTheme();
  const border = { borderTopWidth: first ? 0 : 1, borderTopColor: c.line };
  if (def.kind === 'toggle') return <View style={border}><ToggleRow title={def.label} value={!!value} onChange={onChange} /></View>;
  if (def.kind === 'number') {
    return (
      <Row style={[{ justifyContent: 'space-between', paddingVertical: 10 }, border]}>
        <T weight="bold" size={14} style={{ flex: 1 }}>{def.label}</T>
        <Stepper value={Number(value ?? def.def)} onChange={onChange} min={def.min} max={def.max} />
      </Row>
    );
  }
  if (def.kind === 'text') {
    return <View style={[{ paddingVertical: 10 }, border]}><Field label={def.label} value={String(value ?? '')} onChangeText={onChange} /></View>;
  }
  return (
    <View style={[{ paddingVertical: 10, gap: 8 }, border]}>
      <T weight="bold" size={14}>{def.label}</T>
      <Segmented options={def.choices ?? []} value={String(value ?? def.def)} onChange={onChange} />
    </View>
  );
}

/** بطاقة قالب بمعاينة مصغّرة لشكل الجدول */
function ThemeCard({ theme, active, accent, onPress }: { theme: (typeof THEMES)[number]; active: boolean; accent: string; onPress: () => void }) {
  const { c } = useTheme();
  const head = theme.key === 'modern' ? accent : theme.key === 'official' ? '#D9D9D4' : 'transparent';
  const line = theme.key === 'minimal' ? '#CFCFCA' : '#333';
  return (
    <PressScale onPress={onPress} scaleTo={0.96} accessibilityRole="radio" accessibilityState={{ selected: active }} accessibilityLabel={theme.label}
      style={{ flexBasis: '47%', flexGrow: 1, padding: 10, borderRadius: 16, borderWidth: active ? 2 : 1, borderColor: active ? c.accent : c.line, gap: 8, backgroundColor: c.card }}>
      <View style={{ height: 54, borderRadius: 8, backgroundColor: '#FFFFFF', padding: 6, gap: 3, borderWidth: 1, borderColor: '#E6E2D9' }}>
        <View style={{ height: 3, width: '50%', alignSelf: 'center', backgroundColor: theme.key === 'modern' ? accent : '#222' }} />
        {[0, 1, 2].map((r) => (
          <View key={r} style={{ flexDirection: 'row', height: 9, backgroundColor: r === 0 ? head : 'transparent', borderBottomWidth: 1, borderColor: line, borderLeftWidth: theme.key === 'minimal' ? 0 : 1, borderRightWidth: theme.key === 'minimal' ? 0 : 1, borderTopWidth: r === 0 && theme.key !== 'minimal' ? 1 : 0 }} />
        ))}
      </View>
      <View>
        <T weight="bold" size={14} color={active ? c.accent : c.ink}>{theme.label}</T>
        <T dim size={11} lines={2}>{theme.hint}</T>
      </View>
    </PressScale>
  );
}
