'use no memo';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { readSnapshot } from './snapshot';
import { renderWidgetFor } from './registry';

/** يعمل في الخلفية (التطبيق مغلق): عند إضافة الويدجت، وكل ٣٠ دقيقة، وعند تغيير حجمه */
export async function widgetTaskHandler({ widgetInfo, widgetAction, renderWidget }: WidgetTaskHandlerProps) {
  if (widgetAction === 'WIDGET_DELETED' || widgetAction === 'WIDGET_CLICK') return;
  const s = await readSnapshot();
  const rep = renderWidgetFor(widgetInfo.widgetName, s, widgetInfo);
  if (rep) renderWidget(rep);
}
