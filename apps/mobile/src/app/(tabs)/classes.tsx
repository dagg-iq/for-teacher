import { arDigits, countSections, countStudents, STAGE_LABEL } from '@rasd/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Icon } from '@/components/icon';
import { SearchBar, SectionMark } from '@/components/kit';
import { PressScale } from '@/components/motion';
import { Card, Empty, Fab, Header, IconButton, Row, Screen, T } from '@/components/ui';
import { all, count, useQuery } from '@/data/db';
import { classesSorted, sectionLabel, sectionsOf } from '@/data/queries';
import { useTheme } from '@/lib/theme';
import { normalizeArabic } from '@rasd/shared';

export default function Classes() {
  const { c, hue } = useTheme();
  const [q, setQ] = useState('');
  const classes = useQuery(() => classesSorted().map((k) => ({
    k,
    sections: sectionsOf(k.id).map((s) => ({ s, n: count('students', (x) => x.section_id === s.id) })),
  })));
  const found = useQuery(() => {
    const n = normalizeArabic(q);
    if (n.length < 2) return [];
    return all('students').filter((s) => normalizeArabic(s.name).includes(n)).slice(0, 30);
  }, [q]);

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <Header back={false} title="الصفوف" subtitle={classes.length ? `${countSections(classes.reduce((n, x) => n + x.sections.length, 0))} · ${countStudents(classes.reduce((n, x) => n + x.sections.reduce((m, s) => m + s.n, 0), 0))}` : undefined}
          right={<IconButton name="check-square" label="الحضور" onPress={() => router.push('/attendance')} />} />
        {classes.length ? <SearchBar value={q} onChange={setQ} placeholder="ابحث عن طالب في كل الشعب" /> : null}
        {q.trim().length >= 2 ? (
          <Card style={{ paddingVertical: 4 }}>
            {found.length ? found.map((s, i) => (
              <PressScale key={s.id} onPress={() => router.push(`/student/${s.id}`)} scaleTo={0.98}
                style={{ paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
                <T weight="bold" size={15}>{s.name}</T>
                <T dim size={12}>{sectionLabel(s.section_id)}</T>
              </PressScale>
            )) : <T dim center style={{ paddingVertical: 16 }}>لا يوجد طالب بهذا الاسم</T>}
          </Card>
        ) : classes.length === 0 ? (
          <Card>
            <Empty icon="school" title="لا صفوف بعد" body="أضف أول صف وشعبه، مثل «الخامس العلمي» بشعبتي أ وب." action="إضافة صف" onAction={() => router.push('/class/new')} />
          </Card>
        ) : classes.map(({ k, sections }) => (
          <Card key={k.id} style={{ gap: 12 }}>
            <PressScale onPress={() => router.push(`/class/${k.id}`)} scaleTo={0.98} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 6, alignSelf: 'stretch', borderRadius: 3, backgroundColor: hue(k.hue) }} />
              <View style={{ flex: 1 }}>
                <T weight="bold" size={18}>{k.name}</T>
                <T dim size={13}>{[k.subject, STAGE_LABEL[k.stage]].filter(Boolean).join(' · ')}</T>
              </View>
              <Icon name="forward" size={18} color={c.ink3} />
            </PressScale>
            {sections.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {sections.map(({ s, n }) => (
                  <PressScale key={s.id} onPress={() => router.push(`/section/${s.id}`)} scaleTo={0.95} accessibilityLabel={`شعبة ${s.name}`}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 10, paddingLeft: 14, borderRadius: 18, backgroundColor: c.bg, borderWidth: 1, borderColor: c.line }}>
                    <SectionMark letter={s.name} hue={hue(k.hue)} size={34} />
                    <View>
                      <T weight="bold" size={14}>شعبة {s.name}</T>
                      <T dim size={12}>{n ? `${arDigits(n)} طالب` : 'بلا طلاب'}</T>
                    </View>
                  </PressScale>
                ))}
              </View>
            ) : (
              <Row><T dim size={13}>لا شعب — اضغط على الصف لإضافتها</T></Row>
            )}
          </Card>
        ))}
        <View style={{ height: 150 }} />
      </Screen>
      <Fab tabs title="صف جديد" onPress={() => router.push('/class/new')} />
    </View>
  );
}
