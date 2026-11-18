import { arDigits } from '@midad/shared';
import { useKeepAwake } from 'expo-keep-awake';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Ring } from '@/components/kit';
import { tap } from '@/components/motion';
import { Button, Chip, Header, Row, Screen, T } from '@/components/ui';
import { say } from '@/lib/speech';
import { useTheme } from '@/lib/theme';

const PRESETS = [1, 2, 3, 5, 10, 15, 20, 30];

/** مؤقت الحصة: للأنشطة والاختبارات القصيرة */
export default function Timer() {
  useKeepAwake();
  const { c, tone } = useTheme();
  const [total, setTotal] = useState(5 * 60);
  const [left, setLeft] = useState(5 * 60);
  const [running, setRunning] = useState(false);
  const endAt = useRef(0);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      const l = Math.max(0, Math.round((endAt.current - Date.now()) / 1000));
      setLeft(l);
      if (l === 60 && total > 120) say('بقيت دقيقة واحدة');
      if (l <= 0) { setRunning(false); tap('success'); say('انتهى الوقت'); }
    }, 250);
    return () => clearInterval(t);
  }, [running, total]);
  const choose = (m: number) => { setRunning(false); setTotal(m * 60); setLeft(m * 60); };
  const toggle = () => {
    if (running) { setRunning(false); return; }
    const l = left > 0 ? left : total;
    setLeft(l);
    endAt.current = Date.now() + l * 1000;
    setRunning(true);
    tap('medium');
  };
  const mm = Math.floor(left / 60);
  const ss = left % 60;
  const done = left === 0;
  return (
    <Screen>
      <Header title="مؤقت الحصة" />
      <View style={{ alignItems: 'center', paddingVertical: 12 }}>
        <Ring value={(left / Math.max(1, total)) * 100} size={260} stroke={16} color={done ? tone.bad.ink : left <= 60 ? tone.warn.ink : c.accent}>
          <T display size={64} style={{ writingDirection: 'ltr' }}>{`${arDigits(mm)}:${arDigits(String(ss).padStart(2, '0'))}`}</T>
          <T dim size={14}>{done ? 'انتهى الوقت' : running ? 'جارٍ' : 'متوقف'}</T>
        </Ring>
      </View>
      <Row gap={8} style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
        {PRESETS.map((m) => <Chip key={m} label={`${arDigits(m)} د`} active={total === m * 60} onPress={() => choose(m)} />)}
      </Row>
      <Row gap={10}>
        <Button title="إعادة" icon="refresh" variant="secondary" onPress={() => { setRunning(false); setLeft(total); }} />
        <Button title={running ? 'إيقاف مؤقت' : done ? 'ابدأ من جديد' : 'ابدأ'} icon={running ? 'clock' : 'play'} style={{ flex: 1 }} onPress={toggle} />
      </Row>
    </Screen>
  );
}
