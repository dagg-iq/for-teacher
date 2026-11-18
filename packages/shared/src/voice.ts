/**
 * فهم الكلام في «الإدخال الصوتي»:
 *  - توحيد الكتابة العربية (الهمزات، التاء المربوطة، الألف المقصورة، التشكيل، «ال»).
 *  - تحويل الأعداد المنطوقة إلى أرقام بالفصحى واللهجة العراقية
 *    («خمسة وسبعين»، «سبعطعش»، «مية»، «تسعين ونص»، و«85» إن كتبها المحرك أرقاماً).
 *  - مطابقة اسم الطالب بالتقريب (أخطاء التعرّف على الكلام شائعة).
 *  - استخراج النية: درجة لطالب، غائب، تراجع، التالي، توقف…
 */
import type { Student } from './types';

// ------------------------------------------------------------------ التوحيد
const DIACRITICS = /[ً-ٰٟۖ-ۭـ]/g;

export function normalizeArabic(input: string): string {
  return input
    .replace(DIACRITICS, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ء/g, '')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/٫/g, '.')
    .replace(/[^\p{L}\p{N}.\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** يحذف «ال» التعريف من بداية الكلمة (لمطابقة «الحسن» مع «حسن») */
function stripAl(w: string) {
  return w.length > 3 && w.startsWith('ال') ? w.slice(2) : w;
}

// ------------------------------------------------------------------ الأعداد
const UNITS: Record<string, number> = {
  صفر: 0, زيرو: 0,
  واحد: 1, واحده: 1, وحده: 1, احد: 1,
  اثنين: 2, اثنان: 2, اثنتين: 2, ثنين: 2, تنين: 2, اتنين: 2, اثنا: 2, اثني: 2,
  ثلاثه: 3, ثلاث: 3, تلاثه: 3, تلاث: 3,
  اربعه: 4, اربع: 4,
  خمسه: 5, خمس: 5,
  سته: 6, ست: 6,
  سبعه: 7, سبع: 7,
  ثمانيه: 8, ثماني: 8, ثمان: 8, ثمنيه: 8, ثمنه: 8, تمنيه: 8, تمانيه: 8,
  تسعه: 9, تسع: 9,
  عشره: 10, عشر: 10,
};

const TEENS: Record<string, number> = {
  احدعشر: 11, احدعش: 11, حدعش: 11, احداعش: 11, حداعش: 11, حدعشر: 11, احدطعش: 11,
  اثناعشر: 12, اثنيعشر: 12, اثنعش: 12, ثنعش: 12, اطنعش: 12, ثناعش: 12, اثنعشر: 12, طنعش: 12, ثنطعش: 12,
  ثلاثهعشر: 13, ثلطعش: 13, تلطعش: 13, ثلثطعش: 13, تلتطعش: 13, ثلتعش: 13, تلتعش: 13, ثلاثطعش: 13, تلاطعش: 13,
  اربعهعشر: 14, اربعطعش: 14, اربطعش: 14, ربعطعش: 14, اربعتعش: 14, ارباطعش: 14, اربعتاعش: 14,
  خمسهعشر: 15, خمسطعش: 15, خمستعش: 15, خمصطعش: 15, خمسطاعش: 15, خمستاعش: 15,
  ستهعشر: 16, ستطعش: 16, سطعش: 16, ستعش: 16, سطاعش: 16, ستاعش: 16, سدعش: 16,
  سبعهعشر: 17, سبعطعش: 17, سبعتعش: 17, سبعطاعش: 17, سبعتاعش: 17,
  ثمانيهعشر: 18, ثمنطعش: 18, ثمانطعش: 18, تمنطعش: 18, ثمنتعش: 18, تمنتعش: 18, ثمانتعش: 18, تمانتعش: 18,
  ثمنتاعش: 18, ثمنطاعش: 18, ثمانطاعش: 18, ثمانيطعش: 18, ثمانيتعش: 18, تمانطعش: 18,
  تسعهعشر: 19, تسعطعش: 19, تسعتعش: 19, تسعطاعش: 19, تسعتاعش: 19,
};

/** اللاحقة العامية للأعداد ١١–١٩ إذا كتبها المحرك كلمة منفصلة: «ثمن طعش» */
const TEEN_SUFFIX = new Set(['طعش', 'تعش', 'طاعش', 'تاعش', 'طعشر', 'تعشر']);

const TENS: Record<string, number> = {
  عشرين: 20, عشرون: 20,
  ثلاثين: 30, ثلاثون: 30, تلاثين: 30, تلتين: 30,
  اربعين: 40, اربعون: 40,
  خمسين: 50, خمسون: 50,
  ستين: 60, ستون: 60,
  سبعين: 70, سبعون: 70,
  ثمانين: 80, ثمانون: 80, ثمنين: 80, تمانين: 80,
  تسعين: 90, تسعون: 90,
};

const HUNDREDS: Record<string, number> = {
  ميه: 100, مييه: 100, مايه: 100, مائه: 100, ماه: 100, ميت: 100, مئه: 100,
  ميتين: 200, مئتين: 200, مئتان: 200, ميتان: 200,
};

const FRACTIONS: Record<string, number> = {
  نص: 0.5, نصف: 0.5, ربع: 0.25, ثلث: 1 / 3,
};

/** قيمة كلمة عددية واحدة (بعد التوحيد)، أو null */
function wordValue(w: string): { v: number; kind: 'unit' | 'teen' | 'ten' | 'hundred' | 'frac' | 'digits' } | null {
  if (/^\d+(\.\d+)?$/.test(w)) return { v: Number(w), kind: 'digits' };
  if (w in UNITS) return { v: UNITS[w], kind: 'unit' };
  if (w in TEENS) return { v: TEENS[w], kind: 'teen' };
  if (w in TENS) return { v: TENS[w], kind: 'ten' };
  if (w in HUNDREDS) return { v: HUNDREDS[w], kind: 'hundred' };
  if (w in FRACTIONS) return { v: FRACTIONS[w], kind: 'frac' };
  return null;
}

export interface NumberMatch {
  value: number;
  /** موضع أول كلمة وآخر كلمة في قائمة الكلمات */
  start: number;
  end: number;
}

/**
 * يبحث عن أول عدد في الكلمات (بعد التوحيد) ويُرجع قيمته وموضعه.
 * يفهم: «خمسة وسبعين» = ٧٥، «مية» = ١٠٠، «تسعين ونص» = ٩٠٫٥، «ثلاثة عشر» = ١٣، «سبعطعش» = ١٧، «85».
 */
export function findNumber(words: string[]): NumberMatch | null {
  for (let i = 0; i < words.length; i++) {
    const first = wordValue(words[i]);
    if (!first || first.kind === 'frac') continue;
    let total = 0;
    let pending = 0; // آحاد تنتظر عشرات بعدها («خمسة وسبعين»)
    let end = i;
    let j = i;
    let last: 'unit' | 'teen' | 'ten' | 'hundred' | 'digits' | null = null;
    while (j < words.length) {
      const w = words[j];
      if (w === 'و') {
        // الواو تربط جزأين من العدد فقط
        if (last && j + 1 < words.length && wordValue(words[j + 1])) { j++; continue; }
        break;
      }
      // «ثلاثة عشر» كلمتان
      if (j + 1 < words.length && (words[j + 1] === 'عشر' || words[j + 1] === 'عشره')) {
        const u = wordValue(w);
        if (u && u.kind === 'unit' && u.v >= 1 && u.v <= 9 && (last === null || last === 'hundred')) {
          total += 10 + u.v;
          last = 'teen';
          end = j + 1;
          j += 2;
          continue;
        }
      }
      const wv = wordValue(w);
      if (!wv) break;
      if (wv.kind === 'frac') {
        if (!last) break;
        total += pending + wv.v;
        pending = 0;
        end = j;
        break;
      }
      if (last === 'digits' || last === 'teen' || last === 'ten') break;
      if (wv.kind === 'digits') {
        if (last) break;
        total = wv.v;
        last = 'digits';
        end = j;
        j++;
        continue;
      }
      if (wv.kind === 'hundred') {
        if (last) break;
        total += wv.v;
        last = 'hundred';
      } else if (wv.kind === 'ten') {
        total += pending + wv.v;
        pending = 0;
        last = 'ten';
      } else if (wv.kind === 'teen') {
        if (last === 'unit') break;
        total += wv.v;
        last = 'teen';
      } else {
        // آحاد
        if (last === 'unit') break;
        pending += wv.v;
        last = 'unit';
      }
      end = j;
      j++;
    }
    return { value: total + pending, start: i, end };
  }
  return null;
}

/** يحوّل نصاً كاملاً إلى عدد إن وُجد */
export function parseSpokenNumber(text: string): number | null {
  const m = findNumber(tokens(text));
  return m ? m.value : null;
}

function tokens(text: string): string[] {
  const norm = normalizeArabic(text).replace(/(\d)\s*\.\s*(\d)/g, '$1.$2');
  const out: string[] = [];
  const raw = norm.split(' ').filter(Boolean);
  // «ثمن طعش» / «ست طعش» ← كلمة واحدة
  const words: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    if (i + 1 < raw.length && TEEN_SUFFIX.has(raw[i + 1])) {
      const joined = raw[i] + 'طعش';
      const alt = raw[i] + raw[i + 1];
      if (joined in TEENS || alt in TEENS) { words.push(joined in TEENS ? joined : alt); i++; continue; }
    }
    words.push(raw[i]);
  }
  for (const w of words) {
    // «وخمسين» ← «و» + «خمسين» (إلا الكلمات التي تبدأ بالواو أصلاً مثل «واحد»)
    if (w.length > 2 && w.startsWith('و') && !wordValue(w) && wordValue(w.slice(1))) {
      out.push('و', w.slice(1));
      continue;
    }
    // «ل85» أو «85درجه»
    const m = w.match(/^(\D*?)(\d+(?:\.\d+)?)(\D*)$/);
    if (m && (m[1] || m[3])) {
      if (m[1]) out.push(m[1]);
      out.push(m[2]);
      if (m[3]) out.push(m[3]);
      continue;
    }
    out.push(w);
  }
  return out;
}

// ------------------------------------------------------------------ مطابقة الأسماء
/** مسافة التحرير بين كلمتين */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** تشابه كلمتين ٠–١ (مع تجاهل «ال» والحروف المتقاربة صوتياً) */
export function wordSimilarity(a: string, b: string): number {
  const x = phonetic(stripAl(a));
  const y = phonetic(stripAl(b));
  if (x === y) return 1;
  const d = levenshtein(x, y);
  return Math.max(0, 1 - d / Math.max(x.length, y.length));
}

/** حروف يخلط بينها محرك التعرّف أو اللهجة */
function phonetic(w: string) {
  return w
    .replace(/[ثت]/g, 'ت')
    .replace(/[ذزظض]/g, 'ز')
    .replace(/[سصش]/g, 'س')
    .replace(/[قكگ]/g, 'ق')
    .replace(/[حه]/g, 'ه')
    .replace(/[عا]/g, 'ا')
    .replace(/[غخ]/g, 'خ')
    .replace(/[طد]/g, 'د')
    .replace(/[جچ]/g, 'ج')
    .replace(/پ/g, 'ب')
    .replace(/(.)\1+/g, '$1');
}

const NAME_STOP = new Set(['عبد', 'بن', 'ابن', 'ابو', 'ام', 'بنت']);

/** يدمج «عبد الله» إلى «عبدالله» حتى تُعامل كلمة واحدة */
export function nameWords(name: string): string[] {
  const ws = normalizeArabic(name).split(' ').filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < ws.length; i++) {
    if ((ws[i] === 'عبد' || ws[i] === 'ابو') && i + 1 < ws.length) { out.push(ws[i] + ws[i + 1]); i++; } else out.push(ws[i]);
  }
  return out.filter((w) => !NAME_STOP.has(w));
}

export interface NameCandidate {
  student: Student;
  score: number;
}

/**
 * يطابق الكلمات المنطوقة مع أسماء الطلاب. الاسم الأول له الوزن الأكبر، ثم الأب، ثم الجد.
 * يُرجع المرشحين مرتبين (الأفضل أولاً).
 */
export function matchStudents(spoken: string[] | string, students: Student[]): NameCandidate[] {
  const said = typeof spoken === 'string' ? nameWords(spoken) : nameWords(spoken.join(' '));
  if (!said.length) return [];
  const out: NameCandidate[] = [];
  for (const s of students) {
    const parts = nameWords(s.name);
    if (!parts.length) continue;
    // كل كلمة منطوقة تُطابق مع الجزء المقابل من الاسم بالترتيب (مع سماح بتخطي كلمة)
    let score = 0;
    let weightSum = 0;
    let pi = 0;
    for (let k = 0; k < said.length && pi < parts.length; k++) {
      const w = [1, 0.7, 0.5, 0.35][Math.min(k, 3)];
      let best = 0;
      let bestAt = pi;
      for (let q = pi; q < Math.min(parts.length, pi + 2); q++) {
        const sim = wordSimilarity(said[k], parts[q]) * (q === pi ? 1 : 0.85);
        if (sim > best) { best = sim; bestAt = q; }
      }
      score += best * w;
      weightSum += w;
      pi = bestAt + 1;
    }
    // كلمات منطوقة زائدة عن الاسم تُضعف الثقة قليلاً
    const extra = Math.max(0, said.length - parts.length);
    const final = weightSum ? (score / weightSum) * (1 - extra * 0.1) : 0;
    // رقم الطالب منطوقاً بدل الاسم يُعالج في parseCommand
    if (final > 0.45) out.push({ student: s, score: final });
  }
  return out.sort((a, b) => b.score - a.score);
}

// ------------------------------------------------------------------ النية
export type VoiceCommand =
  | { type: 'grade'; value: number; candidates: NameCandidate[]; nameText: string }
  | { type: 'mark'; mark: 'absent' | 'exempt'; candidates: NameCandidate[]; nameText: string }
  | { type: 'select'; candidates: NameCandidate[]; nameText: string }
  | { type: 'value'; value: number }
  | { type: 'absent' }
  | { type: 'undo' }
  | { type: 'next' }
  | { type: 'previous' }
  | { type: 'skip' }
  | { type: 'confirm' }
  | { type: 'cancel' }
  | { type: 'stop' }
  | { type: 'unknown'; text: string };

const CMD: [VoiceCommand['type'], string[]][] = [
  ['undo', ['تراجع', 'تراجعي', 'رجع الدرجه', 'امسح', 'احذف', 'الغي الاخيره', 'الغ الاخيره']],
  ['stop', ['توقف', 'وقف', 'اوقف', 'انهاء', 'خلص', 'خلصنا', 'كافي', 'انتهينا']],
  ['next', ['التالي', 'بعده', 'اللي بعده', 'الي بعده', 'الطالب التالي']],
  ['previous', ['السابق', 'قبله', 'اللي قبله', 'الي قبله', 'ارجع']],
  ['skip', ['تخطي', 'تخطى', 'عدي', 'عبر', 'فوت']],
  ['confirm', ['نعم', 'اي', 'ايه', 'تمام', 'صح', 'اكيد', 'ثبت', 'احفظ', 'موافق', 'اوكي', 'ok']],
  ['cancel', ['لا', 'الغاء', 'الغي', 'غلط', 'خطا', 'كلا', 'مو هذا', 'ليس هذا']],
];

const ABSENT_WORDS = ['غايب', 'غايبه', 'غياب', 'غاب', 'غابت', 'ما حاضر', 'مو موجود', 'ما موجود', 'مو حاضر'];
const EXEMPT_WORDS = ['معفي', 'معفيه', 'اعفاء', 'مستثني', 'مستثنيه'];
const FILLER = new Set(['الطالب', 'الطالبه', 'درجه', 'درجته', 'درجتها', 'الدرجه', 'ياخذ', 'اخذ', 'تاخذ', 'اخذت', 'جاب', 'جابت', 'عنده', 'عندها', 'له', 'لها', 'من', 'على', 'هو', 'هي', 'يا', 'اكتب', 'سجل', 'حط', 'ضع', 'رقم']);

/**
 * يفهم جملة واحدة من المدرس.
 * @param ordered وضع «بالترتيب»: الرقم وحده يُطبق على الطالب الحالي
 */
export function parseCommand(text: string, students: Student[], opts: { ordered?: boolean } = {}): VoiceCommand {
  const norm = normalizeArabic(text);
  if (!norm) return { type: 'unknown', text };
  const ws = tokens(norm);

  // كلمة أمر هي أيضاً اسم طالب في الشعبة (مثل «عدي»): الاسم أولى
  const nameOnly = ws.filter((w) => !FILLER.has(w) && !ABSENT_WORDS.includes(w) && !EXEMPT_WORDS.includes(w) && !wordValue(w) && w !== 'و');
  const asName = ws.length <= 3 && nameOnly.length ? matchStudents(nameOnly.join(' '), students) : [];
  const nameWins = asName.length > 0 && asName[0].score >= 0.9;

  // أوامر قصيرة (الجملة كلها أمر)
  for (const [type, phrases] of nameWins ? [] : CMD) {
    for (const p of phrases) {
      if (norm === p || (ws.length <= 3 && (` ${norm} `).includes(` ${p} `) && !findNumber(ws))) {
        return { type } as VoiceCommand;
      }
    }
  }

  const hasAbsent = ABSENT_WORDS.some((a) => (` ${norm} `).includes(` ${a} `));
  const hasExempt = EXEMPT_WORDS.some((a) => (` ${norm} `).includes(` ${a} `));
  const num = findNumber(ws);

  // رقم تسلسل الطالب: «رقم ٥ تسعين» ← الطالب رقم ٥
  const nameTokens = ws.filter((w, i) => {
    if (num && i >= num.start && i <= num.end) return false;
    if (FILLER.has(w)) return false;
    if (ABSENT_WORDS.includes(w) || EXEMPT_WORDS.includes(w)) return false;
    if (w === 'و') return false;
    return true;
  });
  // الاسم عادة قبل الرقم: نأخذ الكلمات قبله فقط إن وُجدت
  const before = num ? ws.slice(0, num.start).filter((w) => !FILLER.has(w) && !ABSENT_WORDS.includes(w) && !EXEMPT_WORDS.includes(w)) : nameTokens;
  const nameText = (before.length ? before : nameTokens).join(' ');
  const candidates = nameText ? matchStudents(nameText, students) : [];

  if (hasAbsent || hasExempt) {
    if (!nameText) return { type: 'absent' };
    return { type: 'mark', mark: hasAbsent ? 'absent' : 'exempt', candidates, nameText };
  }
  if (num) {
    if (!nameText) return { type: 'value', value: num.value };
    if (!candidates.length && opts.ordered) return { type: 'value', value: num.value };
    return { type: 'grade', value: num.value, candidates, nameText };
  }
  if (candidates.length) return { type: 'select', candidates, nameText };
  return { type: 'unknown', text };
}

// ------------------------------------------------------------------ اختيار أفضل ما سمعه المحرك
/** كلمات الأعداد التي تُرسل للمحرك لتحسين التعرّف عليها (خاصة ١١–١٩ بالعامية حيث يكثر الخلط) */
export const NUMBER_HINTS = [
  'احدعش', 'ثنعش', 'ثلطعش', 'اربعطعش', 'خمسطعش', 'سطعش', 'سبعطعش', 'ثمنطعش', 'تسعطعش',
  'عشرين', 'ثلاثين', 'اربعين', 'خمسين', 'ستين', 'سبعين', 'ثمانين', 'تسعين', 'مية', 'ونص',
  'غايب', 'تراجع', 'التالي', 'نعم',
];

export interface Heard {
  text: string;
  cmd: VoiceCommand;
  /** أعداد مختلفة سمعها المحرك في البدائل الأخرى (للتصحيح بلمسة: «أو ١٨؟») */
  altValues: number[];
}

function cmdValue(c: VoiceCommand): number | null {
  return c.type === 'grade' || c.type === 'value' ? c.value : null;
}

/**
 * المحرك يعطي عدة احتمالات لما قيل (الأرجح أولاً). نختار أول احتمال «منطقي»:
 * اسم معروف بثقة + درجة لا تتجاوز العظمى، ثم الأقل منطقية. وتُجمع الأعداد المختلفة في البدائل
 * حتى يصحّح المدرس بلمسة إن خلط المحرك بين متقاربين صوتياً (ستطعش/ثمنطعش، ستين/سبعين).
 */
export function chooseHeard(texts: string[], students: Student[], opts: { ordered?: boolean; max?: number } = {}): Heard | null {
  const list = texts.map((t) => t.trim()).filter(Boolean);
  if (!list.length) return null;
  const max = opts.max ?? Infinity;
  const scored = list.map((text, i) => {
    const cmd = parseCommand(text, students, opts);
    const v = cmdValue(cmd);
    let score = 0;
    if (cmd.type === 'grade' || cmd.type === 'mark') score = isConfident(cmd.candidates) ? 4 : cmd.candidates.length ? 2.5 : 1;
    else if (cmd.type === 'value') score = 2;
    else if (cmd.type === 'select') score = isConfident(cmd.candidates) ? 2 : 1.5;
    else if (cmd.type !== 'unknown') score = 3;
    if (v != null && (v > max || v < 0)) score -= 3;
    // الاحتمال الأول هو الأرجح عند المحرك: أفضلية صغيرة للترتيب
    score -= i * 0.05;
    return { text, cmd, v, score };
  });
  const best = scored.reduce((a, b) => (b.score > a.score ? b : a));
  const altValues: number[] = [];
  if (best.v != null) {
    for (const s of scored) {
      if (s === best || s.v == null || s.v === best.v || s.v > max || s.v < 0 || altValues.includes(s.v)) continue;
      altValues.push(s.v);
    }
  }
  return { text: best.text, cmd: best.cmd, altValues: altValues.slice(0, 3) };
}

/** هل الفرق بين أفضل مرشحَين صغير (تشابه أسماء يحتاج اختياراً) */
export function isAmbiguous(c: NameCandidate[]): boolean {
  if (c.length < 2) return false;
  return c[0].score - c[1].score < 0.08 && c[1].score > 0.6;
}

/** ثقة كافية للتطبيق التلقائي */
export function isConfident(c: NameCandidate[]): boolean {
  return c.length > 0 && c[0].score >= 0.72 && !isAmbiguous(c);
}

/** العدد بالكلمات العربية (للقراءة الصوتية والتأكيد) */
export function numberToArabicWords(n: number): string {
  const ones = ['صفر', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة',
    'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
  const tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const whole = Math.floor(n);
  const frac = n - whole;
  let s: string;
  if (whole < 20) s = ones[whole];
  else if (whole < 100) s = whole % 10 ? `${ones[whole % 10]} و${tens[Math.floor(whole / 10)]}` : tens[whole / 10];
  else if (whole === 100) s = 'مئة';
  else if (whole === 200) s = 'مئتان';
  else s = String(whole);
  if (Math.abs(frac - 0.5) < 1e-9) s += ' ونصف';
  else if (Math.abs(frac - 0.25) < 1e-9) s += ' وربع';
  else if (frac > 1e-9) s = String(n);
  return s;
}
