import { router, Tabs } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '@/components/icon';
import { PressScale, tap } from '@/components/motion';
import { T } from '@/components/ui';
import { useTheme } from '@/lib/theme';

const TABS: { name: string; label: string; icon: IconName }[] = [
  { name: 'index', label: 'الرئيسية', icon: 'home' },
  { name: 'classes', label: 'الصفوف', icon: 'school' },
  { name: 'grades', label: 'الدرجات', icon: 'chart' },
  { name: 'schedule', label: 'الجدول', icon: 'calendar' },
  { name: 'more', label: 'المزيد', icon: 'more' },
];

/** ارتفاع الشريط العائم + الهامش (لتترك الشاشات مكاناً تحته) */
export const TAB_BAR_SPACE = 96;

export default function TabsLayout() {
  const { c, dark } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.bg } }}
      tabBar={({ state, navigation }) => (
        <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: Math.max(insets.bottom, 12), paddingHorizontal: 14 }}>
          {/* زر الإدخال الصوتي: علامة رَصد */}
          <View pointerEvents="box-none" style={{ alignItems: 'flex-start', marginBottom: 10, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
            <PressScale onPress={() => { tap('medium'); router.push('/voice'); }} scaleTo={0.9} accessibilityRole="button" accessibilityLabel="الإدخال الصوتي"
              style={{
                width: 58, height: 58, borderRadius: 29, backgroundColor: c.gold, alignItems: 'center', justifyContent: 'center',
                shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6,
              }}>
              <Icon name="mic" size={26} color={c.goldInk} strokeWidth={2} />
            </PressScale>
          </View>
          <View style={{
            flexDirection: 'row', alignItems: 'center', backgroundColor: dark ? c.card : c.heroBg, borderRadius: 30, padding: 6,
            maxWidth: 560, width: '100%', alignSelf: 'center',
            shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8,
            borderWidth: dark ? 1 : 0, borderColor: c.line,
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
        </View>
      )}>
      {TABS.map((t) => <Tabs.Screen key={t.name} name={t.name} />)}
    </Tabs>
  );
}

/** التبويب النشط يتمدد إلى كبسولة فيها الاسم، والبقية أيقونات فقط */
function TabItem({ tab, focused, onPress }: { tab: (typeof TABS)[number]; focused: boolean; onPress: () => void }) {
  const { c, dark } = useTheme();
  const v = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    v.value = withTiming(focused ? 1 : 0, { duration: 220, easing: Easing.out(Easing.cubic) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused]);
  const grow = useAnimatedStyle(() => ({ flexGrow: 1 + v.value * 1.4 }));
  const pill = useAnimatedStyle(() => ({ opacity: v.value }));
  const idle = dark ? c.ink2 : c.heroInk2;
  return (
    <Animated.View style={[{ flexBasis: 0 }, grow]}>
      <Pressable accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={tab.label} onPress={onPress}
        style={{ height: 48, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <Animated.View style={[{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, borderRadius: 24, backgroundColor: c.accent }, pill]} />
        <Icon name={tab.icon} size={22} color={focused ? c.accentInk : idle} strokeWidth={tab.icon === 'chart' ? 2.1 : 1.9} />
        {focused ? <T size={13} weight="bold" color={c.accentInk} lines={1} style={{ lineHeight: 20 }}>{tab.label}</T> : null}
      </Pressable>
    </Animated.View>
  );
}
