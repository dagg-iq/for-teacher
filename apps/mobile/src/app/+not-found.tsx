import { router } from 'expo-router';
import { Card, Empty, Header, Screen } from '@/components/ui';

export default function NotFound() {
  return (
    <Screen>
      <Header />
      <Card><Empty icon="info" title="الصفحة غير موجودة" action="الرئيسية" onAction={() => router.replace('/')} /></Card>
    </Screen>
  );
}
