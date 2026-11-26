/**
 * الشريط الجانبي للشاشات العريضة (الحاسوب/التابلت): الهوية، التنقل، الأدوات، وملف المدرّس.
 * يُرسم في التخطيط الجذري فيبقى ظاهراً في كل الشاشات (الحضور، التقارير، السجل…) لا في التبويبات فقط.
 */
import { router, useSegments } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { useSettings } from '@/data/db';
import { useTheme } from '@/lib/theme';
import { tap } from './motion';
import { Icon, LogoMark, Wordmark, type IconName } from './icon';
import { T } from './ui';

const MAIN: { key: string; label: string; icon: IconName; href: string }[] = [
  { key: 'index', label: 'الرئيسية', icon: 'home', href: '/' },
  { key: 'classes', label: 'الصفوف', icon: 'school', href: '/classes' },
  { key: 'grades', label: 'الدرجات', icon: 'chart', href: '/grades' },
  { key: 'schedule', label: 'الجدول', icon: 'calendar', href: '/schedule' },
  { key: 'more', label: 'المزيد', icon: 'apps', href: '/more' },
];

const TOOLS: { key: string; label: string; icon: IconName; href: string }[] = [
  { key: 'attendance', label: 'الحضور والغياب', icon: 'check-square', href: '/attendance' },
  { key: 'reports', label: 'التقارير', icon: 'pie', href: '/reports' },
  { key: 'plans', label: 'التحضير اليومي', icon: 'clipboard', href: '/plans' },
  { key: 'tasks', label: 'المهام والتقويم', icon: 'flag', href: '/tasks' },
  { key: 'picker', label: 'القرعة والمجموعات', icon: 'shuffle', href: '/picker' },
  { key: 'timer', label: 'مؤقت الحصة', icon: 'timer', href: '/timer' },
];

/** أي عنصر يُضاء حسب الشاشة الحالية (شاشة الطالب تتبع «الصفوف»، السجل يتبع «الدرجات»…) */
function activeKey(segments: string[]): string {
  const [a, b] = segments;
  if (a === '(tabs)') return b ?? 'index';
  if (a === 'section' || a === 'class' || a === 'student') return 'classes';
  if (a === 'book' || a === 'voice') return 'grades';
  if (a === 'schedule') return 'schedule';
  if (a === 'settings' || a === 'account' || a === 'about' || a === 'licenses') return 'settings';
  return a ?? 'index';
}

export function Sidebar() {
  const { c } = useTheme();
  const p = useSettings().profile;
  const active = activeKey(useSegments() as string[]);
  const go = (key: string, href: string) => {
    if (key === active) return;
    tap('select');
    router.navigate(href as never);
  };
  return (
    <View style={{ width: 250, backgroundColor: c.card, borderStartWidth: 1, borderStartColor: c.line, paddingTop: 22, paddingBottom: 14, paddingHorizontal: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8, paddingBottom: 16 }}>
        <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: '#0E3B33', alignItems: 'center', justifyContent: 'center' }}>
          <LogoMark size={28} ink="#F7F5F0" dot={c.gold} />
        </View>
        <View style={{ gap: 2 }}>
          <Wordmark height={24} color={c.ink} />
          <T size={11} dim>التدريس بنهجٍ أذكى</T>
        </View>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 4 }} showsVerticalScrollIndicator={false}>
        {MAIN.map((t) => <Item key={t.key} icon={t.icon} label={t.label} focused={active === t.key} onPress={() => go(t.key, t.href)} />)}
        <View style={{ height: 1, backgroundColor: c.line, marginVertical: 10, marginHorizontal: 8 }} />
        <T size={11} weight="bold" dim style={{ paddingHorizontal: 12, paddingBottom: 4 }}>الأدوات</T>
        {TOOLS.map((t) => <Item key={t.key} icon={t.icon} label={t.label} focused={active === t.key} onPress={() => go(t.key, t.href)} />)}
      </ScrollView>
      <Pressable onPress={() => go('settings', '/settings')} accessibilityRole="button" accessibilityLabel="الإعدادات"
        style={(st) => { const hovered = (st as { hovered?: boolean }).hovered; return ({ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 16, borderWidth: 1, borderColor: active === 'settings' ? c.accent : c.line, backgroundColor: hovered || active === 'settings' ? c.soft : c.bg }); }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
          <T weight="bold" size={15} color={c.accentInk}>{(p?.name ?? 'ن').trim().replace(/^[إأآ]/, 'ا').charAt(0)}</T>
        </View>
        <View style={{ flex: 1 }}>
          <T weight="bold" size={13} lines={1}>{p?.name ?? 'ملفك'}</T>
          <T dim size={11} lines={1}>{p?.school || p?.subject || 'الإعدادات'}</T>
        </View>
        <Icon name="settings" size={18} color={c.ink2} />
      </Pressable>
    </View>
  );
}

function Item({ icon, label, focused, onPress }: { icon: IconName; label: string; focused?: boolean; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable accessibilityRole="tab" accessibilityState={{ selected: !!focused }} accessibilityLabel={label} onPress={onPress}
      style={(st) => { const hovered = (st as { hovered?: boolean }).hovered; return ({ height: 44, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12,
        backgroundColor: focused ? c.soft : hovered ? c.bg : 'transparent' }); }}>
      <Icon name={icon} size={21} color={focused ? c.accent : c.ink2} accent={focused ? c.gold : undefined} />
      <T size={14} weight={focused ? 'bold' : 'medium'} color={focused ? c.accent : c.ink} style={{ flex: 1 }}>{label}</T>
      {focused ? <View style={{ width: 6, height: 6, backgroundColor: c.gold }} /> : null}
    </Pressable>
  );
}
