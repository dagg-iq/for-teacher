import { router, Tabs } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, LogoMark, Wordmark, type IconName } from '@/components/icon';
import { tap } from '@/components/motion';
import { T } from '@/components/ui';
import { useSettings } from '@/data/db';
import { useWide } from '@/lib/hooks';
import { useTheme } from '@/lib/theme';

const TABS: { name: string; label: string; icon: IconName }[] = [
  { name: 'index', label: 'الرئيسية', icon: 'home' },
  { name: 'classes', label: 'الصفوف', icon: 'school' },
  { name: 'grades', label: 'الدرجات', icon: 'chart' },
  { name: 'schedule', label: 'الجدول', icon: 'calendar' },
  { name: 'more', label: 'المزيد', icon: 'apps' },
];


export default function TabsLayout() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const wide = useWide();
  return (
    <Tabs
      // الشاشة العريضة (لابتوب): شريط جانبي. «left» في تخطيط من اليمين لليسار يظهر على اليمين
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.bg }, tabBarPosition: wide ? 'left' : 'bottom' }}
      tabBar={({ state, navigation }) => wide ? (
        <Sidebar active={state.routes[state.index]?.name} onGo={(name) => {
          const route = state.routes.find((r) => r.name === name);
          if (!route) return;
          const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!e.defaultPrevented) navigation.navigate(route.name);
        }} />
      ) : (
        <View style={{
          flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderTopWidth: 1, borderTopColor: c.line,
          paddingTop: 8, paddingBottom: Math.max(insets.bottom, 10), paddingHorizontal: 10, gap: 4,
        }}>
          {state.routes.map((route, i) => {
            const tab = TABS.find((t) => t.name === route.name);
            if (!tab) return null;
            const focused = state.index === i;
            return (
              <TabItem key={route.key} tab={tab} focused={focused} onPress={() => {
                if (!focused) tap('select');
                const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !e.defaultPrevented) navigation.navigate(route.name);
              }} />
            );
          })}
        </View>
      )}>
      {TABS.map((t) => <Tabs.Screen key={t.name} name={t.name} />)}
    </Tabs>
  );
}

/** التبويب النشط يتمدد إلى كبسولة فيها الاسم، والبقية أيقونات فقط */
function TabItem({ tab, focused, onPress }: { tab: (typeof TABS)[number]; focused: boolean; onPress: () => void }) {
  const { c } = useTheme();
  const v = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    v.value = withTiming(focused ? 1 : 0, { duration: 220, easing: Easing.out(Easing.cubic) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused]);
  const grow = useAnimatedStyle(() => ({ flexGrow: 1 + v.value * 1.4 }));
  const pill = useAnimatedStyle(() => ({ opacity: v.value }));
  return (
    <Animated.View style={[{ flexBasis: 0 }, grow]}>
      <Pressable accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={tab.label} onPress={onPress}
        style={{ height: 46, borderRadius: 23, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <Animated.View style={[{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, borderRadius: 23, backgroundColor: c.soft }, pill]} />
        <Icon name={tab.icon} size={22} color={focused ? c.accent : c.ink2} accent={focused ? c.gold : undefined} strokeWidth={tab.icon === 'chart' ? 2.1 : 1.85} />
        {focused ? <T size={13} weight="bold" color={c.accent} lines={1} style={{ lineHeight: 20 }}>{tab.label}</T> : null}
      </Pressable>
    </Animated.View>
  );
}

/** الشريط الجانبي للشاشات العريضة: الهوية، التنقل، اختصارات، وملف المدرّس */
function Sidebar({ active, onGo }: { active?: string; onGo: (name: string) => void }) {
  const { c } = useTheme();
  const p = useSettings().profile;
  return (
    <View style={{ width: 260, backgroundColor: c.card, borderStartWidth: 1, borderStartColor: c.line, paddingVertical: 22, paddingHorizontal: 14, gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8, paddingBottom: 18 }}>
        <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: '#0E3B33', alignItems: 'center', justifyContent: 'center' }}>
          <LogoMark size={28} ink="#F7F5F0" dot={c.gold} />
        </View>
        <View style={{ gap: 2 }}>
          <Wordmark height={24} color={c.ink} />
          <T size={11} dim>التدريس بنهجٍ أذكى</T>
        </View>
      </View>
      {TABS.map((t) => <SideItem key={t.name} icon={t.icon} label={t.label} focused={active === t.name} onPress={() => onGo(t.name)} />)}
      <View style={{ height: 1, backgroundColor: c.line, marginVertical: 12, marginHorizontal: 8 }} />
      <T size={11} weight="bold" dim style={{ paddingHorizontal: 12, paddingBottom: 4 }}>اختصارات</T>
      <SideItem icon="check-square" label="الحضور والغياب" onPress={() => router.push('/attendance')} />
      <SideItem icon="pie" label="التقارير" onPress={() => router.push('/reports')} />
      <View style={{ flex: 1 }} />
      <Pressable onPress={() => router.push('/settings')} accessibilityRole="button" accessibilityLabel="الإعدادات"
        style={(st) => { const hovered = (st as { hovered?: boolean }).hovered; return ({ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 16, borderWidth: 1, borderColor: c.line, backgroundColor: hovered ? c.soft : c.bg }); }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
          <T weight="bold" size={15} color="#FFFFFF">{(p?.name ?? 'ن').trim().charAt(0)}</T>
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

function SideItem({ icon, label, focused, onPress }: { icon: IconName; label: string; focused?: boolean; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable accessibilityRole="tab" accessibilityState={{ selected: !!focused }} accessibilityLabel={label} onPress={() => { if (!focused) tap('select'); onPress(); }}
      style={(st) => { const hovered = (st as { hovered?: boolean }).hovered; return ({ height: 46, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12,
        backgroundColor: focused ? c.soft : hovered ? c.bg : 'transparent' }); }}>
      <Icon name={icon} size={21} color={focused ? c.accent : c.ink2} accent={focused ? c.gold : undefined} />
      <T size={14} weight={focused ? 'bold' : 'medium'} color={focused ? c.accent : c.ink} style={{ flex: 1 }}>{label}</T>
      {focused ? <View style={{ width: 6, height: 6, backgroundColor: c.gold }} /> : null}
    </Pressable>
  );
}
