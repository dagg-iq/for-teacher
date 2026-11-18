/**
 * محرك المعادلات لسجل الدرجات.
 *
 * الصيغة المخزنة تستعمل معرّفات الأعمدة: {id}
 * والصيغة المعروضة للمدرس تستعمل أسماءها: [شهر أول]
 *
 * المدعوم:
 *   أرقام (عربية أو إنكليزية)، + − × ÷ * / ^ ( )
 *   مقارنات > < >= <= = != (تُرجع ١ أو ٠)
 *   دوال: معدل/avg، مجموع/sum، أعلى/max، أدنى/min، تقريب/round، أعلى_عدد/ceil، أدنى_عدد/floor،
 *         اذا/if(شرط، نعم، لا)، مطلق/abs
 *   «معدل» و«مجموع» يتجاهلان الخلايا الفارغة. أي عملية حسابية على خلية فارغة تُرجع فارغاً.
 */
import type { GradeColumn } from './types';

type Tok =
  | { t: 'num'; v: number }
  | { t: 'ref'; v: string }
  | { t: 'id'; v: string }
  | { t: 'op'; v: string }
  | { t: '('; } | { t: ')'; } | { t: ','; };

const AR = '٠١٢٣٤٥٦٧٨٩';

export class FormulaError extends Error {}

function tokenize(src: string): Tok[] {
  const s = src
    .replace(/[٠-٩]/g, (d) => String(AR.indexOf(d)))
    .replace(/٫/g, '.')
    .replace(/[×]/g, '*')
    .replace(/[÷]/g, '/')
    .replace(/[−–]/g, '-')
    .replace(/،/g, ',');
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      const n = Number(s.slice(i, j));
      if (!Number.isFinite(n)) throw new FormulaError(`رقم غير صحيح: ${s.slice(i, j)}`);
      out.push({ t: 'num', v: n });
      i = j;
      continue;
    }
    if (ch === '{') {
      const j = s.indexOf('}', i);
      if (j < 0) throw new FormulaError('قوس { غير مغلق');
      out.push({ t: 'ref', v: s.slice(i + 1, j).trim() });
      i = j + 1;
      continue;
    }
    if (ch === '(') { out.push({ t: '(' }); i++; continue; }
    if (ch === ')') { out.push({ t: ')' }); i++; continue; }
    if (ch === ',' || ch === '؛' || ch === ';') { out.push({ t: ',' }); i++; continue; }
    const two = s.slice(i, i + 2);
    if (['>=', '<=', '!=', '=='].includes(two)) { out.push({ t: 'op', v: two === '==' ? '=' : two }); i += 2; continue; }
    if ('+-*/^<>='.includes(ch)) { out.push({ t: 'op', v: ch }); i++; continue; }
    if (/[\p{L}_]/u.test(ch)) {
      let j = i;
      while (j < s.length && /[\p{L}\p{M}_0-9]/u.test(s[j])) j++;
      out.push({ t: 'id', v: s.slice(i, j) });
      i = j;
      continue;
    }
    throw new FormulaError(`رمز غير مفهوم: ${ch}`);
  }
  return out;
}

export type Node =
  | { k: 'num'; v: number }
  | { k: 'ref'; id: string }
  | { k: 'neg'; a: Node }
  | { k: 'bin'; op: string; a: Node; b: Node }
  | { k: 'call'; fn: Fn; args: Node[] };

type Fn = 'avg' | 'sum' | 'max' | 'min' | 'round' | 'ceil' | 'floor' | 'if' | 'abs';

const FN_ALIASES: Record<string, Fn> = {
  avg: 'avg', average: 'avg', mean: 'avg', معدل: 'avg', المعدل: 'avg', متوسط: 'avg',
  sum: 'sum', مجموع: 'sum', المجموع: 'sum',
  max: 'max', اعلى: 'max', أعلى: 'max', اكبر: 'max', أكبر: 'max',
  min: 'min', ادنى: 'min', أدنى: 'min', اصغر: 'min', أصغر: 'min',
  round: 'round', تقريب: 'round', قرب: 'round',
  ceil: 'ceil', اعلى_عدد: 'ceil', أعلى_عدد: 'ceil',
  floor: 'floor', ادنى_عدد: 'floor', أدنى_عدد: 'floor',
  if: 'if', اذا: 'if', إذا: 'if',
  abs: 'abs', مطلق: 'abs',
};

/** أسماء الدوال كما تظهر للمدرس */
export const FUNCTION_HELP: { fn: Fn; ar: string; desc: string }[] = [
  { fn: 'avg', ar: 'معدل', desc: 'معدل الأعمدة (يتجاهل الفارغ)' },
  { fn: 'sum', ar: 'مجموع', desc: 'مجموع الأعمدة' },
  { fn: 'max', ar: 'أعلى', desc: 'أعلى قيمة' },
  { fn: 'min', ar: 'أدنى', desc: 'أدنى قيمة' },
  { fn: 'round', ar: 'تقريب', desc: 'تقريب لأقرب عدد صحيح (٠٫٥ للأعلى)' },
  { fn: 'if', ar: 'اذا', desc: 'اذا(شرط، قيمة إن تحقق، قيمة إن لم يتحقق)' },
];

function parse(tokens: Tok[]): Node {
  let p = 0;
  const peek = () => tokens[p];
  const eat = (t: Tok['t'], v?: string) => {
    const k = tokens[p];
    if (!k || k.t !== t || (v !== undefined && (k as { v?: string }).v !== v)) return false;
    p++;
    return true;
  };

  function comparison(): Node {
    let a = additive();
    for (;;) {
      const k = peek();
      if (k?.t === 'op' && ['>', '<', '>=', '<=', '=', '!='].includes(k.v)) {
        p++;
        a = { k: 'bin', op: k.v, a, b: additive() };
      } else return a;
    }
  }
  function additive(): Node {
    let a = term();
    for (;;) {
      const k = peek();
      if (k?.t === 'op' && (k.v === '+' || k.v === '-')) {
        p++;
        a = { k: 'bin', op: k.v, a, b: term() };
      } else return a;
    }
  }
  function term(): Node {
    let a = power();
    for (;;) {
      const k = peek();
      if (k?.t === 'op' && (k.v === '*' || k.v === '/')) {
        p++;
        a = { k: 'bin', op: k.v, a, b: power() };
      } else if (k && (k.t === 'num' || k.t === 'ref' || k.t === '(' || k.t === 'id')) {
        // ضرب ضمني: 2{a} أو 2(…)
        a = { k: 'bin', op: '*', a, b: power() };
      } else return a;
    }
  }
  function power(): Node {
    const a = unary();
    const k = peek();
    if (k?.t === 'op' && k.v === '^') {
      p++;
      return { k: 'bin', op: '^', a, b: power() };
    }
    return a;
  }
  function unary(): Node {
    const k = peek();
    if (k?.t === 'op' && k.v === '-') { p++; return { k: 'neg', a: unary() }; }
    if (k?.t === 'op' && k.v === '+') { p++; return unary(); }
    return primary();
  }
  function primary(): Node {
    const k = peek();
    if (!k) throw new FormulaError('المعادلة ناقصة');
    if (k.t === 'num') { p++; return { k: 'num', v: k.v }; }
    if (k.t === 'ref') { p++; return { k: 'ref', id: k.v }; }
    if (k.t === '(') {
      p++;
      const e = comparison();
      if (!eat(')')) throw new FormulaError('قوس ( غير مغلق');
      return e;
    }
    if (k.t === 'id') {
      const fn = FN_ALIASES[k.v] ?? FN_ALIASES[k.v.toLowerCase()];
      if (!fn) throw new FormulaError(`دالة غير معروفة: ${k.v}`);
      p++;
      if (!eat('(')) throw new FormulaError(`بعد «${k.v}» يجب أن يأتي قوس (`);
      const args: Node[] = [];
      if (!eat(')')) {
        do args.push(comparison()); while (eat(','));
        if (!eat(')')) throw new FormulaError(`قوس الدالة «${k.v}» غير مغلق`);
      }
      if (fn === 'if' && args.length !== 3) throw new FormulaError('دالة «اذا» تحتاج ثلاثة أجزاء: الشرط، ثم القيمتين');
      if (['round', 'ceil', 'floor', 'abs'].includes(fn) && (args.length < 1 || args.length > 2)) {
        throw new FormulaError(`دالة «${k.v}» تحتاج قيمة واحدة`);
      }
      if (args.length === 0) throw new FormulaError(`دالة «${k.v}» فارغة`);
      return { k: 'call', fn, args };
    }
    throw new FormulaError('ترتيب غير صحيح في المعادلة');
  }

  const node = comparison();
  if (p < tokens.length) throw new FormulaError('يوجد شيء زائد في نهاية المعادلة');
  return node;
}

const cache = new Map<string, Node>();

export function compile(expr: string): Node {
  const hit = cache.get(expr);
  if (hit) return hit;
  const tokens = tokenize(expr);
  if (!tokens.length) throw new FormulaError('المعادلة فارغة');
  const node = parse(tokens);
  if (cache.size > 500) cache.clear();
  cache.set(expr, node);
  return node;
}

/** كل الأعمدة التي تعتمد عليها المعادلة */
export function refsOf(expr: string): string[] {
  const out = new Set<string>();
  const walk = (n: Node) => {
    if (n.k === 'ref') out.add(n.id);
    else if (n.k === 'neg') walk(n.a);
    else if (n.k === 'bin') { walk(n.a); walk(n.b); }
    else if (n.k === 'call') n.args.forEach(walk);
  };
  walk(compile(expr));
  return [...out];
}

/** تقريب نصف للأعلى (٤٩٫٥ → ٥٠) بدقة عشرية آمنة */
export function roundHalfUp(n: number, digits = 0): number {
  const f = 10 ** digits;
  return Math.round((n + Math.sign(n) * Number.EPSILON) * f) / f;
}

type Val = number | null;

function evalNode(n: Node, get: (id: string) => Val): Val {
  switch (n.k) {
    case 'num': return n.v;
    case 'ref': return get(n.id);
    case 'neg': { const a = evalNode(n.a, get); return a == null ? null : -a; }
    case 'bin': {
      const a = evalNode(n.a, get);
      const b = evalNode(n.b, get);
      if (a == null || b == null) return null;
      switch (n.op) {
        case '+': return a + b;
        case '-': return a - b;
        case '*': return a * b;
        case '/': return b === 0 ? null : a / b;
        case '^': return a ** b;
        case '>': return a > b ? 1 : 0;
        case '<': return a < b ? 1 : 0;
        case '>=': return a >= b - 1e-9 ? 1 : 0;
        case '<=': return a <= b + 1e-9 ? 1 : 0;
        case '=': return Math.abs(a - b) < 1e-9 ? 1 : 0;
        case '!=': return Math.abs(a - b) >= 1e-9 ? 1 : 0;
      }
      return null;
    }
    case 'call': {
      if (n.fn === 'if') {
        const c = evalNode(n.args[0], get);
        if (c == null) return null;
        return evalNode(c ? n.args[1] : n.args[2], get);
      }
      const vals = n.args.map((a) => evalNode(a, get));
      const present = vals.filter((v): v is number => v != null);
      switch (n.fn) {
        case 'avg': return present.length ? present.reduce((s, v) => s + v, 0) / present.length : null;
        case 'sum': return present.length ? present.reduce((s, v) => s + v, 0) : null;
        case 'max': return present.length ? Math.max(...present) : null;
        case 'min': return present.length ? Math.min(...present) : null;
        case 'round': {
          if (vals[0] == null) return null;
          const d = vals[1] ?? 0;
          return roundHalfUp(vals[0], d);
        }
        case 'ceil': return vals[0] == null ? null : Math.ceil(vals[0] - 1e-9);
        case 'floor': return vals[0] == null ? null : Math.floor(vals[0] + 1e-9);
        case 'abs': return vals[0] == null ? null : Math.abs(vals[0]);
      }
      return null;
    }
  }
}

export function evaluate(expr: string, get: (id: string) => Val): Val {
  const v = evalNode(compile(expr), get);
  return v == null || !Number.isFinite(v) ? null : v;
}

export function applyRounding(v: Val, mode: GradeColumn['round']): Val {
  if (v == null) return null;
  if (mode === 'int') return roundHalfUp(v, 0);
  if (mode === '1dp') return roundHalfUp(v, 1);
  return roundHalfUp(v, 4);
}

/** ترتيب حساب الأعمدة المحسوبة (كل عمود بعد ما يعتمد عليه)، مع كشف الدوران */
export function computeOrder(columns: GradeColumn[]): string[] {
  const byId = new Map(columns.map((c) => [c.id, c]));
  const order: string[] = [];
  const state = new Map<string, 1 | 2>();
  const visit = (id: string, path: string[]) => {
    const col = byId.get(id);
    if (!col || col.kind !== 'formula') return;
    const s = state.get(id);
    if (s === 2) return;
    if (s === 1) {
      const names = [...path.slice(path.indexOf(id)), id].map((x) => byId.get(x)?.name ?? x);
      throw new FormulaError(`المعادلات تدور على نفسها: ${names.join(' ← ')}`);
    }
    state.set(id, 1);
    for (const r of safeRefs(col.formula ?? '')) visit(r, [...path, id]);
    state.set(id, 2);
    order.push(id);
  };
  for (const c of columns) visit(c.id, []);
  return order;
}

function safeRefs(expr: string): string[] {
  try { return refsOf(expr); } catch { return []; }
}

/**
 * يحسب صف طالب كاملاً: يأخذ قيم أعمدة الإدخال ويُرجع كل الأعمدة (إدخال + محسوبة).
 * المعادلة الخاطئة تُرجع فارغاً بدل أن تكسر السجل.
 */
export function evaluateRow(columns: GradeColumn[], inputs: Record<string, Val>): Record<string, Val> {
  const out: Record<string, Val> = {};
  for (const c of columns) if (c.kind === 'input') out[c.id] = inputs[c.id] ?? null;
  let order: string[];
  try { order = computeOrder(columns); } catch { order = []; }
  const byId = new Map(columns.map((c) => [c.id, c]));
  for (const id of order) {
    const col = byId.get(id)!;
    try {
      out[id] = applyRounding(evaluate(col.formula ?? '', (r) => out[r] ?? null), col.round);
    } catch {
      out[id] = null;
    }
  }
  for (const c of columns) if (!(c.id in out)) out[c.id] = null;
  return out;
}

/** يتحقق من معادلة قبل حفظها — يُرجع رسالة خطأ عربية أو null */
export function validateFormula(expr: string, columns: GradeColumn[], selfId?: string): string | null {
  try {
    const refs = refsOf(expr);
    const ids = new Set(columns.map((c) => c.id));
    for (const r of refs) {
      if (!ids.has(r)) return 'المعادلة تشير إلى عمود غير موجود';
      if (r === selfId) return 'لا يمكن للعمود أن يعتمد على نفسه';
    }
    const trial = columns.map((c) => (c.id === selfId ? { ...c, formula: expr } : c));
    if (selfId && !trial.some((c) => c.id === selfId)) trial.push({ id: selfId, name: 'العمود الجديد', kind: 'formula', max: 100, formula: expr });
    computeOrder(trial);
    // تجربة حساب بقيم وهمية
    evaluate(expr, () => 1);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'معادلة غير صحيحة';
  }
}

/** {id} ← [اسم العمود] للعرض */
export function formulaToDisplay(expr: string, columns: GradeColumn[]): string {
  const names = new Map(columns.map((c) => [c.id, c.name]));
  return expr.replace(/\{([^}]+)\}/g, (_, id: string) => `[${names.get(id.trim()) ?? '؟'}]`);
}

/** [اسم العمود] ← {id} للحفظ */
export function displayToFormula(text: string, columns: GradeColumn[]): string {
  const ids = new Map(columns.map((c) => [c.name.trim(), c.id]));
  return text.replace(/\[([^\]]+)\]/g, (m, name: string) => {
    const id = ids.get(name.trim());
    if (!id) throw new FormulaError(`لا يوجد عمود باسم «${name.trim()}»`);
    return `{${id}}`;
  });
}

/** معادلات جاهزة يبنيها المدرس بضغطة */
export const quickFormula = {
  avg: (ids: string[]) => `معدل(${ids.map((i) => `{${i}}`).join('، ')})`,
  sum: (ids: string[]) => `مجموع(${ids.map((i) => `{${i}}`).join('، ')})`,
  max: (ids: string[]) => `أعلى(${ids.map((i) => `{${i}}`).join('، ')})`,
  min: (ids: string[]) => `أدنى(${ids.map((i) => `{${i}}`).join('، ')})`,
  /** معدل مرجّح: الأوزان بالنسب (مثلاً ٢٥، ٢٥، ٥٠) */
  weighted: (items: { id: string; weight: number }[]) => {
    const total = items.reduce((s, i) => s + i.weight, 0) || 1;
    return `(${items.map((i) => `{${i.id}}*${i.weight}`).join(' + ')}) / ${total}`;
  },
  /** تحويل درجة من عظمى إلى أخرى (مثل من ١٠ إلى ١٠٠) */
  scale: (id: string, fromMax: number, toMax: number) => `{${id}} * ${toMax} / ${fromMax}`,
};
