import { arDigits } from '@nahj/shared';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { toast } from '@/lib/toast';
import { useTheme } from '@/lib/theme';
import {
  applyOta, cancelDownload, checkForApk, fetchOta, installDownloaded, skipApk, startDownload, useDownload, type UpdateInfo,
} from '@/lib/updater';
import { Icon } from './icon';
import { Sheet } from './sheet';
import { Button, T } from './ui';

/**
 * يفحص بعد التشغيل بقليل:
 *  - تحديث فوري (OTA): ينزل في الخلفية، ثم نعرض «طبّق الآن» (وإلا يُطبَّق عند الفتح التالي).
 *  - نسخة APK أحدث: نعرض النافذة، والتحميل داخل التطبيق مع شريط تقدّم ثم التثبيت.
 */
export function UpdateSheet() {
  const [apk, setApk] = useState<UpdateInfo | null>(null);
  const [ota, setOta] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const t = setTimeout(() => {
      fetchOta().then((r) => { if (r === 'downloaded') setOta(true); }).catch(() => {});
      checkForApk().then((u) => u && setApk(u)).catch(() => {});
    }, 5000);
    return () => clearTimeout(t);
  }, []);

  if (apk) return <ApkSheet info={apk} onClose={() => { skipApk(apk.version); setApk(null); }} />;
  return (
    <Sheet visible={ota} onClose={() => setOta(false)}>
      <View style={{ alignItems: 'center', gap: 10, paddingVertical: 8 }}>
        <Badge icon="sparkle" />
        <T display size={24}>نَهج تحدّث</T>
        <T dim center size={14}>نزل تحسين جديد في الخلفية. طبّقه الآن (ثانيتان) أو يُطبَّق وحده عند فتح التطبيق المرة القادمة.</T>
        <Button title="طبّق الآن" icon="refresh" style={{ alignSelf: 'stretch', marginTop: 6 }} onPress={() => { applyOta().catch(() => toast('تعذّر التطبيق الآن — سيُطبَّق عند الفتح القادم')); }} />
        <Button title="لاحقاً" variant="ghost" small onPress={() => setOta(false)} />
      </View>
    </Sheet>
  );
}

function Badge({ icon }: { icon: 'download' | 'sparkle' }) {
  const { c } = useTheme();
  return (
    <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={26} color={c.accent} accent={c.gold} />
    </View>
  );
}

export function ApkSheet({ info, onClose }: { info: UpdateInfo; onClose: () => void }) {
  return (
    <Sheet visible onClose={onClose}>
      <View style={{ alignItems: 'center', gap: 10, paddingVertical: 8 }}>
        <Badge icon="download" />
        <T display size={24}>نسخة جديدة متاحة</T>
        <T dim center size={14}>النسخة {arDigits(info.version)}{info.sizeMb ? ` · ${arDigits(info.sizeMb)} ميغابايت` : ''}. تُثبَّت فوق الحالية ولا تضيع بياناتك.</T>
        {info.notes ? <T size={13} center>{info.notes}</T> : null}
        <View style={{ alignSelf: 'stretch', marginTop: 6 }}><DownloadStatus info={info} /></View>
        <Button title="لاحقاً" variant="ghost" small onPress={onClose} />
      </View>
    </Sheet>
  );
}

/** زر التحميل وشريط التقدم والتثبيت (يُستعمل أيضاً في «عن التطبيق») */
export function DownloadStatus({ info }: { info: UpdateInfo }) {
  const { c, tone } = useTheme();
  const d = useDownload();
  const mine = d.version === info.version;
  if (!mine || d.status === 'idle') {
    return <Button title="تحميل التحديث" icon="download" onPress={() => startDownload(info)} />;
  }
  if (d.status === 'downloading') {
    const pct = d.total ? Math.min(1, d.received / d.total) : 0;
    return (
      <View style={{ gap: 8 }}>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: c.line, overflow: 'hidden' }}>
          <View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: `${pct * 100}%`, backgroundColor: c.accent }} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <T dim size={13}>{d.total ? `${arDigits(Math.round(pct * 100))}% · ${arDigits((d.received / 1048576).toFixed(1))} من ${arDigits((d.total / 1048576).toFixed(1))} ميغا` : 'جارٍ التحميل…'}</T>
          <Button title="إلغاء" small variant="ghost" onPress={cancelDownload} />
        </View>
      </View>
    );
  }
  if (d.status === 'error') {
    return (
      <View style={{ gap: 6 }}>
        <T size={13} color={tone.bad.ink} center>{d.error ?? 'تعذّر التحميل'}</T>
        <Button title="إعادة المحاولة" icon="refresh" onPress={() => startDownload(info)} />
      </View>
    );
  }
  return <Button title="تثبيت الآن" icon="check" onPress={() => installDownloaded(info.version).catch((e) => toast(e instanceof Error ? e.message : 'تعذّر فتح التثبيت'))} />;
}
