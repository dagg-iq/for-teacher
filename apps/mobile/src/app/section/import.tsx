import { arDigits, countStudents, normalizeArabic, parseNameList, sortArabic } from '@midad/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Pill, ToggleRow } from '@/components/kit';
import { Button, Card, Field, Header, Row, Screen, T } from '@/components/ui';
import { insertMany } from '@/data/db';
import { sectionLabel, studentsOf } from '@/data/queries';
import { pickNamesFromFile } from '@/lib/export';
import { useTheme } from '@/lib/theme';
import { toast } from '@/lib/toast';

/** استيراد الطلاب: لصق قائمة أو ملف Excel */
export default function ImportStudents() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  const [text, setText] = useState('');
  const [sort, setSort] = useState(true);
  const [busy, setBusy] = useState(false);
  const existing = useMemo(() => new Set(studentsOf(id).map((s) => normalizeArabic(s.name))), [id]);
  const parsed = useMemo(() => parseNameList(text), [text]);
  const fresh = parsed.filter((n) => !existing.has(normalizeArabic(n)));
  const dupes = parsed.length - fresh.length;

  const fromFile = async () => {
    try {
      setBusy(true);
      const names = await pickNamesFromFile();
      if (names == null) return;
      if (!names.length) { toast('لم أجد عمود أسماء في الملف', { tone: 'bad', icon: 'info' }); return; }
      setText((t) => (t.trim() ? `${t.trim()}\n` : '') + names.join('\n'));
    } catch (e) {
      toast(`تعذّر قراءة الملف: ${e instanceof Error ? e.message : ''}`, { tone: 'bad' });
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    const names = sort ? sortArabic(fresh) : fresh;
    const start = studentsOf(id).reduce((m, s) => Math.max(m, s.number ?? 0), 0);
    insertMany('students', names.map((name, i) => ({ section_id: id, name, number: start + i + 1, sort: start + i + 1 })));
    toast(`أُضيف ${countStudents(names.length)}`, { icon: 'check' });
    router.back();
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="إضافة الطلاب" subtitle={sectionLabel(id)} />
      <Card tone="soft" style={{ gap: 6 }}>
        <T weight="bold" size={14} color={c.softInk}>الصق القائمة كما هي</T>
        <T size={13} color={c.softInk}>اسم في كل سطر — من واتساب أو Excel أو أي ملف. الأرقام في بداية الأسطر تُحذف تلقائياً، والأسماء المكررة لا تُضاف.</T>
      </Card>
      <Field value={text} onChangeText={setText} multiline placeholder={'١- أحمد علي حسين\n٢- علي حسن كاظم\n٣- …'} style={{ minHeight: 220 }} />
      <Button title="من ملف Excel أو CSV" icon="excel" variant="secondary" loading={busy} onPress={fromFile} />
      {parsed.length ? (
        <Card style={{ gap: 10 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T weight="bold" size={16}>{countStudents(fresh.length)} جديد</T>
            {dupes ? <Pill label={`${arDigits(dupes)} مكرر`} tone="warn" small /> : null}
          </Row>
          <View style={{ gap: 4 }}>
            {(sort ? sortArabic(fresh) : fresh).slice(0, 6).map((n, i) => <T key={n} size={14} dim>{arDigits(i + 1)}. {n}</T>)}
            {fresh.length > 6 ? <T size={13} dim>… و{arDigits(fresh.length - 6)} آخرين</T> : null}
          </View>
          <ToggleRow title="ترتيب أبجدي" subtitle="رقم الطالب حسب الترتيب الأبجدي" value={sort} onChange={setSort} />
        </Card>
      ) : null}
      <Button title={fresh.length ? `إضافة ${countStudents(fresh.length)}` : 'إضافة'} icon="check" disabled={!fresh.length} onPress={save} />
    </Screen>
  );
}
