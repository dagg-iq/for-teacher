import type { StyleProp, ViewStyle } from 'react-native';

export interface PreviewProps {
  html: string;
  /** بعد التقسيم إلى صفحات: عدد الصفحات، والصفحة النهائية الجاهزة للطباعة (على الهاتف) */
  onPaged: (pages: number, pagedHtml: string) => void;
  /** إطار المعاينة (الويب فقط) — يُطبع منه مباشرة */
  onFrame?: (frame: HTMLIFrameElement | null) => void;
  style?: StyleProp<ViewStyle>;
}
