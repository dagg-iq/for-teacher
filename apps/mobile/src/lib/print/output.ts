/**
 * إخراج المطبوع بعد تقسيمه إلى صفحات في المعاينة: طباعة مباشرة، أو ملف PDF للمشاركة (واتساب، Drive…).
 * على الويب والحاسوب تُطبع المعاينة نفسها (إطار الصفحة)، فيخرج الورق كما يُرى تماماً.
 */
import * as Print from 'expo-print';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';
import { saveAndShare } from '@/lib/export';
import { paperSize, type PrintPaper } from './style';

/** نقطة طباعة = ١/٧٢ إنش */
const pt = (mm: number) => Math.round((mm / 25.4) * 72);

export async function printPaged(opts: { html: string; frame?: HTMLIFrameElement | null; landscape: boolean; paper: PrintPaper }) {
  if (Platform.OS === 'web') {
    const w = opts.frame?.contentWindow;
    if (!w) throw new Error('المعاينة لم تجهز بعد');
    w.focus();
    w.print();
    return;
  }
  const { w, h } = paperSize(opts.paper, opts.landscape);
  await Print.printAsync({ html: opts.html, width: pt(w), height: pt(h), orientation: opts.landscape ? Print.Orientation.landscape : Print.Orientation.portrait });
}

export async function sharePdf(opts: { html: string; frame?: HTMLIFrameElement | null; landscape: boolean; paper: PrintPaper; fileName: string }) {
  if (Platform.OS === 'web') {
    // المتصفح يحفظ PDF من نافذة الطباعة نفسها («حفظ بصيغة PDF»)
    await printPaged(opts);
    return;
  }
  const { w, h } = paperSize(opts.paper, opts.landscape);
  const { uri } = await Print.printToFileAsync({ html: opts.html, width: pt(w), height: pt(h), margins: { left: 0, right: 0, top: 0, bottom: 0 } });
  const bytes = await new File(uri).bytes();
  await saveAndShare(`${opts.fileName}.pdf`, bytes, 'application/pdf');
}
