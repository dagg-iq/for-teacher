import { arDigits } from '@nahj/shared';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, Share, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { Stepper, ToggleRow } from '@/components/kit';
import { tap } from '@/components/motion';
import { Button, Card, Chip, Empty, Header, Row, Screen, Segmented, T } from '@/components/ui';
import { useQuery } from '@/data/db';
import { allSections, sectionLabel, studentsOf } from '@/data/queries';
import { say } from '@/lib/speech';
import { useTheme } from '@/lib/theme';

function shuffle<T>(a: T[]): T[] {
  const x = a.slice();
  for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; }
  return x;
}

export default function Picker() {
  const sections = useQuery(() => allSections());
  const [sectionId, setSectionId] = useState<string | null>(sections[0]?.id ?? null);
  const [mode, setMode] = useState<'one' | 'groups'>('one');
  return (
    <Screen>
      <Header title="القرعة والمجموعات" />
      {!sections.length ? <Card><Empty icon="users" title="لا شعب بعد" /></Card> : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {sections.map((s) => <Chip key={s.id} label={sectionLabel(s.id, true)} active={s.id === sectionId} onPress={() => setSectionId(s.id)} />)}
          </ScrollView>
          <Segmented options={[{ key: 'one', label: 'طالب عشوائي' }, { key: 'groups', label: 'مجموعات' }]} value={mode} onChange={setMode} />
          {sectionId ? (mode === 'one' ? <One key={sectionId} sectionId={sectionId} /> : <Groups key={sectionId} sectionId={sectionId} />) : null}
        </>
      )}
    </Screen>
  );
}

function One({ sectionId }: { sectionId: string }) {
  const { c } = useTheme();
  const students = useQuery(() => studentsOf(sectionId), [sectionId]);
  const [name, setName] = useState<string | null>(null);
  const [rolling, setRolling] = useState(false);
  const [noRepeat, setNoRepeat] = useState(true);
  const [speak, setSpeak] = useState(false);
  const used = useRef<Set<string>>(new Set());
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const roll = () => {
    let pool = students.filter((s) => !noRepeat || !used.current.has(s.id));
    if (!pool.length) { used.current.clear(); pool = students; }
    if (!pool.length) return;
    setRolling(true);
    let n = 0;
    timer.current = setInterval(() => {
      setName(pool[Math.floor(Math.random() * pool.length)].name);
      tap('select');
      if (++n > 14) {
        if (timer.current) clearInterval(timer.current);
        const pick = pool[Math.floor(Math.random() * pool.length)];
        used.current.add(pick.id);
        setName(pick.name);
        setRolling(false);
        tap('success');
        scale.value = withSequence(withTiming(1.12, { duration: 120 }), withSpring(1, { damping: 8 }));
        if (speak) say(pick.name);
      }
    }, 70);
  };
  return (
    <>
      <Card tone="hero" style={{ minHeight: 200, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <Animated.View style={anim}>
          <T display size={name && name.length > 18 ? 28 : 34} color={c.heroInk} center>{name ?? 'من سيجيب؟'}</T>
        </Animated.View>
        <T size={13} color={c.heroInk2}>{noRepeat ? `بقي ${arDigits(Math.max(0, students.length - used.current.size))} لم يُختاروا` : `${arDigits(students.length)} طالب`}</T>
      </Card>
      <Button title={rolling ? '…' : 'اختر طالباً'} icon="shuffle" disabled={rolling || !students.length} onPress={roll} />
      <Card style={{ paddingVertical: 4 }}>
        <ToggleRow title="بلا تكرار" subtitle="لا يُختار الطالب مرتين حتى يأتي دور الجميع" value={noRepeat} onChange={setNoRepeat} />
        <ToggleRow title="قراءة الاسم بصوت عالٍ" value={speak} onChange={setSpeak} />
      </Card>
    </>
  );
}

function Groups({ sectionId }: { sectionId: string }) {
  const { c } = useTheme();
  const students = useQuery(() => studentsOf(sectionId), [sectionId]);
  const [count, setCount] = useState(4);
  const [groups, setGroups] = useState<string[][]>([]);
  const make = () => {
    const sh = shuffle(students.map((s) => s.name));
    const g: string[][] = Array.from({ length: Math.min(count, sh.length) }, () => []);
    sh.forEach((n, i) => g[i % g.length].push(n));
    setGroups(g);
    tap('success');
  };
  return (
    <>
      <Card style={{ gap: 10 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T weight="bold" size={15}>عدد المجموعات</T>
          <Stepper value={count} onChange={setCount} min={2} max={Math.max(2, Math.min(12, students.length))} />
        </Row>
        <T dim size={13}>حوالي {arDigits(Math.ceil(students.length / Math.max(1, count)))} طلاب في كل مجموعة</T>
      </Card>
      <Row gap={8}>
        <Button title="قسّم الشعبة" icon="shuffle" style={{ flex: 1 }} disabled={students.length < 2} onPress={make} />
        {groups.length ? <Button title="مشاركة" icon="share" variant="secondary" onPress={() => Share.share({ message: groups.map((g, i) => `المجموعة ${arDigits(i + 1)}:\n${g.join('\n')}`).join('\n\n') }).catch(() => {})} /> : null}
      </Row>
      {groups.map((g, i) => (
        <Card key={i} style={{ gap: 6 }}>
          <T weight="bold" size={16} color={c.accent}>المجموعة {arDigits(i + 1)}</T>
          {g.map((n) => <T key={n} size={14}>{n}</T>)}
        </Card>
      ))}
      <View style={{ height: 8 }} />
    </>
  );
}
