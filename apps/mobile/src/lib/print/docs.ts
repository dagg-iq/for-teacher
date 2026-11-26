/**
 * محتوى كل مطبوع مقسّماً إلى أقسام (يختار المدرس منها ويرتبها):
 * سجل الدرجات، تقرير الشعبة، قائمة الأسماء، تقرير الطالب، سجل الحضور، جدول الحصص، التحضير اليومي.
 */
import {
  arDigits, ATTENDANCE_LABEL, columnStats, DAY_NAMES, formatClock, formatDate, formatDayDate, formatPercent, formatScore, isoDay,
  MARK_LABEL, NOTE_KIND_LABEL, parseIsoDay, periodName, WEEK_ORDER, type AttendanceStatus, type Gradebook, type SheetRow,
} from '@nahj/shared';
import { all, get, getSettings, getTimetable } from '@/data/db';
import {
  absencesOf, attendanceDays, booksOfSection, deciderOf, sectionLabel, sectionReport, sheetOf, studentsOf,
} from '@/data/queries';
import { esc, type ExtraDef, type PrintBlock, type PrintDoc } from './render';

export type DocKind = 'book' | 'report' | 'list' | 'student' | 'attendance' | 'timetable' | 'plan';

export const DOC_LABEL: Record<DocKind, string> = {
  book: 'سجل الدرجات',
  report: 'تقرير الشعبة',
  list: 'قائمة الأسماء',
  student: 'تقرير الطالب',
  attendance: 'سجل الحضور',
  timetable: 'جدول الحصص',
  plan: 'التحضير اليومي',
};

type Extras = Record<string, number | boolean | string>;

// ------------------------------------------------------------------ أدوات
const num = (v: number | null | undefined, d = 2) => (v == null ? '' : formatScore(v, d));
const h3 = (t: string) => `<h3 class="bh keep">${esc(t)}</h3>`;

function table(head: string[], rows: string[][], opts: { cls?: string[]; small?: string[] } = {}) {
  const th = head.map((h, i) => `<th>${esc(h)}${opts.small?.[i] ? `<small>${esc(opts.small[i])}</small>` : ''}</th>`).join('');
  return `<table class="t"><thead><tr>${th}</tr></thead><tbody>${rows.map((r) => `<tr>${r.join('')}</tr>`).join('')}</tbody></table>`;
}
const td = (v: unknown, cls = '') => `<td${cls ? ` class="${cls}"` : ''}>${v == null ? '' : v}</td>`;

function stats(items: [string, string][]) {
  return `<div class="atom stats">${items.map(([l, v]) => `<div class="stat"><b>${v}</b><span>${esc(l)}</span></div>`).join('')}</div>`;
}

/** فئات الدرجات العراقية (للتوزيع) */
const BANDS: [number, string][] = [[90, 'امتياز (٩٠–١٠٠)'], [80, 'جيد جداً (٨٠–٨٩)'], [70, 'جيد (٧٠–٧٩)'], [60, 'متوسط (٦٠–٦٩)'], [50, 'مقبول (٥٠–٥٩)'], [0, 'ضعيف (دون ٥٠)']];

function distribution(values: (number | null | undefined)[], max: number) {
  const vs = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (!vs.length || !max) return '';
  const counts = BANDS.map(([min]) => 0 * min);
  for (const v of vs) {
    const pct = (v / max) * 100;
    const i = BANDS.findIndex(([min]) => pct + 1e-9 >= min);
    counts[i < 0 ? BANDS.length - 1 : i]++;
  }
  const top = Math.max(...counts, 1);
  return `<div class="atom bars">${BANDS.map(([, label], i) => `<div class="bar"><span>${esc(arDigits(label))}</span><em><i style="width:${(counts[i] / top) * 100}%"></i></em><b>${arDigits(counts[i])} (${formatPercent((counts[i] / vs.length) * 100)})</b></div>`).join('')}</div>`;
}

function cellOf(r: SheetRow, colId: string): { text: string; mark: boolean } {
  const m = r.marks[colId];
  if (m && m !== 'absent') return { text: MARK_LABEL[m], mark: true };
  const v = r.values[colId];
  if (m === 'absent' && (v == null || v === 0)) return { text: MARK_LABEL.absent, mark: true };
  return { text: v == null ? '' : formatScore(v, 2), mark: false };
}

// ------------------------------------------------------------------ سجل الدرجات
export function bookDoc(bookId: string, ex: Extras): PrintDoc {
  const book = get('gradebooks', bookId);
  if (!book) throw new Error('السجل غير موجود');
  const rows = sheetOf(book);
  const cols = book.columns.filter((c) => !c.hidden);
  const dec = deciderOf(book);
  const withRank = !!ex.rank && !!dec;
  const withResult = ex.result !== false && !!dec;
  const head = ['ت', 'اسم الطالب', ...cols.map((c) => arDigits(c.name)), ...(withResult ? ['النتيجة'] : []), ...(withRank ? ['الترتيب'] : [])];
  const small = ['', '', ...cols.map((c) => arDigits(c.max)), '', ''];
  const body = rows.map((r, i) => [
    td(arDigits(i + 1)), td(esc(r.student.name), 'name'),
    ...cols.map((c) => {
      const x = cellOf(r, c.id);
      const fail = c.id === dec?.id && r.verdict && !r.verdict.pass;
      return td(esc(x.text), x.mark ? 'mark' : fail ? 'fail' : '');
    }),
    ...(withResult ? [td(r.verdict ? (r.verdict.pass ? 'ناجح' : 'راسب') : '', r.verdict && !r.verdict.pass ? 'fail' : '')] : []),
    ...(withRank ? [td(r.rank ? arDigits(r.rank) : '')] : []),
  ]);
  const st = dec ? columnStats(rows.map((r) => r.values[dec.id]), dec.max, { pass: book.result.pass }) : null;
  const failing = dec ? rows.filter((r) => r.verdict && !r.verdict.pass) : [];
  const top = dec ? rows.filter((r) => r.rank != null).sort((a, b) => a.rank! - b.rank!).slice(0, Number(ex.topN) || 10) : [];
  const blocks: PrintBlock[] = [
    { id: 'table', title: 'جدول الدرجات', html: table(head, body, { small }) },
    {
      id: 'stats', title: 'الإحصاء', empty: st?.count ? null : 'لا درجات بعد',
      html: st ? `${h3(`الإحصاء — ${dec!.name}`)}${stats([
        ['عدد الطلاب', arDigits(st.total)], ['أُدخلت', arDigits(st.count)], ['الناجحون', arDigits(st.passCount)], ['الراسبون', arDigits(st.failCount)],
        ['نسبة النجاح', formatPercent(st.passRate, 1)], ['المعدل', formatScore(st.avg)], ['الأعلى', formatScore(st.max)], ['الأدنى', formatScore(st.min)],
      ])}` : '',
    },
    { id: 'dist', title: 'توزيع الدرجات', on: false, empty: st?.count ? null : 'لا درجات بعد', html: dec ? `${h3('توزيع الدرجات')}${distribution(rows.map((r) => r.values[dec.id]), dec.max)}` : '' },
    {
      id: 'failing', title: 'الراسبون', on: false, empty: failing.length ? null : 'لا راسبين',
      html: `${h3(`الراسبون (${arDigits(failing.length)})`)}${table(['ت', 'اسم الطالب', 'الدرجة'], failing.map((r, i) => [td(arDigits(i + 1)), td(esc(r.student.name), 'name'), td(num(r.values[dec?.id ?? '']), 'fail')]))}`,
    },
    {
      id: 'top', title: 'الأوائل', on: false, empty: top.length ? null : 'لا درجات بعد',
      html: `${h3('الأوائل')}${table(['الترتيب', 'اسم الطالب', 'الدرجة'], top.map((r) => [td(arDigits(r.rank!)), td(esc(r.student.name), 'name'), td(num(r.values[dec?.id ?? '']))]))}`,
    },
  ];
  return {
    kind: 'book', title: book.title, subtitle: sectionLabel(book.section_id), fileName: `${book.title} - ${sectionLabel(book.section_id)}`,
    sectionId: book.section_id, wide: cols.length > 5, blocks,
    extras: [
      { key: 'result', label: 'عمود النتيجة (ناجح/راسب)', kind: 'toggle', def: true },
      { key: 'rank', label: 'عمود الترتيب', kind: 'toggle', def: false },
      { key: 'topN', label: 'عدد الأوائل', kind: 'number', def: 10, min: 3, max: 30 },
    ],
  };
}

// ------------------------------------------------------------------ تقرير الشعبة
export function reportDoc(sectionId: string, ex: Extras): PrintDoc {
  const rep = sectionReport(sectionId);
  const skipMonths = !!ex.noMonths;
  const skipEmpty = ex.skipEmpty !== false;
  const stages = rep.stages.filter((s) => (!skipMonths || s.book.role !== 'month') && (!skipEmpty || s.stats?.count));
  const short = (t: string) => esc(t).replace(' — ', '<br>');
  const summary = table(['السجل', 'أُدخلت', 'الناجحون', 'الراسبون', 'نسبة النجاح', 'المعدل', 'الأعلى', 'الأدنى'], stages.map((s) => [
    td(esc(s.book.title), 'txt'), td(arDigits(s.stats?.count ?? 0)), td(arDigits(s.stats?.passCount ?? 0)), td(arDigits(s.stats?.failCount ?? 0), s.stats?.failCount ? 'fail' : ''),
    td(s.stats?.passRate == null ? '—' : formatPercent(s.stats.passRate, 1)), td(formatScore(s.stats?.avg)), td(formatScore(s.stats?.max)), td(formatScore(s.stats?.min)),
  ]));
  const idx = stages.map((s) => rep.stages.indexOf(s));
  const matrixHead = `<table class="t"><thead><tr><th>ت</th><th>اسم الطالب</th>${stages.map((s) => `<th>${short(s.book.title)}</th>`).join('')}${ex.absences !== false ? '<th>الغياب</th>' : ''}</tr></thead><tbody>`;
  const matrix = `${matrixHead}${rep.matrix.map((m, i) => `<tr>${td(arDigits(i + 1))}${td(esc(m.student.name), 'name')}${idx.map((j) => td(num(m.values[j]), m.fails[j] ? 'fail' : '')).join('')}${ex.absences !== false ? td(m.absent ? arDigits(m.absent) : '') : ''}</tr>`).join('')}</tbody></table>`;
  // البطاقة الرئيسية: آخر مرحلة محسوبة فيها درجات
  const RANK = { final: 5, annual: 4, term: 3, mid: 2, month: 1, custom: 0 } as const;
  const head = rep.stages.filter((s) => s.stats?.count).sort((a, b) => (RANK[a.book.role ?? 'custom'] - RANK[b.book.role ?? 'custom']) || ((a.book.ord ?? 0) - (b.book.ord ?? 0))).at(-1);
  const failStages = rep.stages.filter((s) => s.failing.length && (!skipMonths || s.book.role !== 'month'));
  const critical = rep.stages.filter((s) => s.critical);
  const blocks: PrintBlock[] = [
    {
      id: 'headline', title: 'النتيجة الرئيسية', empty: head?.stats ? null : 'لا درجات بعد',
      html: head?.stats ? `${h3(`النتيجة الرئيسية — ${head.book.title}`)}${stats([
        ['عدد الطلاب', arDigits(rep.students)], ['الناجحون', arDigits(head.stats.passCount)], ['الراسبون', arDigits(head.stats.failCount)],
        ['نسبة النجاح', formatPercent(head.stats.passRate, 1)], ['المعدل', formatScore(head.stats.avg)], ['الأعلى', formatScore(head.stats.max)],
      ])}` : '',
    },
    { id: 'summary', title: 'ملخص النتائج حسب السجل', empty: stages.length ? null : 'لا سجلات', html: `${h3('ملخص النتائج حسب السجل')}${summary}` },
    {
      id: 'dist', title: 'توزيع الدرجات', on: false, empty: head?.stats?.count ? null : 'لا درجات بعد',
      html: head?.decider ? `${h3(`توزيع الدرجات — ${head.book.title}`)}${distribution(head.rows.map((r) => r.values[head.decider!.id]), head.decider.max)}` : '',
    },
    { id: 'matrix', title: 'السجل الشامل (كل طالب)', empty: rep.matrix.length && stages.length ? null : 'لا طلاب أو سجلات', html: `${h3('السجل الشامل')}${matrix}` },
    {
      id: 'failing', title: 'الراسبون', empty: failStages.length ? null : 'لا راسبين',
      html: `${h3('الراسبون')}${failStages.map((s) => `<div class="atom para"><b>${esc(s.book.title)} (${arDigits(s.failing.length)}):</b> ${s.failing.map((f) => `${esc(f.student.name)} (${num(f.value)})`).join('، ')}</div>`).join('')}`,
    },
    {
      id: 'critical', title: 'درجات حرجة تنتظر القرار', on: false, empty: critical.length ? null : 'لا درجات حرجة',
      html: `${h3('درجات حرجة تنتظر القرار')}${table(['السجل', 'العدد'], critical.map((s) => [td(esc(s.book.title), 'txt'), td(arDigits(s.critical))]))}`,
    },
    {
      id: 'absences', title: 'الغياب', empty: rep.absences.length ? null : 'لا غيابات',
      html: `${h3('الغياب والتأخير')}${table(['ت', 'اسم الطالب', 'غائب', 'متأخر', 'مُجاز'], rep.absences.map((a, i) => [td(arDigits(i + 1)), td(esc(a.student.name), 'name'), td(arDigits(a.absent), a.absent >= 5 ? 'fail' : ''), td(arDigits(a.late)), td(arDigits(a.excused))]))}`,
    },
  ];
  return {
    kind: 'report', title: 'تقرير الشعبة', subtitle: sectionLabel(sectionId), fileName: `تقرير ${sectionLabel(sectionId)}`,
    sectionId, wide: stages.length > 5, blocks,
    extras: [
      { key: 'skipEmpty', label: 'إخفاء السجلات التي لا درجات فيها بعد', kind: 'toggle', def: true },
      { key: 'noMonths', label: 'إخفاء الأشهر (السعي والنصف فقط)', kind: 'toggle', def: false },
      { key: 'absences', label: 'عمود الغياب في السجل الشامل', kind: 'toggle', def: true },
    ],
  };
}

// ------------------------------------------------------------------ قائمة الأسماء
export function listDoc(sectionId: string, ex: Extras): PrintDoc {
  const students = studentsOf(sectionId);
  const blanks = Math.max(0, Math.min(14, Number(ex.blanks ?? 8)));
  const titles = String(ex.titles ?? '').split(/[،,]/).map((x) => x.trim()).filter(Boolean);
  const head = ['ت', 'اسم الطالب', ...(ex.phone ? ['هاتف ولي الأمر'] : []), ...(ex.absent ? ['الغيابات'] : []), ...Array.from({ length: blanks }, (_, i) => titles[i] ?? '')];
  const rows = students.map((s, i) => [
    td(arDigits(i + 1)), td(esc(s.name), 'name'),
    ...(ex.phone ? [td(esc(arDigits(s.parent_phone ?? '')))] : []),
    ...(ex.absent ? [td(arDigits(absencesOf(s.id).absent || ''))] : []),
    ...Array.from({ length: blanks }, () => td('')),
  ]);
  return {
    kind: 'list', title: String(ex.heading || 'قائمة أسماء الطلاب'), subtitle: sectionLabel(sectionId), fileName: `قائمة ${sectionLabel(sectionId)}`,
    sectionId, wide: blanks + (ex.phone ? 2 : 0) > 6,
    blocks: [
      { id: 'list', title: 'قائمة الأسماء', html: table(head, rows), empty: students.length ? null : 'لا طلاب' },
      { id: 'count', title: 'عدد الطلاب', on: false, html: `<div class="atom para">عدد الطلاب: <b>${arDigits(students.length)}</b></div>` },
    ],
    extras: [
      { key: 'blanks', label: 'أعمدة فارغة', kind: 'number', def: 8, min: 0, max: 14 },
      { key: 'titles', label: 'عناوين الأعمدة الفارغة (مفصولة بفاصلة)', kind: 'text', def: '' },
      { key: 'heading', label: 'عنوان القائمة', kind: 'text', def: 'قائمة أسماء الطلاب' },
      { key: 'phone', label: 'هاتف ولي الأمر', kind: 'toggle', def: false },
      { key: 'absent', label: 'عدد الغيابات', kind: 'toggle', def: false },
    ],
  };
}

// ------------------------------------------------------------------ تقرير الطالب
export function studentDoc(studentId: string, ex: Extras): PrintDoc {
  const s = get('students', studentId);
  if (!s) throw new Error('الطالب غير موجود');
  const bs = booksOfSection(s.section_id);
  const books = [...bs.sets.flatMap((x) => x.books), ...bs.loose];
  const parts = books.map((b) => {
    const r = sheetOf(b).find((x) => x.student.id === s.id);
    if (!r) return '';
    const cols = b.columns.filter((c) => !c.hidden);
    const dec = deciderOf(b);
    const filled = cols.some((c) => r.values[c.id] != null || r.marks[c.id]);
    if (!filled && ex.skipEmpty !== false) return '';
    return `${h3(b.title)}${table([...cols.map((c) => arDigits(c.name)), ...(dec ? ['النتيجة'] : [])], [[
      ...cols.map((c) => { const x = cellOf(r, c.id); return td(esc(x.text || '—'), x.mark ? 'mark' : c.id === dec?.id && r.verdict && !r.verdict.pass ? 'fail' : ''); }),
      ...(dec ? [td(esc(r.verdict?.label ?? '—'), r.verdict && !r.verdict.pass ? 'fail' : '')] : []),
    ]], { small: cols.map((c) => arDigits(c.max)) })}`;
  }).join('');
  const ab = absencesOf(s.id);
  const notes = all('student_notes').filter((x) => x.student_id === s.id).sort((a, b) => b.date.localeCompare(a.date));
  const days = ab.rows.filter((a) => a.status !== 'present');
  return {
    kind: 'student', title: 'تقرير الطالب', subtitle: s.name, fileName: `تقرير ${s.name}`, sectionId: s.section_id,
    blocks: [
      {
        id: 'info', title: 'معلومات الطالب',
        html: `<div class="atom para">الاسم: <b>${esc(s.name)}</b> · الصف والشعبة: <b>${esc(sectionLabel(s.section_id))}</b>${s.parent_phone ? ` · هاتف ولي الأمر: <b>${esc(arDigits(s.parent_phone))}</b>` : ''}</div>`,
      },
      { id: 'grades', title: 'الدرجات', empty: parts ? null : 'لا درجات بعد', html: parts },
      {
        id: 'attendance', title: 'ملخص الحضور',
        html: `${h3('الحضور')}${stats([['أيام مسجّلة', arDigits(ab.days)], ['غائب', arDigits(ab.absent)], ['متأخر', arDigits(ab.late)], ['مُجاز', arDigits(ab.excused)]])}`,
      },
      {
        id: 'days', title: 'أيام الغياب والتأخير', on: false, empty: days.length ? null : 'لا غيابات',
        html: `${h3('أيام الغياب والتأخير')}${table(['التاريخ', 'الحالة'], days.map((a) => [td(esc(formatDayDate(parseIsoDay(a.date)))), td(ATTENDANCE_LABEL[a.status], a.status === 'absent' ? 'fail' : '')]))}`,
      },
      {
        id: 'notes', title: 'الملاحظات', empty: notes.length ? null : 'لا ملاحظات',
        html: `${h3('الملاحظات')}${table(['التاريخ', 'النوع', 'الملاحظة'], notes.slice(0, 30).map((n) => [td(esc(formatDate(parseIsoDay(n.date)))), td(NOTE_KIND_LABEL[n.kind]), td(esc(n.text), 'txt')]))}`,
      },
    ],
    extras: [{ key: 'skipEmpty', label: 'إخفاء السجلات الفارغة', kind: 'toggle', def: true }],
    signers: [
      { role: getSettings().profile?.gender === 'f' ? 'مدرّسة المادة' : 'مدرّس المادة', name: getSettings().profile?.name ?? '' },
      { role: 'ولي الأمر', name: '' },
    ],
  };
}

// ------------------------------------------------------------------ سجل الحضور
const SHORT: Record<AttendanceStatus, string> = { present: '✓', absent: 'غ', late: 'م', excused: 'ج' };

export function attendanceDoc(sectionId: string, ex: Extras): PrintDoc {
  const students = studentsOf(sectionId);
  const range = String(ex.range ?? 'month');
  const today = isoDay();
  const from = range === 'month' ? `${today.slice(0, 8)}01` : range === 'week' ? isoDay(new Date(Date.now() - 6 * 86400000)) : '0000';
  const days = attendanceDays(sectionId).filter((d) => d >= from).reverse();
  const rows = all('attendance').filter((a) => a.section_id === sectionId && a.date >= from);
  const map = new Map(rows.map((a) => [`${a.student_id}|${a.date}`, a.status]));
  const dd = (d: string) => arDigits(`${d.slice(8)}/${d.slice(5, 7)}`);
  const grid = table(['ت', 'اسم الطالب', ...days.map(dd), 'غ', 'م', 'ج'], students.map((s, i) => {
    const st = days.map((d) => map.get(`${s.id}|${d}`));
    const c = (k: AttendanceStatus) => st.filter((x) => x === k).length;
    return [td(arDigits(i + 1)), td(esc(s.name), 'name'), ...st.map((x) => td(x ? SHORT[x] : '', x === 'absent' ? 'fail' : '')), td(arDigits(c('absent')), c('absent') ? 'fail' : ''), td(arDigits(c('late'))), td(arDigits(c('excused')))];
  }));
  const log = days.slice().reverse().map((d) => {
    const ab = students.filter((s) => map.get(`${s.id}|${d}`) === 'absent').map((s) => esc(s.name));
    const lt = students.filter((s) => map.get(`${s.id}|${d}`) === 'late').map((s) => esc(s.name));
    const ex2 = students.filter((s) => map.get(`${s.id}|${d}`) === 'excused').map((s) => esc(s.name));
    return [td(esc(formatDayDate(parseIsoDay(d))), 'txt'), td(ab.join('، ') || '—', 'txt'), td(lt.join('، ') || '—', 'txt'), td(ex2.join('، ') || '—', 'txt')];
  });
  const totals = students.map((s) => ({ s, a: rows.filter((r) => r.student_id === s.id && r.status === 'absent').length, l: rows.filter((r) => r.student_id === s.id && r.status === 'late').length }))
    .filter((x) => x.a || x.l).sort((a, b) => b.a - a.a || b.l - a.l);
  const rangeLabel = range === 'month' ? 'الشهر الحالي' : range === 'week' ? 'آخر ٧ أيام' : 'كل الأيام';
  return {
    kind: 'attendance', title: 'سجل الحضور والغياب', subtitle: `${sectionLabel(sectionId)} — ${rangeLabel}`, fileName: `حضور ${sectionLabel(sectionId)}`,
    sectionId, wide: days.length > 8,
    blocks: [
      { id: 'legend', title: 'دليل الرموز', html: '<div class="atom para muted">✓ حاضر · غ غائب · م متأخر · ج مُجاز</div>' },
      { id: 'grid', title: 'جدول الأيام', empty: days.length ? null : 'لا أيام مسجّلة في المدة', html: grid },
      { id: 'totals', title: 'الأكثر غياباً', empty: totals.length ? null : 'لا غيابات', html: `${h3('الأكثر غياباً')}${table(['ت', 'اسم الطالب', 'غائب', 'متأخر'], totals.map((x, i) => [td(arDigits(i + 1)), td(esc(x.s.name), 'name'), td(arDigits(x.a), x.a >= 5 ? 'fail' : ''), td(arDigits(x.l))]))}` },
      { id: 'log', title: 'سجل الأيام (الغائبون بالأسماء)', on: false, empty: days.length ? null : 'لا أيام مسجّلة', html: `${h3('سجل الأيام')}${table(['اليوم', 'الغائبون', 'المتأخرون', 'المجازون'], log)}` },
    ],
    extras: [{ key: 'range', label: 'المدة', kind: 'choice', def: 'month', choices: [{ key: 'week', label: 'آخر أسبوع' }, { key: 'month', label: 'هذا الشهر' }, { key: 'all', label: 'كل الأيام' }] }],
  };
}

// ------------------------------------------------------------------ جدول الحصص
export function timetableDoc(): PrintDoc {
  const p = getSettings().profile;
  const cfg = getTimetable();
  const slots = all('slots');
  const days = WEEK_ORDER.filter((d) => cfg.days.includes(d));
  const head = `<tr><th>اليوم</th>${cfg.periods.map((pp, i) => `<th>${periodName(i)}<small>${formatClock(pp.start)}–${formatClock(pp.end)}</small></th>`).join('')}</tr>`;
  const body = days.map((d) => `<tr><th>${DAY_NAMES[d]}</th>${cfg.periods.map((_, i) => {
    const sl = slots.find((x) => x.day === d && x.period === i);
    if (!sl) return '<td></td>';
    const label = sl.section_id ? sectionLabel(sl.section_id) : sl.label ?? '';
    return `<td style="height:16mm">${esc(label)}${sl.room ? `<small class="muted" style="display:block">${esc(arDigits(sl.room))}</small>` : ''}</td>`;
  }).join('')}</tr>`).join('');
  const load = new Map<string, number>();
  for (const s of slots) if (s.section_id) load.set(s.section_id, (load.get(s.section_id) ?? 0) + 1);
  return {
    kind: 'timetable', title: 'جدول الحصص الأسبوعي', subtitle: p ? `${p.gender === 'f' ? 'المدرّسة' : 'المدرّس'}: ${p.name}` : '', fileName: 'جدول الحصص',
    wide: true,
    blocks: [
      { id: 'grid', title: 'الجدول', html: `<table class="t"><thead>${head}</thead><tbody>${body}</tbody></table>` },
      { id: 'times', title: 'أوقات الحصص', on: false, html: `${h3('أوقات الحصص')}${table(['الحصة', 'من', 'إلى'], cfg.periods.map((pp, i) => [td(periodName(i)), td(formatClock(pp.start, true)), td(formatClock(pp.end, true))]))}` },
      { id: 'load', title: 'النصاب الأسبوعي', empty: load.size ? null : 'لا حصص', html: `${h3('النصاب الأسبوعي')}${table(['الشعبة', 'عدد الحصص'], [...load.entries()].map(([sid, n]) => [td(esc(sectionLabel(sid)), 'txt'), td(arDigits(n))]))}` },
    ],
    signers: [{ role: p?.gender === 'f' ? 'المدرّسة' : 'المدرّس', name: p?.name ?? '' }, { role: 'مدير المدرسة', name: p?.principal ?? '' }],
  };
}

// ------------------------------------------------------------------ التحضير اليومي
export function planDoc(planId: string): PrintDoc {
  const p = get('lesson_plans', planId);
  if (!p) throw new Error('التحضير غير موجود');
  const prof = getSettings().profile;
  const k = p.class_id ? get('classes', p.class_id) : undefined;
  const lines = (s?: string | null) => esc(s).split('\n').filter((x) => x.trim()).join('<br>') || '—';
  const part = (id: string, label: string, v?: string | null): PrintBlock => ({
    id, title: label, empty: v?.trim() ? null : 'فارغ',
    html: `<table class="t"><tbody><tr><th style="width:26%">${label}</th><td class="txt" style="line-height:1.9">${lines(v)}</td></tr></tbody></table>`,
  });
  return {
    kind: 'plan', title: p.title, subtitle: `${formatDayDate(parseIsoDay(p.date))}${k ? ` — ${k.name}` : ''}${(p.section_ids ?? []).length ? ` (${(p.section_ids ?? []).map((s) => sectionLabel(s, true)).join('، ')})` : ''}`,
    fileName: `تحضير ${p.title}`,
    blocks: [
      part('objectives', 'الأهداف السلوكية', p.objectives),
      part('materials', 'الوسائل التعليمية', p.materials),
      part('method', 'طريقة التدريس', p.method),
      part('steps', 'خطوات الدرس', p.steps),
      part('evaluation', 'التقويم', p.evaluation),
      part('homework', 'الواجب البيتي', p.homework),
    ],
    signers: [{ role: prof?.gender === 'f' ? 'مدرّسة المادة' : 'مدرّس المادة', name: prof?.name ?? '' }, { role: 'المشرف / المدير', name: '' }],
  };
}

export function buildDoc(kind: DocKind, id: string | undefined, ex: Extras): PrintDoc {
  switch (kind) {
    case 'book': return bookDoc(id!, ex);
    case 'report': return reportDoc(id!, ex);
    case 'list': return listDoc(id!, ex);
    case 'student': return studentDoc(id!, ex);
    case 'attendance': return attendanceDoc(id!, ex);
    case 'timetable': return timetableDoc();
    case 'plan': return planDoc(id!);
  }
}

/** القيم الافتراضية لخيارات نوع مطبوع مدموجة بالمحفوظ */
export function extrasWithDefaults(defs: ExtraDef[] | undefined, saved?: Extras): Extras {
  const out: Extras = {};
  for (const d of defs ?? []) out[d.key] = saved?.[d.key] ?? d.def;
  return out;
}

export type { Gradebook };
