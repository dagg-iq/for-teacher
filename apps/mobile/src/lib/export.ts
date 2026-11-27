/**
 * التصدير إلى Excel (من اليمين لليسار) عبر SheetJS، والمشاركة، واستيراد أسماء الطلاب من Excel/CSV.
 * الطباعة وملفات PDF في استوديو الطباعة: lib/print و app/print.tsx.
 */
import {
  arDigits, ATTENDANCE_LABEL, columnStats, formatNumericDate, MARK_LABEL, parseIsoDay, schoolYear, STAGE_LABEL, type Gradebook,
} from '@nahj/shared';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import * as XLSX from 'xlsx';
import { all, get, getSettings } from '@/data/db';
import { absencesOf, attendanceDays, sectionClass, sectionLabel, sectionReport, sheetOf, studentsOf } from '@/data/queries';

// ------------------------------------------------------------------ الملفات
function safeName(name: string) {
  return name.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 80) || 'nahj';
}

/** يحفظ الملف ويفتح نافذة المشاركة (واتساب، تيليجرام، Drive…) */
export async function saveAndShare(fileName: string, data: Uint8Array, mimeType: string) {
  const name = safeName(fileName);
  if (Platform.OS === 'web') {
    const blob = new Blob([data as BlobPart], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return;
  }
  const f = new File(Paths.cache, name);
  if (f.exists) f.delete();
  f.create();
  f.write(data);
  if (!(await Sharing.isAvailableAsync())) throw new Error('المشاركة غير متاحة على هذا الجهاز');
  await Sharing.shareAsync(f.uri, { mimeType, dialogTitle: name, UTI: mimeType.includes('sheet') ? 'org.openxmlformats.spreadsheetml.sheet' : 'com.adobe.pdf' });
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function workbook(sheets: { name: string; rows: (string | number | null)[][]; widths?: number[]; merges?: XLSX.Range[] }[]) {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.rows);
    if (s.widths) ws['!cols'] = s.widths.map((w) => ({ wch: w }));
    if (s.merges) ws['!merges'] = s.merges;
    XLSX.utils.book_append_sheet(wb, ws, safeName(s.name).slice(0, 31));
  }
  wb.Workbook = { Views: [{ RTL: true }] };
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new Uint8Array(out);
}

function headerInfo(sectionId: string) {
  const s = getSettings();
  const p = s.profile;
  const k = sectionClass(sectionId);
  return {
    school: p?.school || '',
    teacher: p?.name || '',
    subject: k?.subject || p?.subject || '',
    section: sectionLabel(sectionId),
    stage: k ? STAGE_LABEL[k.stage] : '',
    year: p?.year || schoolYear(),
    governorate: p?.governorate || '',
    principal: p?.principal || '',
    gender: p?.gender ?? 'm',
  };
}

// ------------------------------------------------------------------ سجل الدرجات
function bookTable(book: Gradebook) {
  const rows = sheetOf(book);
  const cols = book.columns.filter((c) => !c.hidden);
  const decider = book.columns.find((c) => c.id === book.result.column_id) ?? null;
  const cell = (r: (typeof rows)[number], colId: string): string | number | null => {
    const m = r.marks[colId];
    if (m && m !== 'absent') return MARK_LABEL[m];
    const v = r.values[colId];
    if (m === 'absent' && (v == null || v === 0)) return MARK_LABEL.absent;
    return v == null ? null : v;
  };
  return { rows, cols, decider, cell };
}

export async function exportBookXlsx(bookId: string) {
  const book = get('gradebooks', bookId);
  if (!book) throw new Error('السجل غير موجود');
  const h = headerInfo(book.section_id);
  const { rows, cols, decider, cell } = bookTable(book);
  const head = ['ت', 'اسم الطالب', ...cols.map((c) => arDigits(`${c.name} (${c.max})`)), ...(decider ? ['النتيجة', 'الترتيب'] : [])];
  const width = head.length;
  const aoa: (string | number | null)[][] = [
    [h.school ? `${h.school}${h.governorate ? ` — ${h.governorate}` : ''}` : 'سجل الدرجات'],
    [`${book.title} — ${h.section}`],
    [`المادة: ${h.subject}    المدرس: ${h.teacher}    العام الدراسي: ${h.year}`],
    [],
    head,
    ...rows.map((r, i) => [
      i + 1, r.student.name, ...cols.map((c) => cell(r, c.id)),
      ...(decider ? [r.verdict ? (r.verdict.pass ? 'ناجح' : 'راسب') : '', r.rank ?? ''] : []),
    ]),
  ];
  if (decider) {
    const st = columnStats(rows.map((r) => r.values[decider.id]), decider.max, { pass: book.result.pass });
    aoa.push([], ['الإحصاء', `${decider.name}`]);
    aoa.push(['عدد الطلاب', st.total], ['أُدخلت درجاتهم', st.count], ['الناجحون', st.passCount], ['الراسبون', st.failCount],
      ['نسبة النجاح %', st.passRate ?? ''], ['المعدل', st.avg ?? ''], ['الأعلى', st.max ?? ''], ['الأدنى', st.min ?? '']);
  }
  const merges: XLSX.Range[] = [0, 1, 2].map((r) => ({ s: { r, c: 0 }, e: { r, c: width - 1 } }));
  const data = workbook([{ name: book.title, rows: aoa, widths: [5, 30, ...cols.map(() => 13), 9, 8], merges }]);
  await saveAndShare(`${book.title} - ${h.section}.xlsx`, data, XLSX_MIME);
}

// ------------------------------------------------------------------ قوائم الأسماء والحضور
export async function exportStudentList(sectionId: string) {
  const h = headerInfo(sectionId);
  const students = studentsOf(sectionId);
  const aoa = [[`قائمة أسماء ${h.section}`], [], ['ت', 'اسم الطالب', 'هاتف ولي الأمر', 'الغيابات'],
    ...students.map((s, i) => [i + 1, s.name, s.parent_phone ?? '', absencesOf(s.id).absent])];
  await saveAndShare(`قائمة ${h.section}.xlsx`, workbook([{ name: h.section, rows: aoa, widths: [5, 32, 16, 9], merges: [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }] }]), XLSX_MIME);
}

/** سجل الغياب لشعبة (كل الأيام المسجلة) */
export async function exportAttendanceXlsx(sectionId: string) {
  const h = headerInfo(sectionId);
  const students = studentsOf(sectionId);
  const days = attendanceDays(sectionId).reverse();
  const rows = all('attendance').filter((a) => a.section_id === sectionId);
  const map = new Map(rows.map((a) => [`${a.student_id}|${a.date}`, a.status]));
  const short = { present: '✓', absent: 'غ', late: 'م', excused: 'ج' } as const;
  const aoa: (string | number | null)[][] = [
    [`سجل الحضور — ${h.section}`], ['✓ حاضر   غ غائب   م متأخر   ج مُجاز'], [],
    ['ت', 'اسم الطالب', ...days.map((d) => formatNumericDate(parseIsoDay(d), false)), 'الغيابات', 'التأخير'],
    ...students.map((s, i) => {
      const st = days.map((d) => map.get(`${s.id}|${d}`));
      return [i + 1, s.name, ...st.map((x) => (x ? short[x] : '')), st.filter((x) => x === 'absent').length, st.filter((x) => x === 'late').length];
    }),
  ];
  await saveAndShare(`حضور ${h.section}.xlsx`, workbook([{ name: 'الحضور', rows: aoa, widths: [5, 30, ...days.map(() => 12), 9, 9] }]), XLSX_MIME);
}

// ------------------------------------------------------------------ الاستيراد
/** يختار ملف Excel/CSV ويُرجع صفوف أول ورقة */
export async function pickSheetRows(): Promise<(string | number | null)[][] | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv', 'text/comma-separated-values', '*/*'],
    copyToCacheDirectory: true,
  });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  const bytes = Platform.OS === 'web' && a.file ? new Uint8Array(await a.file.arrayBuffer()) : await new File(a.uri).bytes();
  const wb = XLSX.read(bytes, { type: 'array' });
  return XLSX.utils.sheet_to_json<(string | number | null)[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, blankrows: false, defval: null });
}

/** يختار ملف Excel/CSV/نص ويستخرج منه أسماء الطلاب */
export async function pickNamesFromFile(): Promise<string[] | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv', 'text/plain', 'text/comma-separated-values', '*/*'],
    copyToCacheDirectory: true,
  });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  let bytes: Uint8Array;
  if (Platform.OS === 'web' && a.file) bytes = new Uint8Array(await a.file.arrayBuffer());
  else bytes = await new File(a.uri).bytes();
  const wb = XLSX.read(bytes, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, { header: 1, blankrows: false, defval: null });
  return namesFromRows(rows);
}

/** يجد عمود الأسماء: أكثر عمود فيه نصوص عربية من كلمتين فأكثر */
export function namesFromRows(rows: (string | number | null)[][]): string[] {
  const score = new Map<number, number>();
  for (const r of rows) r.forEach((v, i) => {
    if (typeof v === 'string' && /[؀-ۿ]/.test(v) && v.trim().split(/\s+/).length >= 2 && v.length <= 60) score.set(i, (score.get(i) ?? 0) + 1);
  });
  const best = [...score.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!best) return [];
  const header = /^(الاسم|اسم الطالب|اسم الطالبة|الأسماء|الاسم الثلاثي|الاسم الرباعي)$/;
  return rows.map((r) => r[best[0]]).filter((v): v is string => typeof v === 'string' && v.trim().length > 1 && v.trim().length <= 100 && !header.test(v.trim())).map((v) => v.trim().replace(/\s+/g, ' '));
}

export { ATTENDANCE_LABEL };

// ------------------------------------------------------------------ تقرير الشعبة
/** تقرير شعبة كامل في Excel: الملخص، السجل الشامل (كل المراحل لكل طالب)، الراسبون، والغياب */
export async function exportSectionReportXlsx(sectionId: string) {
  const h = headerInfo(sectionId);
  const rep = sectionReport(sectionId);
  const title = `تقرير ${h.section}`;
  const summary: (string | number | null)[][] = [
    [h.school ? `${h.school}${h.governorate ? ` — ${h.governorate}` : ''}` : 'تقرير الشعبة'],
    [`${title} — المادة: ${h.subject} — المدرس: ${h.teacher} — العام الدراسي: ${h.year}`],
    [],
    ['السجل', 'أُدخلت', 'الناجحون', 'الراسبون', 'نسبة النجاح %', 'المعدل', 'الأعلى', 'الأدنى', 'حرجة بانتظار القرار'],
    ...rep.stages.map((s) => [s.book.title, s.stats?.count ?? 0, s.stats?.passCount ?? 0, s.stats?.failCount ?? 0, s.stats?.passRate ?? '', s.stats?.avg ?? '', s.stats?.max ?? '', s.stats?.min ?? '', s.critical || '']),
  ];
  const matrix: (string | number | null)[][] = [
    ['ت', 'اسم الطالب', ...rep.stages.map((s) => s.book.title), 'الغيابات'],
    ...rep.matrix.map((m, i) => [i + 1, m.student.name, ...m.values.map((v) => (v == null ? null : v)), m.absent]),
  ];
  const failing: (string | number | null)[][] = [['السجل', 'اسم الطالب', 'الدرجة']];
  for (const s of rep.stages) for (const f of s.failing) failing.push([s.book.title, f.student.name, f.value]);
  const absences: (string | number | null)[][] = [['اسم الطالب', 'غائب', 'متأخر', 'مُجاز'], ...rep.absences.map((a) => [a.student.name, a.absent, a.late, a.excused])];
  const data = workbook([
    { name: 'الملخص', rows: summary, widths: [30, 9, 10, 10, 13, 9, 8, 8, 18], merges: [0, 1].map((r) => ({ s: { r, c: 0 }, e: { r, c: 8 } })) },
    { name: 'السجل الشامل', rows: matrix, widths: [5, 30, ...rep.stages.map(() => 14), 9] },
    { name: 'الراسبون', rows: failing, widths: [30, 30, 9] },
    { name: 'الغياب', rows: absences, widths: [30, 8, 8, 8] },
  ]);
  await saveAndShare(`${title}.xlsx`, data, XLSX_MIME);
}
