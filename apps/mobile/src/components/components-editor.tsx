import { arDigits, COMPONENT_PRESETS, parseNumber, type Component } from '@nahj/shared';
import { ScrollView, TextInput, View } from 'react-native';
import { Chip, IconButton, Row, T } from '@/components/ui';
import { sectionLabel } from '@/data/queries';
import { fonts, useTheme } from '@/lib/theme';

/** مكوّنات درجة الامتحان (تحريري، شفهي، إنشاء…) مع توزيعات جاهزة، والمجموع ظاهر دائماً */
export function ComponentsEditor({ value, onChange }: { value: Component[]; onChange: (v: Component[]) => void }) {
  const { c, tone } = useTheme();
  const total = value.reduce((s, x) => s + (x.max || 0), 0);
  const set = (i: number, patch: Partial<Component>) => onChange(value.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const presetKey = COMPONENT_PRESETS.find((p) => p.items.length === value.length && p.items.every((x, i) => x.name === value[i]?.name && x.max === value[i]?.max))?.key;
  return (
    <View style={{ gap: 10 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {COMPONENT_PRESETS.map((p) => <Chip key={p.key} small label={arDigits(p.label)} active={presetKey === p.key} onPress={() => onChange(p.items.map((x) => ({ ...x })))} />)}
      </ScrollView>
      <View style={{ borderRadius: 18, borderWidth: 1, borderColor: c.line, backgroundColor: c.card, overflow: 'hidden' }}>
        {value.map((x, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
            <TextInput value={x.name} onChangeText={(t) => set(i, { name: t })} placeholder="اسم الحقل (مثل التحريري)" placeholderTextColor={c.ink3}
              accessibilityLabel={`اسم الحقل ${i + 1}`}
              style={{ flex: 1, height: 42, fontFamily: fonts.medium, fontSize: 15, color: c.ink, textAlign: 'right' }} />
            <T dim size={12}>من</T>
            <TextInput value={x.max ? arDigits(x.max) : ''} onChangeText={(t) => set(i, { max: parseNumber(t) ?? 0 })} keyboardType="decimal-pad" selectTextOnFocus
              accessibilityLabel={`عظمى ${x.name || 'الحقل'}`}
              style={{ width: 64, height: 40, borderRadius: 12, borderWidth: 1, borderColor: c.line, backgroundColor: c.field, textAlign: 'center', fontFamily: fonts.bold, fontSize: 16, color: c.ink }} />
            <IconButton name="trash" label={`حذف ${x.name}`} size={34} onPress={() => onChange(value.filter((_, j) => j !== i))} />
          </View>
        ))}
        <Row style={{ justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: c.soft }}>
          <Chip small label="+ حقل" onPress={() => onChange([...value, { name: '', max: 10 }])} />
          <T weight="bold" size={14} color={total === 100 || value.length === 1 ? c.softInk : tone.warn.ink}>المجموع من {arDigits(total)}</T>
        </Row>
      </View>
    </View>
  );
}

export const validComponents = (v: Component[]) => v.length > 0 && v.every((x) => x.name.trim() && x.max > 0);

export function SectionPicker({ sections, picked, onToggle, onAll }: {
  sections: { s: { id: string }; n: number }[]; picked: string[]; onToggle: (id: string) => void; onAll: (all: boolean) => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <T weight="bold" size={14}>الشعب</T>
        <Chip small label={picked.length === sections.length ? 'إلغاء الكل' : 'الكل'} onPress={() => onAll(picked.length !== sections.length)} />
      </Row>
      <T dim size={12}>اختر أكثر من شعبة لإنشاء السجلات لكل منها دفعة واحدة.</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {sections.map(({ s, n }) => <Chip key={s.id} label={`${sectionLabel(s.id, true)} (${arDigits(n)})`} active={picked.includes(s.id)} onPress={() => onToggle(s.id)} />)}
      </View>
    </View>
  );
}
