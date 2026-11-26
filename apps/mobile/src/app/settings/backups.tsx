/**
 * النسخ الاحتياطية في السحابة (Supabase Storage): نسخة يومية تلقائية + نسخة يدوية، والاستعادة بلمسة.
 */
import { formatDayDate, formatTime } from '@nahj/shared';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Group } from '@/components/kit';
import { Button, Card, Divider, Empty, Header, IconButton, ListItem, Screen, T } from '@/components/ui';
import { cloudBackupAvailable, deleteCloudBackup, listCloudBackups, restoreCloudBackup, uploadCloudBackup, type CloudBackup } from '@/data/cloud-backup';
import { useAuth } from '@/lib/auth';
import { Alert } from '@/lib/dialog';
import { arabicError } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { toast } from '@/lib/toast';

const sizeLabel = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} م.ب` : `${Math.max(1, Math.round(n / 1024))} ك.ب`);

export default function CloudBackups() {
  const { c } = useTheme();
  const { session } = useAuth();
  const uid = session?.user.id ?? null;
  const [items, setItems] = useState<CloudBackup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!uid) return;
    setError(null);
    try { setItems(await listCloudBackups(uid)); } catch (e) { setError(arabicError(e)); setItems([]); }
  }, [uid]);
  useEffect(() => { load(); }, [load]);

  if (!cloudBackupAvailable || !uid) {
    return (
      <Screen edges={['top', 'bottom']}>
        <Header title="النسخ في السحابة" />
        <Empty icon="cloud" title="سجّل الدخول أولاً" body="النسخ السحابية تُحفظ في حسابك، فتستعيدها من أي هاتف أو حاسوب."
          action={cloudBackupAvailable ? 'تسجيل الدخول' : undefined} onAction={() => router.push('/account')} />
      </Screen>
    );
  }

  const backupNow = async () => {
    setBusy('now');
    try { await uploadCloudBackup(uid); toast('حُفظت نسخة في السحابة', { icon: 'check' }); await load(); } catch (e) { Alert.alert('تعذّر الحفظ', arabicError(e)); } finally { setBusy(null); }
  };
  const restore = (b: CloudBackup) => Alert.alert('استعادة هذه النسخة؟', `نسخة ${formatDayDate(b.at)} الساعة ${formatTime(b.at)}.\nتُدمج مع بياناتك الحالية: الأحدث من كل سجل يبقى، ولا يُحذف شيء.`, [
    { text: 'إلغاء', style: 'cancel' },
    { text: 'استعادة', onPress: async () => {
      setBusy(b.path);
      try { const n = await restoreCloudBackup(b.path); toast(`استُعيدت النسخة (${n} سجل)`, { icon: 'check' }); } catch (e) { Alert.alert('تعذّرت الاستعادة', arabicError(e)); } finally { setBusy(null); }
    } },
  ]);
  const remove = (b: CloudBackup) => Alert.alert('حذف هذه النسخة؟', 'تُحذف من السحابة فقط، وبياناتك الحالية لا تتأثر.', [
    { text: 'إلغاء', style: 'cancel' },
    { text: 'حذف', style: 'destructive', onPress: async () => {
      try { await deleteCloudBackup(b.path); setItems((l) => l?.filter((x) => x.path !== b.path) ?? l); } catch (e) { Alert.alert('تعذّر الحذف', arabicError(e)); }
    } },
  ]);

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="النسخ في السحابة" subtitle="محفوظة في حسابك على Supabase" />
      <Card style={{ gap: 10 }}>
        <T size={14}>تُحفظ نسخة كاملة تلقائياً كل يوم، وتبقى آخر ٣٠ نسخة. المزامنة تحفظ آخر حالة، أما هذه فتعيدك إلى يوم سابق إن حُذف شيء بالخطأ.</T>
        <Button title="احفظ نسخة الآن" icon="upload" loading={busy === 'now'} onPress={backupNow} />
      </Card>
      {items === null ? (
        <View style={{ paddingVertical: 30 }}><ActivityIndicator color={c.accent} /></View>
      ) : error ? (
        <Empty icon="cloud-off" title="تعذّر جلب النسخ" body={error} action="إعادة المحاولة" onAction={load} />
      ) : !items.length ? (
        <Empty icon="cloud" title="لا توجد نسخ بعد" body="أول نسخة تلقائية تُحفظ بعد المزامنة، أو احفظ واحدة الآن." />
      ) : (
        <Group title={`النسخ المحفوظة (${items.length})`}>
          {items.map((b, i) => (
            <View key={b.path}>
              {i ? <Divider /> : null}
              <ListItem icon={busy === b.path ? 'refresh' : 'cloud'} title={`${formatDayDate(b.at)} · ${formatTime(b.at)}`}
                subtitle={`${b.auto ? 'تلقائية' : 'يدوية'}${b.size ? ` · ${sizeLabel(b.size)}` : ''} — المس للاستعادة`}
                onPress={busy ? undefined : () => restore(b)}
                right={<IconButton name="trash" label="حذف النسخة" size={36} color="#C8312B" onPress={() => remove(b)} />} />
            </View>
          ))}
        </Group>
      )}
    </Screen>
  );
}
