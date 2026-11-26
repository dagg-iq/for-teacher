import { arDigits } from '@nahj/shared';
import { View } from 'react-native';
import { Group, Stepper, ToggleRow } from '@/components/kit';
import { Divider, Header, Row, Screen, T } from '@/components/ui';
import { setPrefs, useSettings } from '@/data/db';

/** إعدادات الحضور والغياب — تُفتح أيضاً من شاشة الحضور */
export default function AttendanceSettings() {
  const prefs = useSettings().prefs;
  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="الحضور والغياب" />
      <Group title="العدّ والتنبيه">
        <Row style={{ justifyContent: 'space-between', paddingVertical: 12 }}>
          <View style={{ flex: 1 }}>
            <T weight="bold" size={15}>حد التنبيه للغياب</T>
            <T dim size={12}>من {arDigits(prefs.absenceAlert)} غيابات يظهر الطالب بالأحمر في القوائم والتقارير والطباعة</T>
          </View>
          <Stepper value={prefs.absenceAlert} onChange={(v) => setPrefs({ absenceAlert: v })} min={1} max={30} />
        </Row>
        <Divider />
        <ToggleRow title="الإجازة تُحسب غياباً" subtitle="عند عدّ الغيابات والتنبيه (تبقى ظاهرة «مُجاز» في السجل)" value={prefs.excusedCounts} onChange={(v) => setPrefs({ excusedCounts: v })} />
        <Divider />
        <ToggleRow title="عدد الغيابات في قائمة الطلاب" value={prefs.showAbsences} onChange={(v) => setPrefs({ showAbsences: v })} />
      </Group>
      <Group title="القرعة">
        <ToggleRow title="استبعاد الغائبين اليوم" subtitle="لا تختار القرعة طالباً سُجّل غائباً اليوم" value={prefs.pickerSkipAbsent} onChange={(v) => setPrefs({ pickerSkipAbsent: v })} />
      </Group>
    </Screen>
  );
}
