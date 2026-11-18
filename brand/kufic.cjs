// يقرأ شبكة الشعار من packages/shared/src/brand.ts (المصدر الوحيد) ويبني مساراتها لسكربتات node
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../packages/shared/src/brand.ts'), 'utf8');
const ROWS = JSON.parse(src.match(/export const KUFIC: readonly string\[\] = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"').replace(/,\s*\]/, ']'));
const [, stroke, gap] = src.match(/KUFIC_LANES = \{ stroke: (\d+(?:\.\d+)?), gap: (\d+(?:\.\d+)?) \}/).map(Number);
const N = 10;
const acc = (n) => { const at = [0]; for (let i = 0; i < n; i++) at.push(at[i] + (i % 2 ? gap : stroke)); return at; };
const ax = acc(ROWS[0].length), ay = acc(ROWS.length);
const W = ax.at(-1), H = ay.at(-1), k = N / Math.max(W, H);
const r = (v) => Math.round(v * 10000) / 10000;
const LX = ax.map((v) => r(v * k + (N - W * k) / 2));
const LY = ay.map((v) => r(v * k + (N - H * k) / 2));
function cells() {
  let ink = '', dot = '';
  ROWS.forEach((row, y) => { let x = 0; while (x < row.length) { const ch = row[x]; if (ch === '.') { x++; continue; } let e = x; while (e + 1 < row.length && row[e + 1] === ch) e++;
    const d = `M${LX[x]} ${LY[y]}H${LX[e + 1]}V${LY[y + 1]}H${LX[x]}z`; if (ch === 'o') dot += d; else ink += d; x = e + 1; } });
  return { ink, dot };
}
/** منتصف خطَّي القاعدة: الصف ٦ (تقف عليه الحروف) والصف الأخير (ذيل الجيم) */
const BASELINE = (LY[6] + LY[7]) / 2;
const TAIL = (LY[ROWS.length - 1] + LY[ROWS.length]) / 2;
module.exports = { ROWS, N, LX, LY, BASELINE, TAIL, cells };
