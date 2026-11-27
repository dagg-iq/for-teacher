/**
 * تحديث نسخة الحاسوب من داخل التطبيق: عند الفتح نسأل الموقع عن آخر نسخة،
 * وإن وُجدت أحدث: «تحديث الآن» ينزّل المثبّت ويثبّته بصمت فوق الحالية (البيانات تبقى) ثم يعيد فتح التطبيق.
 * النسخة المحمولة (بلا تثبيت) لا تُحدَّث في مكانها: نفتح رابط تنزيلها.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { arDigits, formatPercent } from '@nahj/shared';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { IS_DESKTOP } from '@/lib/config';
import { useTheme } from '@/lib/theme';
import { Icon } from './icon';
import { Sheet } from './sheet';
import { Button, T } from './ui';

export interface DesktopUpdateInfo { version: string; sizeMb: string; url: string; portable: string; isPortable: boolean; current: string }
interface Bridge {
  checkUpdate?: () => Promise<DesktopUpdateInfo | null>;
  installUpdate?: (url: string) => Promise<{ ok: boolean; error?: string }>;
  onUpdateProgress?: (cb: (p: number) => void) => () => void;
  openExternal?: (url: string) => Promise<unknown>;
}
const bridge = (): Bridge | null => (IS_DESKTOP ? ((window as unknown as { nahjDesktop?: Bridge }).nahjDesktop ?? null) : null);
const SKIP = 'nahj.desktopSkip';
const short = (v: string) => arDigits(String(v).split('.').pop() ?? v);

/** يُستعمل أيضاً من «عن نَهج» (تحقق يدوي) */
export async function checkDesktopUpdate(): Promise<DesktopUpdateInfo | null> {
  const b = bridge();
  if (!b?.checkUpdate) return null;
  return b.checkUpdate().catch(() => null);
}

export function DesktopUpdate() {
  const [info, setInfo] = useState<DesktopUpdateInfo | null>(null);
  useEffect(() => {
    if (!bridge()?.checkUpdate) return;
    const t = setTimeout(async () => {
      const u = await checkDesktopUpdate();
      if (!u) return;
      const skipped = await AsyncStorage.getItem(SKIP).catch(() => null);
      if (skipped === u.version) return;
      setInfo(u);
    }, 4000);
    return () => clearTimeout(t);
  }, []);
  if (!info) return null;
  return <DesktopUpdateSheet info={info} onClose={() => { AsyncStorage.setItem(SKIP, info.version).catch(() => {}); setInfo(null); }} />;
}

export function DesktopUpdateSheet({ info, onClose }: { info: DesktopUpdateInfo; onClose: () => void }) {
  const { c } = useTheme();
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const b = bridge();
  const install = async () => {
    if (!b) return;
    if (info.isPortable || !b.installUpdate) { b.openExternal?.(info.portable || info.url); onClose(); return; }
    setError(null);
    setProgress(0);
    const off = b.onUpdateProgress?.((p) => setProgress(p));
    const r = await b.installUpdate(info.url);
    off?.();
    if (!r.ok) { setProgress(null); setError('تعذّر التحديث. تأكد من الإنترنت وحاول مرة أخرى، أو نزّل النسخة من موقع نَهج.'); }
  };
  const busy = progress != null;
  return (
    <Sheet visible onClose={busy ? () => {} : onClose}>
      <View style={{ alignItems: 'center', gap: 10, paddingVertical: 8 }}>
        <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="download" size={26} color={c.accent} accent={c.gold} />
        </View>
        <T display size={24}>نسخة جديدة متاحة</T>
        <T dim center size={14}>
          {`النسخة ${short(info.version)} (عندك ${short(info.current)})${info.sizeMb ? ` · ${arDigits(info.sizeMb)} م.ب` : ''}. `}
          {info.isPortable ? 'أنت تستعمل النسخة المحمولة: نزّل الجديدة واستعملها بدل القديمة.' : 'تُثبَّت فوق الحالية ولا تضيع بياناتك، ثم يُعاد فتح نَهج وحده.'}
        </T>
        {busy ? (
          <View style={{ alignSelf: 'stretch', gap: 6, marginTop: 6 }}>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: c.line, overflow: 'hidden' }}>
              <View style={{ width: `${Math.round((progress ?? 0) * 100)}%`, height: 8, backgroundColor: c.accent }} />
            </View>
            <T dim center size={13}>{(progress ?? 0) >= 1 ? 'جارٍ التثبيت… سيُعاد فتح نَهج بعد لحظات' : `جارٍ التنزيل ${formatPercent((progress ?? 0) * 100)}`}</T>
          </View>
        ) : (
          <>
            <Button title={info.isPortable ? 'تنزيل النسخة الجديدة' : 'تحديث الآن'} icon="download" style={{ alignSelf: 'stretch', marginTop: 6 }} onPress={install} />
            <Button title="لاحقاً" variant="ghost" small onPress={onClose} />
          </>
        )}
        {error ? <T size={13} center color="#C8312B">{error}</T> : null}
      </View>
    </Sheet>
  );
}
