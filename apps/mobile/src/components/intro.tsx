import { KUFIC, kuficLanes, kuficPaths, KUFIC_SIZE, WORDMARK_AR } from '@nahj/shared';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing, interpolate, runOnJS, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { ClipPath, Defs, G, Line, Path, Rect } from 'react-native-svg';
import { fonts, useTheme } from '@/lib/theme';

const ARect = Animated.createAnimatedComponent(Rect);
const AG = Animated.createAnimatedComponent(G);

const L = kuficLanes();
const KP = kuficPaths();
const STEP = 26; // تأخير كل خطوة في «سريان الحبر» (ملّي ثانية)
const CELL_MS = 300; // مدة نموّ الخلية الواحدة

interface Cell { x: number; y: number; w: number; h: number; delay: number }

/**
 * ترتيب «الكتابة»: الحبر يسري من رأس النون عبر الخلايا المتصلة (بحث بالعرض)، فتُرسم الحروف
 * كأن القلم يمشي: النون، ثم خط القاعدة، فالهاء والجيم، وأخيراً ذيل الجيم تحت الكلمة كلها.
 */
function buildCells(): { cells: Cell[]; dot: Cell; last: number } {
  const rows = KUFIC;
  const ink = (x: number, y: number) => rows[y]?.[x] === '#';
  // البداية: أعلى خلية حبر في العمود الأيمن (رأس النون)
  let start: [number, number] = [rows[0].length - 1, 0];
  for (let y = 0; y < rows.length; y++) if (ink(rows[0].length - 1, y)) { start = [rows[0].length - 1, y]; break; }
  const dist = new Map<string, number>();
  const q: [number, number][] = [start];
  dist.set(start.join(), 0);
  while (q.length) {
    const [x, y] = q.shift()!;
    const d = dist.get(`${x},${y}`)!;
    for (const [dx, dy] of [[0, 1], [-1, 0], [1, 0], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (ink(nx, ny) && !dist.has(`${nx},${ny}`)) { dist.set(`${nx},${ny}`, d + 1); q.push([nx, ny]); }
    }
  }
  const cells: Cell[] = [];
  let dot: Cell = { x: 0, y: 0, w: 0, h: 0, delay: 0 };
  const maxD = Math.max(...dist.values());
  let last = 0;
  rows.forEach((r, y) => [...r].forEach((ch, x) => {
    const geo = { x: L.x[x], y: L.y[y], w: L.x[x + 1] - L.x[x], h: L.y[y + 1] - L.y[y] };
    if (ch === 'o') dot = { ...geo, delay: 0 };
    if (ch !== '#') return;
    // نقطة الجيم غير متصلة: تُنقط بعد اكتمال الحروف كما يفعل الخطاط
    const d = dist.get(`${x},${y}`);
    const delay = (d ?? maxD + 3) * STEP;
    last = Math.max(last, delay);
    cells.push({ ...geo, delay });
  }));
  return { cells, dot, last: last + CELL_MS };
}
const PLAN = buildCells();

function InkCell({ cell, t, color }: { cell: Cell; t: SharedValue<number>; color: string }) {
  // تداخل بسيط بين الخلايا حتى لا يظهر خط فاصل أثناء النمو
  const o = 0.03;
  const props = useAnimatedProps(() => {
    const p = Math.min(1, Math.max(0, (t.value - cell.delay) / CELL_MS));
    const e = 1 - Math.pow(1 - p, 3);
    const w = (cell.w + o * 2) * e;
    const h = (cell.h + o * 2) * e;
    return { x: cell.x + cell.w / 2 - w / 2, y: cell.y + cell.h / 2 - h / 2, width: w, height: h };
  });
  return <ARect animatedProps={props} fill={color} />;
}

/**
 * حركة شعار «نَهج» عند الفتح (~٢٫٤ ثانية):
 * ١. تظهر شبكة السجل خافتة  ٢. الحبر يسري خلية خلية من رأس النون فيكتب «نهج» بالكوفي
 * ٣. تسقط نقطة النون الذهبية بارتداد ونبضة ضوء  ٤. تختفي الشبكة وتُكتب «نَهج» من اليمين وتحتها الشعار
 * ٥. خروج ناعم. كلها على خيط الواجهة (لا تتقطع أثناء التحميل)، والضغط يتخطاها.
 */
export function Intro({ ready = true, onDone }: { ready?: boolean; onDone: () => void }) {
  const { c, dark } = useTheme();
  const grid = useSharedValue(0);
  const t = useSharedValue(0);
  const dotY = useSharedValue(-3);
  const dotS = useSharedValue(0);
  const glow = useSharedValue(0);
  const write = useSharedValue(0);
  const tag = useSharedValue(0);
  const exit = useSharedValue(0);
  const [animDone, setAnimDone] = useState(false);
  const started = useRef(false);
  const leaving = useRef(false);

  const start = (instant = false) => {
    if (started.current && !instant) return;
    started.current = true;
    const out = Easing.out(Easing.cubic);
    if (instant) {
      grid.value = 0; t.value = PLAN.last; dotY.value = 0; dotS.value = 1; write.value = 1; tag.value = 1;
      setAnimDone(true);
      return;
    }
    grid.value = withSequence(withTiming(1, { duration: 260 }), withDelay(PLAN.last + 260, withTiming(0, { duration: 380 })));
    t.value = withDelay(160, withTiming(PLAN.last, { duration: PLAN.last, easing: Easing.linear }));
    const dotAt = 160 + PLAN.last - 60;
    dotS.value = withDelay(dotAt, withTiming(1, { duration: 90 }));
    dotY.value = withDelay(dotAt, withSpring(0, { damping: 9, stiffness: 210, mass: 0.6 }));
    glow.value = withDelay(dotAt + 140, withSequence(withTiming(1, { duration: 160 }), withTiming(0, { duration: 520, easing: out })));
    write.value = withDelay(dotAt + 220, withTiming(1, { duration: 620, easing: Easing.bezier(0.33, 0, 0.15, 1) }));
    tag.value = withDelay(dotAt + 640, withTiming(1, { duration: 380, easing: out }, (fin) => { if (fin) runOnJS(setAnimDone)(true); }));
  };

  // نخفي شاشة البداية الأصلية عند أول إطار، ونبدأ بعد اختفائها فعلاً (حتى لا يفوت المدرّسَ أولُها)
  const onFirstLayout = () => {
    SplashScreen.hideAsync().catch(() => {}).finally(() => setTimeout(() => start(), 120));
  };
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((r) => { if (r) start(true); }).catch(() => {});
    const safety = setTimeout(() => start(), 900);
    return () => clearTimeout(safety);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!animDone || !ready || leaving.current) return;
    leaving.current = true;
    exit.value = withDelay(300, withTiming(1, { duration: 360, easing: Easing.inOut(Easing.cubic) }, (fin) => { if (fin) runOnJS(onDone)(); }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animDone, ready]);

  const gridProps = useAnimatedProps(() => ({ opacity: grid.value * 0.55 }));
  // بعد اكتمال الكتابة: الشكل المصمت فوق الخلايا (بلا أي فواصل بينها)
  const solidProps = useAnimatedProps(() => ({ opacity: t.value >= PLAN.last - 1 ? 1 : 0 }));
  const dotProps = useAnimatedProps(() => {
    const s = dotS.value;
    const w = PLAN.dot.w * s, h = PLAN.dot.h * s;
    return { x: PLAN.dot.x + PLAN.dot.w / 2 - w / 2, y: PLAN.dot.y + PLAN.dot.h / 2 - h / 2 + dotY.value, width: w, height: h };
  });
  const glowProps = useAnimatedProps(() => {
    const k = 1 + (1 - glow.value) * 1.4;
    const w = PLAN.dot.w * k, h = PLAN.dot.h * k;
    return { x: PLAN.dot.x + PLAN.dot.w / 2 - w / 2, y: PLAN.dot.y + PLAN.dot.h / 2 - h / 2, width: w, height: h, opacity: glow.value * 0.45 };
  });
  const markStyle = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(write.value, [0, 1], [18, 0]) }] }));
  const wordClip = useAnimatedProps(() => ({ x: WORDMARK_AR.w * (1 - write.value), width: WORDMARK_AR.w * write.value + 1 }));
  const wordStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, write.value * 3), transform: [{ translateY: interpolate(write.value, [0, 1], [8, 0]) }] }));
  const tagStyle = useAnimatedStyle(() => ({ opacity: tag.value, transform: [{ translateY: (1 - tag.value) * 6 }] }));
  const rootStyle = useAnimatedStyle(() => ({ opacity: 1 - exit.value, transform: [{ scale: 1 + exit.value * 0.05 }] }));

  const bg = dark ? '#0B1412' : '#0E3B33';
  const paper = '#F7F5F0';
  const MARK = 176;
  const WH = 46;

  return (
    <Animated.View onLayout={onFirstLayout} style={[StyleSheet.absoluteFill, { backgroundColor: bg, alignItems: 'center', justifyContent: 'center', zIndex: 100 }, rootStyle]}>
      <Pressable onPress={() => start(true)} style={{ alignItems: 'center' }} accessibilityRole="button" accessibilityLabel="تخطي حركة الشعار">
        <Animated.View style={markStyle}>
          <Svg width={MARK} height={MARK} viewBox={`-0.4 -0.4 ${KUFIC_SIZE + 0.8} ${KUFIC_SIZE + 0.8}`}>
            <AG animatedProps={gridProps}>
              {L.x.map((x, i) => <Line key={`x${i}`} x1={x} y1={L.y[0]} x2={x} y2={L.y[L.y.length - 1]} stroke="#FFFFFF" strokeWidth={0.025} opacity={0.35} />)}
              {L.y.map((y, i) => <Line key={`y${i}`} x1={L.x[0]} y1={y} x2={L.x[L.x.length - 1]} y2={y} stroke="#FFFFFF" strokeWidth={0.025} opacity={0.35} />)}
            </AG>
            {PLAN.cells.map((cell, i) => <InkCell key={i} cell={cell} t={t} color={paper} />)}
            <AG animatedProps={solidProps}><Path d={KP.ink} fill={paper} /></AG>
            <ARect animatedProps={glowProps} fill={c.gold} />
            <ARect animatedProps={dotProps} fill={c.gold} />
          </Svg>
        </Animated.View>

        {/* الكلمة تُكتب من اليمين لليسار بقصّ متحرك */}
        <Animated.View style={[{ marginTop: 22 }, wordStyle]}>
          <Svg width={(WORDMARK_AR.w / WORDMARK_AR.h) * WH} height={WH} viewBox={`0 0 ${WORDMARK_AR.w} ${WORDMARK_AR.h}`}>
            <Defs>
              <ClipPath id="nahjWrite">
                <ARect animatedProps={wordClip} y={-10} height={WORDMARK_AR.h + 20} />
              </ClipPath>
            </Defs>
            <Path d={WORDMARK_AR.d} fill={paper} clipPath="url(#nahjWrite)" />
          </Svg>
        </Animated.View>

        <Animated.View style={[{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }, tagStyle]}>
          <View style={{ width: 7, height: 7, backgroundColor: c.gold }} />
          <Text style={{ fontFamily: fonts.medium, fontSize: 16, lineHeight: 28, color: '#AFC8C1', writingDirection: 'rtl' }}>التدريس بنهجٍ أذكى</Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}
