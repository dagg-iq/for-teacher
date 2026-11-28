import {
  arDigits, countStudents, formatClock, formatDayDate, formatScore, greeting, inMinutes, nextClass, nowState, periodName,
  relativeDays, teacherTitle, TASK_KIND_LABEL, type Slot, formatPercent, DAY_NAMES } from '@nahj/shared';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View } from 'react-native';
import { AnnouncementCard } from '@/components/announcement';
import { Icon, type IconName } from '@/components/icon';
import { Pill, Ring, Stat } from '@/components/kit';
import { PressScale } from '@/components/motion';
import { Button, Card, Empty, Header, IconButton, Row, Screen, SectionTitle, T } from '@/components/ui';
import { getTimetable, useQuery, useSettings, all } from '@/data/db';
import { dashboard, sectionLabel } from '@/data/queries';
import { useSyncStatus } from '@/data/sync';
import { useNow, useWide } from '@/lib/hooks';
import { useTheme } from '@/lib/theme';

export default function Home() {
  const { c } = useTheme();
  const settings = useSettings();
  const now = useNow();
  const d = useQuery(() => dashboard());
  const sync = useSyncStatus();
  const p = settings.profile;
  const title = p ? teacherTitle(p.name, p.gender) : '';
  const insets = useSafeAreaInsets();
  const wide = useWide();

  return (
    <Screen>
      {/* السبورة: التحية والحصة الحالية مكتوبة بالطباشير (على الشاشة العريضة: بطاقة مستديرة) */}
      <View style={[{ paddingHorizontal: 20, paddingBottom: wide ? 22 : 46, backgroundColor: c.heroBg, gap: 14, overflow: 'hidden' },
        wide ? { marginTop: 8, paddingTop: 22, borderRadius: 30 } : { marginHorizontal: -20, marginTop: -(insets.top + 8), paddingTop: insets.top + 14, borderBottomLeftRadius: 34, borderBottomRightRadius: 34 }]}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flexShrink: 1 }}>
            <T size={13} color={c.gold} weight="bold">{formatDayDate(now)}</T>
            <T display size={28} color={c.heroInk} lines={1}>{greeting(now)}</T>
            {title ? <T size={15} color={c.heroInk2} weight="medium" lines={1} style={{ marginTop: -4 }}>{title}{p?.school ? ` · ${p.school}` : ''}</T> : null}
          </View>
          <Row gap={8}>
            <BandButton icon={sync.state === 'error' ? 'cloud-off' : 'cloud'} label="الحساب والمزامنة" onPress={() => router.push('/account')} />
            <BandButton icon="settings" label="الإعدادات" onPress={() => router.push('/settings')} />
          </Row>
        </Row>
        <NowCard now={now} />
      </View>
      <AnnouncementCard />

      {d.classes === 0 ? (
        <Card>
          <Empty icon="school" title="ابدأ بإضافة صفوفك" body="أضف الصف والشعب ثم أسماء الطلاب — بلصق القائمة أو من ملف Excel."
            action="إضافة صف" onAction={() => router.push('/class/new')} />
        </Card>
      ) : (
        <>
          {/* الهاتف: البطاقات تتراكب على أسفل السبورة؛ الحاسوب: تحتها مباشرة (السبورة بطاقة مستديرة) */}
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: wide ? 0 : -48 }}>
            <Stat label="الطلاب" value={d.students} icon="users" onPress={() => router.push('/classes')} />
            <Stat label="الشعب" value={d.sections} icon="grid" onPress={() => router.push('/classes')} />
          </View>
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            <Stat label="درجات حرجة" value={d.critical} icon="info" tone={d.critical ? 'warn' : undefined}
              onPress={() => (d.criticalBook ? router.push(`/book/${d.criticalBook.id}`) : router.push('/grades'))} />
            <Stat label={d.takenToday ? 'غياب اليوم' : 'الحضور لم يُسجَّل اليوم'} value={d.takenToday ? d.absentToday : '—'} icon="check-square" tone={d.absentToday ? 'warn' : undefined} onPress={() => router.push('/attendance')} />
          </View>

          <QuickActions />

          {d.last ? <LastExam d={d} /> : null}

          {d.weak.length ? (
            <>
              <SectionTitle title={`يحتاجون متابعة (${arDigits(d.weakCount)})`} action={d.weakCount > d.weak.length ? 'التقارير' : undefined} onAction={() => router.push('/reports')} />
              <Card style={{ paddingVertical: 6 }}>
                {d.weak.map((w, i) => (
                  <PressScale key={w.student.id} onPress={() => router.push(`/student/${w.student.id}`)} scaleTo={0.98}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' }}>
                      <T weight="bold" size={14} color={c.accent}>{w.student.name.trim().replace(/^[إأآ]/, 'ا').charAt(0)}</T>
                    </View>
                    <View style={{ flex: 1 }}>
                      <T weight="bold" size={15} lines={2}>{w.student.name}</T>
                      <T dim size={12} lines={1}>{sectionLabel(w.student.section_id)} · {w.book.title}</T>
                    </View>
                    <Pill label={`راسب ${formatScore(w.value)}`} tone="bad" small />
                  </PressScale>
                ))}
              </Card>
            </>
          ) : null}
        </>
      )}

      {d.tasks.length ? (
        <>
          <SectionTitle title="القادم" action="الكل" onAction={() => router.push('/tasks')} />
          <Card style={{ paddingVertical: 6 }}>
            {d.tasks.map((t, i) => (
              <PressScale key={t.id} onPress={() => router.push('/tasks')} scaleTo={0.98}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
                <Icon name={t.kind === 'exam' ? 'quiz' : t.kind === 'meeting' ? 'users' : 'flag'} size={20} color={c.accent} />
                <View style={{ flex: 1 }}>
                  <T weight="bold" size={15} lines={1}>{t.title}</T>
                  <T dim size={12}>{TASK_KIND_LABEL[t.kind]}{t.due ? ` · ${relativeDays(new Date(t.due), now)}` : ''}</T>
                </View>
              </PressScale>
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

/** بطاقة الحصة الحالية/القادمة */
function NowCard({ now }: { now: Date }) {
  const { c } = useTheme();
  const settings = useSettings();
  const slots = useQuery(() => all('slots'));
  const cfg = getTimetable();
  if (!settings.timetable) {
    return (
      <View style={{ gap: 12 }}>
        <Row>
          <Icon name="calendar" size={22} color={c.gold} />
          <T weight="bold" size={17} color={c.heroInk}>أضف جدول حصصك</T>
        </Row>
        <T size={14} color={c.heroInk2}>تعرف حصتك القادمة دائماً، ويذكّرك نَهج قبلها بدقائق.</T>
        <Button title="إعداد الجدول" small variant="secondary" onPress={() => router.push('/schedule/setup')} style={{ alignSelf: 'flex-start' }} />
      </View>
    );
  }
  const st = nowState(cfg, slots, now);
  const next = nextClass(cfg, slots, now);
  const label = (s: Slot | null) => (s?.section_id ? sectionLabel(s.section_id) : s?.label) || 'فراغ';

  let kicker = '';
  let main = '';
  let sub = '';
  let sectionId: string | null = null;
  if (st.kind === 'in') {
    kicker = `الحصة ${periodName(st.period)} الآن`;
    main = label(st.slot);
    sub = `تنتهي ${inMinutes(st.endsIn)}${st.slot?.room ? ` · ${arDigits(st.slot.room)}` : ''}`;
    sectionId = st.slot?.section_id ?? null;
  } else if (next) {
    kicker = next.dayOffset === 0 ? `حصتك القادمة — ${periodName(next.slot.period)}` : next.dayOffset === 1 ? 'أول حصة غداً' : `حصتك القادمة — ${DAY_NAMES[new Date(now.getTime() + next.dayOffset * 86400000).getDay()]}`;
    main = label(next.slot);
    const startsIn = next.dayOffset === 0 && (st.kind === 'before' || st.kind === 'between') && st.period === next.slot.period ? st.startsIn : null;
    sub = startsIn != null ? `تبدأ ${inMinutes(startsIn)}` : `الساعة ${formatClock(next.start)}`;
    if (next.slot.room) sub += ` · ${arDigits(next.slot.room)}`;
    sectionId = next.slot.section_id ?? null;
  } else {
    kicker = 'الجدول';
    main = 'لا حصص قادمة';
    sub = 'أضف حصصك في تبويب الجدول';
  }
  return (
    <PressScale onPress={() => router.push('/schedule')} scaleTo={0.98} style={{ gap: 4, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 22, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' }}>
      <Row gap={6}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.gold }} />
        <T size={13} weight="bold" color={c.gold}>{kicker}</T>
      </Row>
      <T display size={28} color={c.heroInk} lines={1}>{main}</T>
      <T size={14} color={c.heroInk2}>{sub}</T>
      {sectionId ? (
        <Row style={{ marginTop: 10 }} gap={8}>
          <HeroBtn icon="check-square" label="الحضور" onPress={() => router.push(`/attendance?section=${sectionId}`)} />
          <HeroBtn icon="chart" label="الدرجات" onPress={() => router.push({ pathname: '/grades', params: { section: sectionId! } })} />
          <HeroBtn icon="users" label="الطلاب" onPress={() => router.push(`/section/${sectionId}`)} />
        </Row>
      ) : null}
    </PressScale>
  );
}

function BandButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <PressScale onPress={onPress} scaleTo={0.9} accessibilityRole="button" accessibilityLabel={label}
      style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={20} color="#FFFFFF" />
    </PressScale>
  );
}


function HeroBtn({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <PressScale onPress={onPress} scaleTo={0.95} accessibilityRole="button" accessibilityLabel={label}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' }}>
      <Icon name={icon} size={16} color={c.heroInk} />
      <T size={13} weight="bold" color={c.heroInk}>{label}</T>
    </PressScale>
  );
}

const ACTIONS: { icon: IconName; label: string; href: string }[] = [
  { icon: 'check-square', label: 'الحضور', href: '/attendance' },
  { icon: 'chart', label: 'الدرجات', href: '/grades' },
  { icon: 'pie', label: 'التقارير', href: '/reports' },
  { icon: 'clipboard', label: 'التحضير', href: '/plans' },
  { icon: 'shuffle', label: 'القرعة', href: '/picker' },
  { icon: 'timer', label: 'مؤقت الحصة', href: '/timer' },
];

function QuickActions() {
  const { c, surface } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {ACTIONS.map((a) => (
        <PressScale key={a.href} onPress={() => router.push(a.href as never)} scaleTo={0.95} accessibilityRole="button" accessibilityLabel={a.label}
          style={{ width: '31%', flexGrow: 1, minWidth: 96, backgroundColor: c.card, borderRadius: 20, ...surface, paddingVertical: 14, alignItems: 'center', gap: 8 }}>
          <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={a.icon} size={21} color={c.accent} accent={c.gold} />
          </View>
          <T size={13} weight="bold">{a.label}</T>
        </PressScale>
      ))}
    </View>
  );
}

function LastExam({ d }: { d: ReturnType<typeof dashboard> }) {
  const { c, tone } = useTheme();
  const last = d.last!;
  const s = last.stats;
  // لا «نجاح ١٠٠٪» بعد درجة طالب واحد: النسبة تظهر بعد إدخال نسبة كافية من الطلاب (إعدادات الدرجات)
  const enough = s.total > 0 && (s.count / s.total) * 100 + 1e-9 >= (useSettings().prefs.rateMinFilled ?? 50);
  const rate = enough ? s.passRate : null;
  return (
    <>
      <SectionTitle title="آخر سجل" action="فتح" onAction={() => router.push(`/book/${last.book.id}`)} />
      <Card onPress={() => router.push(`/book/${last.book.id}`)} style={{ gap: 14 }}>
        <View>
          <T weight="bold" size={17} lines={1}>{last.book.title}</T>
          <T dim size={13}>{sectionLabel(last.book.section_id)} · {arDigits(last.column.name)}</T>
        </View>
        <Row gap={18}>
          <Ring value={rate} size={96} color={rate != null && rate < 50 ? tone.bad.ink : c.accent}>
            <T display size={22}>{rate == null ? '—' : formatPercent(rate)}</T>
            <T dim size={11} style={{ marginTop: -6 }}>نجاح</T>
          </Ring>
          <View style={{ flex: 1, gap: 8 }}>
            <Line label="المعدل" value={formatScore(s.avg)} />
            <Line label="الأعلى" value={formatScore(s.max)} />
            <Line label="الأدنى" value={formatScore(s.min)} />
            <Row gap={6}>
              <Pill label={`ناجح ${arDigits(s.passCount)}`} tone="good" small />
              <Pill label={`راسب ${arDigits(s.failCount)}`} tone="bad" small />
            </Row>
            <T dim size={12}>{s.count < s.total ? `أُدخلت درجات ${countStudents(s.count)} من ${arDigits(s.total)}` : `كل الطلاب (${arDigits(s.total)})`}</T>
          </View>
        </Row>
      </Card>
    </>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <T dim size={13}>{label}</T>
      <T weight="bold" size={15}>{value}</T>
    </Row>
  );
}
