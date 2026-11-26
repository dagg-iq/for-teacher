/** معاينة الطباعة على الهاتف: WebView يقسّم الصفحة إلى صفحات A4 ويعيد الصفحة النهائية للطباعة أو PDF */
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { PreviewProps } from './print-preview.types';

export function PrintPreview({ html, onPaged, style }: PreviewProps) {
  return (
    <View style={[{ flex: 1, overflow: 'hidden', backgroundColor: '#E9E7E1' }, style]}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        style={{ flex: 1, backgroundColor: '#E9E7E1' }}
        javaScriptEnabled
        setBuiltInZoomControls
        setDisplayZoomControls={false}
        scalesPageToFit={false}
        onMessage={(e) => {
          try {
            const d = JSON.parse(e.nativeEvent.data) as { type?: string; pages?: number; html?: string };
            if (d.type === 'nahj-paged') onPaged(d.pages ?? 1, d.html ?? html);
          } catch { /* */ }
        }}
      />
    </View>
  );
}
