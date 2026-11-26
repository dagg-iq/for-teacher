/** معاينة الطباعة على الويب والحاسوب: الصفحة نفسها في إطار، تُقسَّم إلى صفحات A4 وتُطبع منه مباشرة */
import { createElement, useEffect, useRef } from 'react';
import { View } from 'react-native';
import type { PreviewProps } from './print-preview.types';

export function PrintPreview({ html, onPaged, onFrame, style }: PreviewProps) {
  const ref = useRef<HTMLIFrameElement | null>(null);
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow) return;
      const d = e.data as { type?: string; pages?: number } | null;
      if (d?.type === 'nahj-paged') onPaged(d.pages ?? 1, html);
    };
    window.addEventListener('message', on);
    return () => window.removeEventListener('message', on);
  }, [html, onPaged]);
  return (
    <View style={[{ flex: 1, overflow: 'hidden' }, style]}>
      {createElement('iframe', {
        ref: (el: HTMLIFrameElement | null) => { ref.current = el; onFrame?.(el); },
        srcDoc: html,
        title: 'معاينة الطباعة',
        style: { border: 0, width: '100%', height: '100%', background: '#E9E7E1' },
      })}
    </View>
  );
}
