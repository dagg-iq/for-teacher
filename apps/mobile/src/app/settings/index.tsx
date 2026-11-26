/**
 * الإعدادات — مكان واحد لكل شيء، مقسّم حسب أقسام التطبيق.
 * كل قسم له صفحته (الطلاب، الدرجات، الحضور، الجدول، الطباعة)، ويُفتح أيضاً من شاشته نفسها (زر ⋮).
 */
import { isoDay, teacherTitle } from '@nahj/shared';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { router } from 'expo-router';
import { Platform, View } from 'react-native';
import { Group } from '@/components/kit';
import { Card, Divider, Header, ListItem, Row, Screen, Segmented, T } from '@/components/ui';
import { exportBackup, importBackup, setPrefs, useSettings, wipeLocal, type Backup } from '@/data/db';
import { allSections } from '@/data/queries';
import { Alert } from '@/lib/dialog';
import { saveAndShare } from '@/lib/export';
import { useTheme, type ThemeMode } from '@/lib/theme';
import { toast } from '@/lib/toast';

export default function Settings() {
  const { c, mode, setMode } = useTheme();
  const s = useSettings();
  const p = s.profile;
  const prefs = s.prefs;

  const backup = async () => {
    try {
      const data = new TextEncoder().encode(JSON.stringify(exportBackup()));
      await saveAndShare(`نسخة نَهج ${isoDay()}.json`, data, 'application/json');
      toast('حُفظت النسخة الاحتياطية', { icon: 'check' });
    } catch (e) { toast(e instanceof Error ? e.message : 'تعذّر', { tone: 'bad', icon: 'info' }); }
  };
  const restore = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', '*/*'], copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.length) return;
      const a = res.assets[0];
      const text = Platform.OS === 'web' && a.file ? await a.file.text() : await new File(a.uri).text();
      const b = JSON.parse(text) as Backup;
      Alert.alert('استعادة النسخة؟', 'تُدمج النسخة مع بياناتك الحالية: الأحدث من كل سجل يبقى، ولا يُحذف شيء.', [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'استعادة', onPress: () => { try { const n = importBackup(b); toast(`استُعيدت النسخة (${n} سجل)`, { icon: 'check' }); } catch (e) { Alert.alert('تعذّرت الاستعادة', e instanceof Error ? e.message : 'الملف غير صالح'); } } },
      ]);
    } catch (e) {
      Alert.alert('تعذّرت الاستعادة', e instanceof Error ? e.message : 'الملف غير صالح');
    }
  };
  const wipe = () => Alert.alert('مسح كل البيانات؟', 'ستُحذف كل الصفوف والطلاب والدرجات والحضور والإعدادات من هذا الجهاز. خذ نسخة احتياطية أولاً إن احتجتها.', [
    { text: 'إلغاء', style: 'cancel' },
    { text: 'مسح نهائياً', style: 'destructive', onPress: async () => { await wipeLocal(); router.replace('/welcome'); } },
  ]);
  const printFirst = allSections()[0];

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="الإعدادات" />

      <Card onPress={() => router.push('/settings/profile')} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
          <T weight="bold" size={22} color={c.accentInk}>{(p?.name ?? 'م').trim().replace(/^[إأآ]/, 'ا').charAt(0)}</T>
        </View>
        <View style={{ flex: 1 }}>
          <T weight="bold" size={17}>{p ? teacherTitle(p.name, p.gender) : 'ملفك'}</T>
          <T dim size={13} lines={1}>{[p?.subject, p?.school].filter(Boolean).join(' · ') || 'أكمل المادة والمدرسة — تظهر في الطباعة'}</T>
        </View>
        <T weight="bold" size={13} color={c.accent}>تعديل</T>
      </Card>

      <Group title="المظهر">
        <View style={{ paddingVertical: 12, gap: 8 }}>
          <T weight="bold" size={14}>الألوان</T>
          <Segmented<ThemeMode> options={[{ key: 'light', label: 'فاتح' }, { key: 'dark', label: 'داكن' }, { key: 'system', label: 'حسب الجهاز' }]} value={mode} onChange={setMode} />
        </View>
        <Divider />
        <View style={{ paddingVertical: 12, gap: 8 }}>
          <T weight="bold" size={14}>الأرقام</T>
          <Segmented options={[{ key: 'latn', label: 'إنكليزية 123' }, { key: 'arab', label: 'عربية ١٢٣' }]} value={prefs.digits ?? 'latn'}
            onChange={(v) => { if (v !== prefs.digits) setPrefs({ digits: v }); }} />
        </View>
        <Divider />
        <View style={{ paddingVertical: 12, gap: 8 }}>
          <T weight="bold" size={14}>التاريخ</T>
          <Segmented options={[{ key: 'numeric', label: 'رقمي 26/11/2026' }, { key: 'months', label: 'بأسماء الأشهر' }]} value={prefs.dateStyle ?? 'numeric'}
            onChange={(v) => { if (v !== prefs.dateStyle) setPrefs({ dateStyle: v }); }} />
          <T dim size={12}>الأرقام والتاريخ يُطبَّقان على كل التطبيق والطباعة وملفات Excel.</T>
        </View>
      </Group>

      <Group title="أقسام التطبيق">
        <ListItem icon="users" title="الطلاب والقوائم" subtitle="ترتيب الأسماء والأرقام، الغيابات في القوائم" onPress={() => router.push('/settings/students')} />
        <Divider />
        <ListItem icon="chart" title="الدرجات والإدخال الصوتي" subtitle="حد النجاح، الدرجات الحرجة، التقريب، الصوت" onPress={() => router.push('/settings/grades')} />
        <Divider />
        <ListItem icon="check-square" title="الحضور والغياب" subtitle="حد التنبيه، المجاز، القرعة" onPress={() => router.push('/settings/attendance')} />
        <Divider />
        <ListItem icon="clock" title="الجدول وأوقات الدوام" subtitle="الحصص، الفرص، التذكير قبل الحصة" onPress={() => router.push('/schedule/setup')} />
        <Divider />
        <ListItem icon="print" title="الطباعة" subtitle={printFirst ? 'القالب، الخط، الحجم، الترويسة وعلامة نَهج — مع المعاينة' : 'أضف صفاً أولاً لتجربة الطباعة'}
          onPress={printFirst ? () => router.push(`/print?kind=report&id=${printFirst.id}`) : undefined} />
      </Group>

      <Group title="البيانات">
        <ListItem icon="download" title="أخذ نسخة احتياطية" subtitle="ملف واحد فيه كل بياناتك — احفظه في Drive أو أرسله لنفسك" onPress={backup} />
        <Divider />
        <ListItem icon="upload" title="استعادة نسخة" subtitle="من ملف نسخة احتياطية سابق" onPress={restore} />
        <Divider />
        <ListItem icon="cloud" title="الحساب والمزامنة" onPress={() => router.push('/account')} />
      </Group>

      <Group>
        <ListItem icon="info" title="عن نَهج" subtitle="النسخة، التحديثات، التراخيص" onPress={() => router.push('/about')} />
      </Group>

      <Group title="منطقة الخطر">
        <ListItem icon="trash" title="مسح كل البيانات من هذا الجهاز" danger onPress={wipe} />
      </Group>
      <Row style={{ justifyContent: 'center' }}><T dim size={12}>الإعدادات تُحفظ فور تغييرها.</T></Row>
    </Screen>
  );
}
