import { arDigits, countSections, defaultBoost, formatPercent } from '@nahj/shared';
import { View } from 'react-native';
import { Group, Stepper, ToggleRow } from '@/components/kit';
import { Button, Chip, Divider, Header, Row, Screen, Segmented, T } from '@/components/ui';
import { all, setPrefs, useSettings } from '@/data/db';
import { applyGradeRules } from '@/data/grades';
import { Alert } from '@/lib/dialog';
import { toast } from '@/lib/toast';

/** إعدادات الدرجات والإدخال الصوتي — مكانها الوحيد، وتُفتح من تبويب الدرجات أيضاً */
export default function GradeSettings() {
  const prefs = useSettings().prefs;
  const pass = prefs.passMark ?? 50;
  const below = prefs.criticalBelow ?? 3;
  const ex = defaultBoost(100, pass, below || 3);

  const apply = () => {
    const books = all('gradebooks').filter((b) => !b.archived);
    if (!books.length) { toast('لا سجلات بعد', { icon: 'info' }); return; }
    const sections = new Set(books.map((b) => b.section_id)).size;
    Alert.alert('تطبيق على السجلات الحالية؟', `يصبح حد النجاح ${formatPercent(pass)} ${below ? `وتنبيه الحرجة ${arDigits(below)} درجات تحته` : 'بلا تنبيه للحرجة'} في ${arDigits(books.length)} سجلاً (${countSections(sections)}). الدرجات نفسها لا تتغير — فقط الحكم ناجح/راسب والتنبيه.`, [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'تطبيق', onPress: () => { applyGradeRules(books, { pass, below }); toast('طُبّقت على السجلات', { icon: 'check' }); } },
    ]);
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="الدرجات" subtitle="القيم الافتراضية للسجلات الجديدة، ويمكن تطبيقها على الحالية" />

      <Group title="النجاح">
        <Row style={{ justifyContent: 'space-between', paddingVertical: 12 }}>
          <View style={{ flex: 1 }}>
            <T weight="bold" size={15}>حد النجاح</T>
            <T dim size={12}>{arDigits('نسبة من الدرجة العظمى (50 من 100، 5 من 10)')}</T>
          </View>
          <Stepper value={pass} onChange={(v) => setPrefs({ passMark: v })} min={30} max={80} format={(v) => formatPercent(v)} />
        </Row>
      </Group>

      <Group title="الدرجات الحرجة">
        <ToggleRow title="نبّهني بالدرجات القريبة من النجاح" subtitle="في السعي والنتيجة: تُعرض عليك لتقرر رفعها إلى حد النجاح — لا يتغير شيء بدون موافقتك"
          value={below > 0} onChange={(v) => setPrefs({ criticalBelow: v ? 3 : 0 })} />
        {below > 0 ? (
          <>
            <Divider />
            <Row style={{ justifyContent: 'space-between', paddingVertical: 12 }}>
              <View style={{ flex: 1 }}>
                <T weight="bold" size={15}>المدى تحت النجاح</T>
                <T dim size={12}>من {arDigits(100)}: الدرجات {arDigits(ex.from)}–{arDigits(Math.ceil(ex.to) - 1)} تُعرض لترفع إلى {arDigits(ex.to)}</T>
              </View>
              <Stepper value={below} onChange={(v) => setPrefs({ criticalBelow: v })} min={1} max={10} />
            </Row>
          </>
        ) : null}
        <Divider />
        <ToggleRow title="إظهار التنبيه في الرئيسية والدرجات" value={prefs.criticalAlerts} onChange={(v) => setPrefs({ criticalAlerts: v })} />
      </Group>

      <Group title="الحساب والعرض">
        <View style={{ paddingVertical: 12, gap: 8 }}>
          <T weight="bold" size={15}>تقريب السعي والنتيجة</T>
          <Segmented options={[{ key: 'int', label: 'عدد صحيح' }, { key: '1dp', label: 'منزلة عشرية' }, { key: 'none', label: 'بلا تقريب' }]} value={prefs.rounding ?? 'int'} onChange={(v) => setPrefs({ rounding: v })} />
          <T dim size={12}>للسجلات الجديدة. «عدد صحيح» يقرّب {arDigits('49.5')} إلى {arDigits(50)} كما في السجلات المدرسية.</T>
        </View>
        <Divider />
        <View style={{ paddingVertical: 12, gap: 8 }}>
          <T weight="bold" size={15}>متى تظهر نسبة النجاح لسجل؟</T>
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            {[0, 25, 50, 75, 100].map((x) => <Chip key={x} label={x ? `بعد ${formatPercent(x)} من الطلاب` : 'دائماً'} active={prefs.rateMinFilled === x} onPress={() => setPrefs({ rateMinFilled: x })} />)}
          </Row>
          <T dim size={12}>حتى لا تظهر «نجاح {formatPercent(100)}» بعد إدخال درجة طالب واحد. العدد «أُدخل كذا من كذا» يظهر دائماً.</T>
        </View>
      </Group>

      <Button title="تطبيق النجاح والحرجة على السجلات الحالية" icon="refresh" variant="secondary" onPress={apply} />

      <Group title="الإدخال الصوتي">
        <View style={{ paddingVertical: 12, gap: 8 }}>
          <T weight="bold" size={15}>تثبيت الدرجة المسموعة</T>
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            {[0, 2, 3, 5].map((x) => <Chip key={x} label={x ? `بعد ${arDigits(x)} ث` : 'يدوياً («نعم»)'} active={prefs.voiceConfirm === x} onPress={() => setPrefs({ voiceConfirm: x })} />)}
          </Row>
          <T dim size={12}>إن لم يكن التطبيق متأكداً من الاسم يطلب تأكيدك دائماً.</T>
        </View>
        <Divider />
        <ToggleRow title="الانتقال للطالب التالي تلقائياً" subtitle="في طريقة «بالترتيب»" value={prefs.voiceAdvance} onChange={(v) => setPrefs({ voiceAdvance: v })} />
      </Group>
    </Screen>
  );
}
