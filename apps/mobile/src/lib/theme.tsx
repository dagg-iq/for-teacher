import AsyncStorage from '@react-native-async-storage/async-storage';
import { classHues, palette, toneColors, type ThemeColors, type TonePalette } from '@nahj/shared';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme, type ViewStyle } from 'react-native';

export type ThemeMode = 'system' | 'light' | 'dark';

export const fonts = {
  regular: 'Sans',
  medium: 'SansMedium',
  bold: 'SansBold',
  black: 'SansBlack',
  display: 'DisplayBlack',
  displayBold: 'DisplayBold',
  serif: 'SerifText',
  serifBold: 'SerifTextBold',
} as const;

export const fontAssets = {
  Sans: require('../../assets/fonts/thmanyahsans-Regular.otf'),
  SansMedium: require('../../assets/fonts/thmanyahsans-Medium.otf'),
  SansBold: require('../../assets/fonts/thmanyahsans-Bold.otf'),
  SansBlack: require('../../assets/fonts/thmanyahsans-Black.otf'),
  DisplayBlack: require('../../assets/fonts/thmanyahserifdisplay-Black.otf'),
  DisplayBold: require('../../assets/fonts/thmanyahserifdisplay-Bold.otf'),
  SerifText: require('../../assets/fonts/thmanyahseriftext-Regular.otf'),
  SerifTextBold: require('../../assets/fonts/thmanyahseriftext-Bold.otf'),
};

interface ThemeValue {
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  dark: boolean;
  c: ThemeColors;
  tone: TonePalette;
  /** لون تمييز الصف */
  hue: (i: number | null | undefined) => string;
  /** سطح البطاقة: ظل ناعم في الفاتح، وحد رفيع في الداكن */
  surface: ViewStyle;
}

const Ctx = createContext<ThemeValue | null>(null);
const KEY = 'nahj.theme';

/** المظهر المحفوظ يُقرأ قبل رسم أول شاشة (فلا تومض الشاشة بالفاتح ثم الداكن) */
let initialMode: ThemeMode = 'light';
export async function loadThemeMode() {
  try {
    const v = await AsyncStorage.getItem(KEY);
    if (v === 'light' || v === 'dark' || v === 'system') initialMode = v;
  } catch { /* الافتراضي: فاتح */ }
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  // الافتراضي عند التثبيت: الفاتح دائماً (لا يتبع النظام إلا إن اختار المدرّس «تلقائي»)
  const [mode, setModeState] = useState<ThemeMode>(initialMode);

  const value = useMemo<ThemeValue>(() => {
    const dark = mode === 'dark' || (mode === 'system' && system === 'dark');
    return {
      mode,
      setMode: (m) => {
        setModeState(m);
        AsyncStorage.setItem(KEY, m).catch(() => {});
      },
      dark,
      c: dark ? palette.dark : palette.light,
      tone: dark ? toneColors.dark : toneColors.light,
      surface: { borderWidth: 1, borderColor: dark ? palette.dark.line : palette.light.line },
      hue: (i) => {
        const h = classHues[Math.abs(i ?? 0) % classHues.length];
        return dark ? h.dark : h.light;
      },
    };
  }, [mode, system]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTheme outside provider');
  return v;
}
