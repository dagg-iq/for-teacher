import { arDigits } from '@nahj/shared';
import { View } from 'react-native';
import { Group, Stepper, ToggleRow } from '@/components/kit';
import { Divider, Header, Row, Screen, Segmented, T } from '@/components/ui';
import { setPrefs, useSettings } from '@/data/db';

/** إعدادات الطلاب والقوائم — تُفتح أيضاً من زر ⋮ فوق قائمة الطلاب */
export default function StudentSettings() {
  const prefs = useSettings().prefs;
  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="الطلاب والقوائم" subtitle="تنطبق على كل الشعب والسجلات والطباعة" />
      <Group title="الترتيب والأرقام">
        <View style={{ paddingVertical: 12, gap: 8 }}>
          <Segmented options={[{ key: 'alpha', label: 'أبجدي' }, { key: 'number', label: 'حسب التسلسل' }]} value={prefs.studentOrder}
            onChange={(v) => setPrefs({ studentOrder: v })} />
          <T dim size={12}>
            {prefs.studentOrder === 'alpha'
              ? 'رقم الطالب «ت» هو مكانه في القائمة أبجدياً. الطالب الجديد يأخذ مكانه حسب اسمه، فتتغير الأرقام بعده.'
              : 'الطالب الجديد يُضاف في آخر القائمة برقم جديد. يمكنك ترتيب الطلاب يدوياً من زر ⋮ فوق قائمة الشعبة.'}
          </T>
          <T dim size={12}>الرقم نفسه يظهر في القائمة وسجل الدرجات والحضور والإدخال الصوتي والطباعة وExcel.</T>
        </View>
      </Group>
      <Group title="الغيابات في القوائم">
        <ToggleRow title="عدد الغيابات بجانب الاسم" value={prefs.showAbsences} onChange={(v) => setPrefs({ showAbsences: v })} />
        <Divider />
        <Row style={{ justifyContent: 'space-between', paddingVertical: 12 }}>
          <View style={{ flex: 1 }}>
            <T weight="bold" size={15}>حد التنبيه</T>
            <T dim size={12}>من {arDigits(prefs.absenceAlert)} غيابات يظهر الطالب بالأحمر</T>
          </View>
          <Stepper value={prefs.absenceAlert} onChange={(v) => setPrefs({ absenceAlert: v })} min={1} max={30} />
        </Row>
      </Group>
    </Screen>
  );
}
