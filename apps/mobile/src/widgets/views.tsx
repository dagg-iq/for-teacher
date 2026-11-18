'use no memo'; // الويدجتات دوال خام: مترجم React يكسرها
import { arDigits, DAY_NAMES, dayPlan, formatClock, periodName } from '@rasd/shared';
import { FlexWidget, SvgWidget, TextWidget, type ColorProp } from 'react-native-android-widget';
import { FATHA_PATH, RA_PATH } from '@/components/icon';
import type { WidgetSnapshot } from './snapshot';

const F = { regular: 'thmanyahsans-Regular', bold: 'thmanyahsans-Bold', display: 'thmanyahserifdisplay-Black' };
const col = (s: string) => s as ColorProp;
// مساحة سفلية لذيل الحروف (خط ثمانية)
const tx = (font: string, size: number, color: ColorProp, extra?: object) => ({ fontFamily: font, fontSize: size, color, paddingBottom: Math.ceil(size * 0.32), ...extra });
const OPEN = (path: string) => ({ clickAction: 'OPEN_URI', clickActionData: { uri: `rasd://${path}` } });

const PAL = {
  light: { bg: '#173A33', ink: '#FFFFFF', ink2: '#B9D2CB', line: '#2A5149', gold: '#F2B544', goldInk: '#2B1E00', row: '#1F4A42' },
  dark: { bg: '#13211E', ink: '#ECF2EF', ink2: '#9AAAA5', line: '#22342F', gold: '#F5BE55', goldInk: '#2B1E00', row: '#183630' },
};

const mark = (ink: string, dot: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><path d="${RA_PATH}" fill="${ink}"/><path d="${FATHA_PATH}" stroke="${dot}" stroke-width="8" stroke-linecap="round" fill="none"/></svg>`;

/** حصص اليوم، مع تمييز الحالية أو القادمة */
export function TodayWidget({ s, mode, height }: { s: WidgetSnapshot; mode: 'light' | 'dark'; height: number }) {
  const c = PAL[mode];
  const now = new Date();
  const day = now.getDay();
  // المساحة: حشوة ٢٨ + الرأس ٢٨ + سطر «حصص أخرى» ١٨، وكل حصة ٣٤ (المنطق مختبر في dayPlan)
  const plan = dayPlan(s, now, Math.floor((height - 28 - 28 - 18) / 34));
  const rows = plan.rows;

  return (
    <FlexWidget {...OPEN('schedule')} style={{ height: 'match_parent', width: 'match_parent', backgroundColor: col(c.bg), borderRadius: 26, padding: 14, flexDirection: 'column', flexGap: 6 }}>
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: 'match_parent' }}>
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flexGap: 6 }}>
          <TextWidget text={DAY_NAMES[day]} style={tx(F.display, 16, col(c.ink))} />
          <TextWidget text="· حصص اليوم" style={tx(F.bold, 12, col(c.gold))} />
        </FlexWidget>
        <SvgWidget svg={mark(c.ink, c.gold)} style={{ width: 24, height: 24 }} />
      </FlexWidget>
      {!s.configured ? (
        <TextWidget text="افتح رَصد وأعدّ جدول حصصك" style={tx(F.regular, 13, col(c.ink2))} />
      ) : plan.state === 'off' ? (
        <TextWidget text="عطلة — لا دوام اليوم" style={tx(F.regular, 13, col(c.ink2))} />
      ) : plan.state !== 'active' ? (
        <TextWidget text={plan.state === 'done' ? 'انتهت حصص اليوم — يومك سعيد' : 'لا حصص لك اليوم'} style={tx(F.regular, 13, col(c.ink2))} />
      ) : rows.map((x) => {
        const p = s.periods[x.period];
        const on = x.period === plan.focus;
        const live = on && plan.live;
        return (
          <FlexWidget key={`${x.day}-${x.period}`} style={{ flexDirection: 'row', alignItems: 'center', width: 'match_parent', backgroundColor: col(on ? c.gold : c.row), borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4, flexGap: 8 }}>
            <TextWidget text={formatClock(p.start)} style={tx(F.bold, 12, col(on ? c.goldInk : c.ink2), { width: 40 })} />
            <TextWidget text={x.title} maxLines={1} truncate="END" style={tx(F.bold, 13, col(on ? c.goldInk : c.ink), { flex: 1 })} />
            <TextWidget text={live ? 'الآن' : on ? 'التالية' : periodName(x.period)} style={tx(F.regular, 11, col(on ? c.goldInk : c.ink2))} />
          </FlexWidget>
        );
      })}
      {plan.remaining > 0 ? <TextWidget text={plan.remaining === 1 ? '+ حصة أخرى بعدها' : `+${arDigits(plan.remaining)} حصص أخرى بعدها`} style={tx(F.regular, 11, col(c.ink2))} /> : null}
    </FlexWidget>
  );
}
