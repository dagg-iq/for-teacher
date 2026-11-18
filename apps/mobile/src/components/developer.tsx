import * as Linking from 'expo-linking';
import { Pressable, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { useTheme } from '@/lib/theme';
import { Icon, LogoMark, type IconName } from './icon';
import { T } from './ui';

/** حسابات صانع التطبيق — للتواصل والاقتراحات والإبلاغ عن الأخطاء */
export const DEVELOPER = {
  name: 'محمد حازم احمد',
  role: 'صانع نَهج',
  links: [
    { icon: 'whatsapp', label: 'واتساب', url: 'https://wa.me/9647771821250', color: '#25D366' },
    { icon: 'telegram', label: 'تلغرام', url: 'https://t.me/dagg_iq', color: '#229ED9' },
    { icon: 'instagram', label: 'إنستغرام', url: 'https://instagram.com/tiipf', color: '#E1306C' },
    { icon: 'facebook', label: 'فيسبوك', url: 'https://www.facebook.com/mohammed.al.ahmed.23957', color: '#1877F2' },
  ] as { icon: IconName; label: string; url: string; color: string }[],
};

/** خلايا الشبكة الخافتة خلف رأس البطاقة: نفس لغة الشعار (سجل ومربعات وخلية ذهبية واحدة) */
function GridBackdrop({ w = 360, h = 132 }: { w?: number; h?: number }) {
  const { c } = useTheme();
  const cell = 12;
  const gap = 6;
  const cols = Math.ceil(w / (cell + gap));
  const rows = Math.ceil(h / (cell + gap));
  const out = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      // تتلاشى الخلايا نحو اليمين حيث الاسم
      const fade = Math.max(0, 1 - x / (cols * 0.62));
      if (fade <= 0.02) continue;
      out.push(<Rect key={`${x}-${y}`} x={x * (cell + gap)} y={y * (cell + gap)} width={cell} height={cell} fill="#FFFFFF" opacity={0.045 * fade} />);
    }
  }
  return (
    <Svg width="100%" height={h} style={{ position: 'absolute', top: 0, left: 0 }} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMinYMin slice">
      {out}
      {/* خلية ذهبية واحدة — توقيع الهوية */}
      <Rect x={3 * (cell + gap)} y={2 * (cell + gap)} width={cell} height={cell} fill={c.gold} opacity={0.85} />
    </Svg>
  );
}

export function DeveloperCard() {
  const { c } = useTheme();
  return (
    <View style={{ borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: c.line, backgroundColor: c.card }}>
      <View style={{ backgroundColor: '#0E3B33', paddingHorizontal: 18, paddingTop: 18, paddingBottom: 34, minHeight: 132, justifyContent: 'center' }}>
        <GridBackdrop />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 7, height: 7, backgroundColor: c.gold }} />
              <T size={12} weight="bold" color="#E3C27A">{DEVELOPER.role}</T>
            </View>
            <T display size={26} color="#FFFFFF">{DEVELOPER.name}</T>
            <T size={13} color="#AFC8C1">صنعته ليكون أداة كل مدرّس عراقي، مجاناً.</T>
          </View>
          <View style={{ width: 60, height: 60, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
            <LogoMark size={40} ink="#F7F5F0" dot={c.gold} />
          </View>
        </View>
      </View>
      <View style={{ marginTop: -18, marginHorizontal: 12, borderRadius: 16, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Icon name="chat" size={18} color={c.accent} accent={c.gold} />
        <T size={13} weight="bold" style={{ flex: 1 }}>عندك فكرة أو وجدت خطأ؟ راسلني مباشرة</T>
      </View>
      <View style={{ padding: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {DEVELOPER.links.map((l) => (
          <Pressable key={l.url} onPress={() => Linking.openURL(l.url).catch(() => {})} accessibilityRole="link" accessibilityLabel={`${l.label}: ${DEVELOPER.name}`}
            style={({ pressed }) => ({
              flexGrow: 1, flexBasis: '45%', flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, paddingHorizontal: 12, borderRadius: 14,
              backgroundColor: `${l.color}14`, borderWidth: 1, borderColor: `${l.color}38`, opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.98 : 1 }],
            })}>
            <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: l.color, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={l.icon} size={17} color="#FFFFFF" />
            </View>
            <T size={14} weight="bold">{l.label}</T>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
