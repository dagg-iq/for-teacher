import { arDigits, COMMON_SUBJECTS, GOVERNORATES, isoDay, type TeacherProfile } from '@nahj/shared';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { Group, ToggleRow } from '@/components/kit';
import { Button, Chip, Divider, Field, Header, ListItem, Row, Screen, Segmented, T } from '@/components/ui';
import { exportBackup, importBackup, setSettings, useSettings, wipeLocal, type Backup } from '@/data/db';
import { Alert } from '@/lib/dialog';
import { saveAndShare } from '@/lib/export';
import { ensurePermission, rescheduleAll } from '@/lib/notify';
import { useTheme, type ThemeMode } from '@/lib/theme';
import { toast } from '@/lib/toast';

export default function Settings() {
  const { mode, setMode } = useTheme();
  const s = useSettings();
  const p = s.profile;
  const prefs = s.prefs;
  const [form, setForm] = useState<TeacherProfile>(p ?? { name: '', school: '', subject: '', governorate: 'بغداد', gender: 'm' });
  const dirty = JSON.stringify(form) !== JSON.stringify(p);
  const set = <K extends keyof TeacherProfile>(k: K, v: TeacherProfile[K]) => setForm((f) => ({ ...f, [k]: v }));

  const backup = async () => {
    try {
      const data = new TextEncoder().encode(JSON.stringify(exportBackup()));
      await saveAndShare(`نسخة نَهج ${isoDay()}.json`, data, 'application/json');
    } catch (e) { toast(e instanceof Error ? e.message : 'تعذّر', { tone: 'bad' }); }
  };
  const restore = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', '*/*'], copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.length) return;
      const a = res.assets[0];
      const text = Platform.OS === 'web' && a.file ? await a.file.text() : await new File(a.uri).text();
      const n = importBackup(JSON.parse(text) as Backup);
      toast(`استُعيدت النسخة (${n} سجل)`, { icon: 'check' });
    } catch (e) {
      Alert.alert('تعذّرت الاستعادة', e instanceof Error ? e.message : 'الملف غير صالح');
    }
  };
  const wipe = () => Alert.alert('مسح كل البيانات؟', 'ستُحذف كل الصفوف والطلاب والدرجات من هذا الهاتف. خذ نسخة احتياطية أولاً إن احتجتها.', [
    { text: 'إلغاء', style: 'cancel' },
    { text: 'مسح', style: 'destructive', onPress: async () => { await wipeLocal(); router.replace('/welcome'); } },
  ]);

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="الإعدادات" />

      <Group title="ملفك (يظهر في الطباعة)">
        <View style={{ gap: 12, paddingVertical: 12 }}>
          <Field label="الاسم" value={form.name} onChangeText={(v) => set('name', v)} />
          <Segmented options={[{ key: 'm', label: 'أستاذ' }, { key: 'f', label: 'ست' }]} value={form.gender} onChange={(v) => set('gender', v)} />
          <Field label="المادة" value={form.subject} onChangeText={(v) => set('subject', v)} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {COMMON_SUBJECTS.slice(0, 10).map((x) => <Chip key={x} small label={x} active={form.subject === x} onPress={() => set('subject', x)} />)}
          </ScrollView>
          <Field label="المدرسة" value={form.school} onChangeText={(v) => set('school', v)} />
          <Field label="اسم مدير المدرسة (للتوقيع)" value={form.principal ?? ''} onChangeText={(v) => set('principal', v)} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {GOVERNORATES.map((g) => <Chip key={g} small label={g} active={form.governorate === g} onPress={() => set('governorate', g)} />)}
          </ScrollView>
          <Button title="حفظ الملف" icon="check" disabled={!dirty || form.name.trim().length < 2} onPress={() => { setSettings({ profile: { ...form, name: form.name.trim() } }); toast('حُفظ', { icon: 'check' }); }} />
        </View>
      </Group>

      <Group title="المظهر">
        <View style={{ paddingVertical: 12 }}>
          <Segmented<ThemeMode> options={[{ key: 'system', label: 'تلقائي' }, { key: 'light', label: 'فاتح' }, { key: 'dark', label: 'داكن' }]} value={mode} onChange={setMode} />
        </View>
      </Group>

      <Group title="القوائم والدرجات">
        <View style={{ paddingVertical: 12, gap: 8 }}>
          <T weight="bold" size={14}>شكل الأرقام</T>
          <Segmented options={[{ key: 'latn', label: 'إنكليزية 123' }, { key: 'arab', label: 'عربية ١٢٣' }]} value={prefs.digits ?? 'latn'}
            onChange={(v) => { if (v === prefs.digits) return; setSettings({ prefs: { ...prefs, digits: v } }); setTimeout(() => router.push('/settings'), 60); }} />
          <T dim size={12}>تُطبَّق على كل التطبيق والطباعة وملفات Excel.</T>
        </View>
        <Divider />
        <View style={{ paddingVertical: 12, gap: 8 }}>
          <T weight="bold" size={14}>ترتيب الطلاب</T>
          <Segmented options={[{ key: 'alpha', label: 'أبجدي' }, { key: 'number', label: 'حسب التسلسل' }]} value={prefs.studentOrder} onChange={(v) => setSettings({ prefs: { ...prefs, studentOrder: v } })} />
        </View>
      </Group>

      <Group title="الإدخال الصوتي">
        <View style={{ paddingVertical: 12, gap: 8 }}>
          <T weight="bold" size={14}>مؤقت التأكيد</T>
          <Row gap={8}>
            {[0, 2, 3, 5].map((x) => <Chip key={x} label={x ? `${arDigits(x)} ث` : 'يدوي'} active={prefs.voiceConfirm === x} onPress={() => setSettings({ prefs: { ...prefs, voiceConfirm: x } })} />)}
          </Row>
        </View>
        <Divider />
        <ToggleRow title="الانتقال للطالب التالي تلقائياً" value={prefs.voiceAdvance} onChange={(v) => setSettings({ prefs: { ...prefs, voiceAdvance: v } })} />
      </Group>

      <Group title="الإشعارات">
        <ToggleRow title="تذكير قبل كل حصة" subtitle="مدة التذكير من «أوقات الدوام»" value={prefs.classReminders}
          onChange={async (v) => { setSettings({ prefs: { ...prefs, classReminders: v } }); if (v) await ensurePermission(true); rescheduleAll(true).catch(() => {}); }} />
        <Divider />
        <ListItem icon="clock" title="أوقات الدوام" onPress={() => router.push('/schedule/setup')} />
      </Group>

      <Group title="النسخ الاحتياطي">
        <ListItem icon="download" title="أخذ نسخة احتياطية" subtitle="ملف واحد فيه كل بياناتك — احفظه في Drive أو أرسله لنفسك" onPress={backup} />
        <Divider />
        <ListItem icon="upload" title="استعادة نسخة" subtitle="من ملف نسخة احتياطية سابق" onPress={restore} />
      </Group>

      <Group>
        <ListItem icon="cloud" title="الحساب والمزامنة" onPress={() => router.push('/account')} />
        <Divider />
        <ListItem icon="info" title="عن نَهج" onPress={() => router.push('/about')} />
        <Divider />
        <ListItem icon="trash" title="مسح كل البيانات من الهاتف" danger onPress={wipe} />
      </Group>
    </Screen>
  );
}
