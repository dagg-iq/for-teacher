/** استيراد درجات من جدول (Excel): يجد عمود الأسماء والأعمدة الرقمية ويطابق الأسماء مع طلاب الشعبة */
import { parseNumber } from './format';
import type { Student } from './types';
import { isConfident, matchStudents } from './voice';

export type Cell = string | number | null;

export interface SheetLayout {
  /** رقم صف العناوين (أو -1) */
  headerRow: number;
  nameCol: number;
  /** الأعمدة الرقمية مع عناوينها */
  numeric: { col: number; title: string }[];
}

const isArabicName = (v: Cell) => typeof v === 'string' && /[؀-ۿ]/.test(v) && v.trim().split(/\s+/).length >= 2 && v.length <= 60;
const num = (v: Cell): number | null => (typeof v === 'number' ? v : typeof v === 'string' ? parseNumber(v) : null);

export function detectLayout(rows: Cell[][]): SheetLayout | null {
  const width = Math.max(0, ...rows.map((r) => r.length));
  const nameScore = Array.from({ length: width }, (_, c) => rows.filter((r) => isArabicName(r[c] ?? null)).length);
  const nameCol = nameScore.indexOf(Math.max(...nameScore));
  if (nameCol < 0 || nameScore[nameCol] === 0) return null;
  const firstName = rows.findIndex((r) => isArabicName(r[nameCol] ?? null));
  const headerRow = firstName > 0 ? firstName - 1 : -1;
  const dataRows = rows.slice(firstName);
  const numeric: SheetLayout['numeric'] = [];
  for (let c = 0; c < width; c++) {
    if (c === nameCol) continue;
    const vals = dataRows.map((r) => num(r[c] ?? null)).filter((v): v is number => v != null);
    const title = headerRow >= 0 && rows[headerRow][c] != null ? String(rows[headerRow][c]).trim() : `عمود ${c + 1}`;
    // عمود التسلسل (١، ٢، ٣…) ليس درجات
    const sequential = vals.length >= 2 && vals.every((v, i) => v === vals[0] + i);
    const serialTitle = /^(ت|التسلسل|تسلسل|الرقم|رقم|م|no\.?|#)$/i.test(title);
    if (vals.length >= Math.max(1, dataRows.length * 0.3) && !sequential && !serialTitle) {
      numeric.push({ col: c, title });
    }
  }
  return { headerRow, nameCol, numeric };
}

export interface ImportRow {
  name: string;
  student: Student | null;
  /** درجات الأعمدة الرقمية حسب رقم العمود */
  values: Record<number, number | null>;
  sure: boolean;
}

export function matchSheet(rows: Cell[][], layout: SheetLayout, students: Student[]): ImportRow[] {
  const out: ImportRow[] = [];
  const used = new Set<string>();
  for (const r of rows.slice(layout.headerRow + 1)) {
    const name = r[layout.nameCol];
    if (!isArabicName(name ?? null)) continue;
    const cands = matchStudents(String(name), students.filter((s) => !used.has(s.id)));
    const sure = isConfident(cands) && cands[0].score >= 0.8;
    const student = cands[0] && cands[0].score >= 0.6 ? cands[0].student : null;
    if (student) used.add(student.id);
    const values: Record<number, number | null> = {};
    for (const n of layout.numeric) values[n.col] = num(r[n.col] ?? null);
    out.push({ name: String(name).trim(), student, values, sure });
  }
  return out;
}
