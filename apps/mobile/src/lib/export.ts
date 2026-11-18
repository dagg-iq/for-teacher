/**
 * التصدير والطباعة:
 *  - Excel (من اليمين لليسار) عبر SheetJS.
 *  - طباعة / PDF بترويسة رسمية (المدرسة، المدرس، المادة، الشعبة، العام) وخط ثمانية.
 *  - استيراد أسماء الطلاب من Excel/CSV.
 */
import {
  arDigits, ATTENDANCE_LABEL, buildSheet, columnStats, DAY_NAMES, formatClock, formatDate, formatScore, MARK_LABEL,
  parseIsoDay, periodName, schoolYear, STAGE_LABEL, WEEK_ORDER, type Gradebook,
} from '@rasd/shared';
import { Asset } from 'expo-asset';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import * as XLSX from 'xlsx';
import { all, get, getSettings, getTimetable } from '@/data/db';
import { absencesOf, attendanceDays, gradesOf, sectionClass, sectionLabel, studentsOf } from '@/data/queries';

// ------------------------------------------------------------------ الملفات
function safeName(name: string) {
  return name.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 80) || 'rasd';
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
  const students = studentsOf(book.section_id);
  const rows = buildSheet(book, students, gradesOf(book.id));
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
  const head = ['ت', 'اسم الطالب', ...cols.map((c) => `${c.name} (${c.max})`), ...(decider ? ['التقدير', 'النتيجة', 'الترتيب'] : [])];
  const width = head.length;
  const aoa: (string | number | null)[][] = [
    [h.school ? `${h.school}${h.governorate ? ` — ${h.governorate}` : ''}` : 'سجل الدرجات'],
    [`${book.title} — ${h.section}`],
    [`المادة: ${h.subject}    المدرس: ${h.teacher}    العام الدراسي: ${h.year}`],
    [],
    head,
    ...rows.map((r, i) => [
      i + 1, r.student.name, ...cols.map((c) => cell(r, c.id)),
      ...(decider ? [r.verdict?.label ?? '', r.verdict ? (r.verdict.pass ? 'ناجح' : 'راسب') : '', r.rank ?? ''] : []),
    ]),
  ];
  if (decider) {
    const st = columnStats(rows.map((r) => r.values[decider.id]), decider.max, book.result);
    aoa.push([], ['الإحصاء', `${decider.name}`]);
    aoa.push(['عدد الطلاب', st.total], ['أُدخلت درجاتهم', st.count], ['الناجحون', st.passCount], ['الراسبون', st.failCount],
      ['نسبة النجاح ٪', st.passRate ?? ''], ['المعدل', st.avg ?? ''], ['الأعلى', st.max ?? ''], ['الأدنى', st.min ?? '']);
    for (const b of st.bands) aoa.push([b.label, b.count]);
  }
  const merges: XLSX.Range[] = [0, 1, 2].map((r) => ({ s: { r, c: 0 }, e: { r, c: width - 1 } }));
  const data = workbook([{ name: book.title, rows: aoa, widths: [5, 30, ...cols.map(() => 13), 11, 9, 8], merges }]);
  await saveAndShare(`${book.title} - ${h.section}.xlsx`, data, XLSX_MIME);
}

// ------------------------------------------------------------------ الطباعة
let fontCache: string | null = null;

/** خط ثمانية مضمّن (base64) حتى تخرج الطباعة بنفس خط التطبيق */
async function fontCss(): Promise<string> {
  if (fontCache != null) return fontCache;
  const faces: [string, number, number][] = [
    ['Rasd', 400, require('../../assets/fonts/thmanyahsans-Regular.otf')],
    ['Rasd', 700, require('../../assets/fonts/thmanyahsans-Bold.otf')],
    ['RasdDisplay', 900, require('../../assets/fonts/thmanyahserifdisplay-Black.otf')],
  ];
  const out: string[] = [];
  for (const [family, weight, mod] of faces) {
    try {
      const asset = Asset.fromModule(mod);
      await asset.downloadAsync();
      if (Platform.OS === 'web') {
        out.push(`@font-face{font-family:${family};font-weight:${weight};src:url(${asset.uri}) format('opentype');}`);
      } else {
        const b64 = await new File(asset.localUri ?? asset.uri).base64();
        out.push(`@font-face{font-family:${family};font-weight:${weight};src:url(data:font/otf;base64,${b64}) format('opentype');}`);
      }
    } catch {
      // نكمل بخط النظام
    }
  }
  fontCache = out.join('\n');
  return fontCache;
}

const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n = (v: unknown) => (typeof v === 'number' ? formatScore(v, 2) : esc(v));

export async function renderPage(title: string, body: string, landscape = false) {
  const fonts = await fontCss();
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
${fonts}
@page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 12mm 10mm; }
* { box-sizing: border-box; }
body { font-family: Rasd, 'Noto Naskh Arabic', 'Noto Sans Arabic', Tahoma, sans-serif; color: #111; margin: 0; font-size: 11pt; direction: rtl; }
.head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 10px; gap: 12px; }
.head .r, .head .l { font-size: 10pt; line-height: 1.7; }
.head .c { text-align: center; }
.head h1 { font-family: RasdDisplay, Rasd, serif; font-size: 18pt; margin: 0; }
.head h2 { font-size: 11pt; margin: 2px 0 0; font-weight: 700; color: #333; }
table { width: 100%; border-collapse: collapse; page-break-inside: auto; }
tr { page-break-inside: avoid; }
th, td { border: 1px solid #555; padding: 4px 5px; text-align: center; font-size: 10pt; }
th { background: #E3F0EC; font-weight: 700; }
td.name { text-align: right; white-space: nowrap; }
td.fail { color: #A82620; font-weight: 700; }
td.mark { color: #8A4700; }
tr:nth-child(even) td { background: #FAFAF8; }
.stats { display: flex; flex-wrap: wrap; gap: 6px 18px; margin-top: 10px; font-size: 10pt; }
.stats b { font-weight: 700; }
.sign { display: flex; justify-content: space-between; margin-top: 28px; font-size: 11pt; }
.sign div { text-align: center; min-width: 160px; }
.sign span { display: block; margin-top: 26px; border-top: 1px dotted #555; padding-top: 4px; }
.foot { margin-top: 14px; font-size: 8pt; color: #8A8A85; text-align: center; }
.grid td { height: 52px; vertical-align: middle; }
.grid td small { display: block; color: #555; font-size: 8.5pt; }
</style></head><body>${body}<div class="foot">أُعدّ بتطبيق رَصد</div></body></html>`;
}

function headBlock(h: ReturnType<typeof headerInfo>, title: string, sub: string) {
  return `<div class="head">
  <div class="r">جمهورية العراق<br>وزارة التربية<br>${esc(h.governorate ? `المديرية العامة لتربية ${h.governorate}` : '')}</div>
  <div class="c"><h1>${esc(title)}</h1><h2>${esc(sub)}</h2></div>
  <div class="l">المدرسة: ${esc(h.school)}<br>المادة: ${esc(h.subject)}<br>العام الدراسي: ${esc(arDigits(h.year))}</div>
</div>`;
}

function signBlock(h: ReturnType<typeof headerInfo>) {
  return `<div class="sign"><div>${h.gender === 'f' ? 'مدرّسة' : 'مدرّس'} المادة<span>${esc(h.teacher)}</span></div><div>مدير المدرسة<span>${esc(h.principal)}</span></div></div>`;
}

/** يطبع أو يحفظ PDF */
export async function outputHtml(html: string, fileName: string, mode: 'print' | 'pdf', landscape = false) {
  if (Platform.OS === 'web') {
    const w = window.open('', '_blank');
    if (!w) throw new Error('اسمح بالنوافذ المنبثقة للطباعة');
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 600);
    return;
  }
  if (mode === 'print') {
    await Print.printAsync({ html, orientation: landscape ? Print.Orientation.landscape : Print.Orientation.portrait });
    return;
  }
  const { uri } = await Print.printToFileAsync({ html, width: landscape ? 842 : 595, height: landscape ? 595 : 842 });
  const bytes = await new File(uri).bytes();
  await saveAndShare(`${fileName}.pdf`, bytes, 'application/pdf');
}

export async function printBook(bookId: string, mode: 'print' | 'pdf' = 'print') {
  const book = get('gradebooks', bookId);
  if (!book) throw new Error('السجل غير موجود');
  const h = headerInfo(book.section_id);
  const { rows, cols, decider, cell } = bookTable(book);
  const landscape = cols.length > 5;
  const head = `<tr><th>ت</th><th>اسم الطالب</th>${cols.map((c) => `<th>${esc(c.name)}<br><small>${arDigits(c.max)}</small></th>`).join('')}${decider ? '<th>التقدير</th><th>النتيجة</th>' : ''}</tr>`;
  const body = rows.map((r, i) => {
    const tds = cols.map((c) => {
      const v = cell(r, c.id);
      const mark = typeof v === 'string';
      const fail = c.id === decider?.id && r.verdict && !r.verdict.pass;
      return `<td class="${mark ? 'mark' : fail ? 'fail' : ''}">${v == null ? '' : n(v)}</td>`;
    }).join('');
    const res = decider ? `<td>${esc(r.verdict?.label ?? '')}</td><td class="${r.verdict && !r.verdict.pass ? 'fail' : ''}">${r.verdict ? (r.verdict.pass ? 'ناجح' : 'راسب') : ''}</td>` : '';
    return `<tr><td>${arDigits(i + 1)}</td><td class="name">${esc(r.student.name)}</td>${tds}${res}</tr>`;
  }).join('');
  let stats = '';
  if (decider) {
    const st = columnStats(rows.map((r) => r.values[decider.id]), decider.max, book.result);
    stats = `<div class="stats"><span>عدد الطلاب: <b>${arDigits(st.total)}</b></span><span>الناجحون: <b>${arDigits(st.passCount)}</b></span><span>الراسبون: <b>${arDigits(st.failCount)}</b></span><span>نسبة النجاح: <b>${st.passRate == null ? '—' : `${formatScore(st.passRate)}٪`}</b></span><span>المعدل: <b>${formatScore(st.avg)}</b></span>${st.bands.map((b) => `<span>${esc(b.label)}: <b>${arDigits(b.count)}</b></span>`).join('')}</div>`;
  }
  const html = await renderPage(book.title, `${headBlock(h, book.title, h.section)}<table><thead>${head}</thead><tbody>${body}</tbody></table>${stats}${signBlock(h)}`, landscape);
  await outputHtml(html, `${book.title} - ${h.section}`, mode, landscape);
}

// ------------------------------------------------------------------ قوائم الأسماء والحضور
export async function exportStudentList(sectionId: string) {
  const h = headerInfo(sectionId);
  const students = studentsOf(sectionId);
  const aoa = [[`قائمة أسماء ${h.section}`], [], ['ت', 'اسم الطالب', 'هاتف ولي الأمر', 'الغيابات'],
    ...students.map((s, i) => [i + 1, s.name, s.parent_phone ?? '', absencesOf(s.id).absent])];
  await saveAndShare(`قائمة ${h.section}.xlsx`, workbook([{ name: h.section, rows: aoa, widths: [5, 32, 16, 9], merges: [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }] }]), XLSX_MIME);
}

export async function printStudentList(sectionId: string, mode: 'print' | 'pdf' = 'print') {
  const h = headerInfo(sectionId);
  const students = studentsOf(sectionId);
  const blank = Array.from({ length: 8 }, () => '<td></td>').join('');
  const body = `${headBlock(h, 'قائمة أسماء الطلاب', h.section)}<table><thead><tr><th>ت</th><th>اسم الطالب</th>${Array.from({ length: 8 }, () => '<th></th>').join('')}</tr></thead><tbody>${students.map((s, i) => `<tr><td>${arDigits(i + 1)}</td><td class="name">${esc(s.name)}</td>${blank}</tr>`).join('')}</tbody></table>${signBlock(h)}`;
  await outputHtml(await renderPage('قائمة الأسماء', body, true), `قائمة ${h.section}`, mode, true);
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
    ['ت', 'اسم الطالب', ...days.map((d) => formatDate(parseIsoDay(d))), 'الغيابات', 'التأخير'],
    ...students.map((s, i) => {
      const st = days.map((d) => map.get(`${s.id}|${d}`));
      return [i + 1, s.name, ...st.map((x) => (x ? short[x] : '')), st.filter((x) => x === 'absent').length, st.filter((x) => x === 'late').length];
    }),
  ];
  await saveAndShare(`حضور ${h.section}.xlsx`, workbook([{ name: 'الحضور', rows: aoa, widths: [5, 30, ...days.map(() => 12), 9, 9] }]), XLSX_MIME);
}

// ------------------------------------------------------------------ تقرير الطالب
export async function printStudentReport(studentId: string, mode: 'print' | 'pdf' = 'pdf') {
  const s = get('students', studentId);
  if (!s) throw new Error('الطالب غير موجود');
  const h = headerInfo(s.section_id);
  const books = all('gradebooks').filter((b) => b.section_id === s.section_id && !b.archived);
  const parts = books.map((b) => {
    const { rows, cols, decider, cell } = bookTable(b);
    const r = rows.find((x) => x.student.id === s.id);
    if (!r) return '';
    return `<h3 style="margin:14px 0 6px;font-size:12pt">${esc(b.title)}</h3><table><tr>${cols.map((c) => `<th>${esc(c.name)}</th>`).join('')}${decider ? '<th>التقدير</th>' : ''}</tr><tr>${cols.map((c) => { const v = cell(r, c.id); return `<td>${v == null ? '—' : n(v)}</td>`; }).join('')}${decider ? `<td>${esc(r.verdict?.label ?? '—')}</td>` : ''}</tr></table>`;
  }).join('');
  const ab = absencesOf(s.id);
  const notes = all('student_notes').filter((x) => x.student_id === s.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
  const body = `${headBlock(h, 'تقرير الطالب', s.name)}
<p style="font-size:11pt">الصف والشعبة: <b>${esc(h.section)}</b> · الغيابات: <b>${arDigits(ab.absent)}</b> · التأخير: <b>${arDigits(ab.late)}</b> · الإجازات: <b>${arDigits(ab.excused)}</b></p>
${parts || '<p>لا درجات بعد.</p>'}
${notes.length ? `<h3 style="margin:14px 0 6px;font-size:12pt">الملاحظات</h3><ul>${notes.map((x) => `<li>${esc(formatDate(parseIsoDay(x.date)))}: ${esc(x.text)}</li>`).join('')}</ul>` : ''}
${signBlock(h)}`;
  await outputHtml(await renderPage(`تقرير ${s.name}`, body), `تقرير ${s.name}`, mode);
}

// ------------------------------------------------------------------ الجدول
export async function printTimetable(mode: 'print' | 'pdf' = 'print') {
  const s = getSettings();
  const cfg = getTimetable();
  const slots = all('slots');
  const days = WEEK_ORDER.filter((d) => cfg.days.includes(d));
  const p = s.profile;
  const head = `<tr><th>اليوم</th>${cfg.periods.map((pp, i) => `<th>${periodName(i)}<br><small>${formatClock(pp.start)}–${formatClock(pp.end)}</small></th>`).join('')}</tr>`;
  const body = days.map((d) => `<tr><th>${DAY_NAMES[d]}</th>${cfg.periods.map((_, i) => {
    const sl = slots.find((x) => x.day === d && x.period === i);
    if (!sl) return '<td></td>';
    const label = sl.section_id ? sectionLabel(sl.section_id) : sl.label ?? '';
    return `<td>${esc(label)}${sl.room ? `<small>${esc(sl.room)}</small>` : ''}</td>`;
  }).join('')}</tr>`).join('');
  const html = await renderPage('جدول الحصص', `<div class="head"><div class="r">${esc(p?.school ?? '')}</div><div class="c"><h1>جدول الحصص الأسبوعي</h1><h2>${esc(p ? `${p.gender === 'f' ? 'المدرّسة' : 'المدرّس'}: ${p.name}` : '')}</h2></div><div class="l">${esc(p?.subject ?? '')}<br>${esc(arDigits(p?.year ?? schoolYear()))}</div></div><table class="grid"><thead>${head}</thead><tbody>${body}</tbody></table>`, true);
  await outputHtml(html, 'جدول الحصص', mode, true);
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
  return rows.map((r) => r[best[0]]).filter((v): v is string => typeof v === 'string' && v.trim().length > 1 && !header.test(v.trim())).map((v) => v.trim().replace(/\s+/g, ' '));
}

export { ATTENDANCE_LABEL };
