import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '@/components/icon';
import { tap } from '@/components/motion';
import { T } from '@/components/ui';
import { useTheme } from '@/lib/theme';

const TABS: { name: string; label: string; icon: IconName }[] = [
  { name: 'index', label: 'الرئيسية', icon: 'home' },
  { name: 'classes', label: 'الصفوف', icon: 'school' },
  { name: 'grades', label: 'الدرجات', icon: 'chart' },
  { name: 'schedule', label: 'الجدول', icon: 'calendar' },
  { name: 'more', label: 'المزيد', icon: 'apps' },
];


export default function TabsLayout() {
  const { c, dark } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.bg } }}
      tabBar={({ state, navigation }) => (
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
