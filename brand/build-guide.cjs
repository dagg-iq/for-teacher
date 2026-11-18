/**
 * يبني دليل هوية «نَهج» (brand/guide.html) من المصادر الحقيقية:
 * الرمز والكلمة (brand.ts, wordmark.json)، الأيقونات (components/icon.tsx)، الخطوط، وصور التطبيق.
 *   node brand/build-guide.cjs
 */
const fs = require('fs');
const path = require('path');
const R = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(R, p), 'utf8');
const b64 = (p) => fs.readFileSync(path.join(R, p)).toString('base64');

const brand = read('packages/shared/src/brand.ts');
const { ROWS, N, LX, LY, BASELINE, TAIL, cells } = require('./kufic.cjs');
const K = cells();
const WM = JSON.parse(read('brand/wordmark.json'));

// الأيقونات من ملف التطبيق نفسه
const icon = read('apps/mobile/src/components/icon.tsx');
const objOf = (name) => {
  const start = icon.indexOf(`const ${name}`);
  const open = icon.indexOf('{', icon.indexOf('=', start));
  let depth = 0, i = open;
  for (; i < icon.length; i++) { if (icon[i] === '{') depth++; if (icon[i] === '}') { depth--; if (!depth) break; } }
  return icon.slice(open, i + 1);
};
const rh = (x, y, r) => { const h = r * 0.82; return `M${x - h} ${y - h}h${2 * h}v${2 * h}h${-2 * h}z`; };
const PATHS = new Function(`return ${objOf('PATHS')}`)();
const CIRCLES = new Function(`return ${objOf('CIRCLES')}`)();
const ACCENTS = new Function('rh', `return ${objOf('ACCENTS')}`)(rh);
const TINTS = new Function(`return ${objOf('TINTS')}`)();
const iconSvg = (name) => `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">${(TINTS[name] || []).map((d) => `<path d="${d}" style="fill:currentColor;fill-opacity:.14;stroke:none"/>`).join('')}${(PATHS[name] || []).map((d) => `<path d="${d}" class="i-s"${name === 'play' ? ' style="fill:currentColor"' : ''}/>`).join('')}${(CIRCLES[name] || []).map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}" class="i-s"${r < 1 ? ' style="fill:currentColor"' : ''}/>`).join('')}${(ACCENTS[name] || []).map((d) => `<path d="${d}" class="i-a"/>`).join('')}</svg>`;

const mark = (ink, dot, extra = '') => `<svg viewBox="-0.6 -0.6 ${N + 1.2} ${N + 1.2}" ${extra}><path d="${K.ink}" fill="${ink}"/><path d="${K.dot}" fill="${dot}"/></svg>`;
/** الرمز على شبكته الظاهرة مع تعليقات: الحروف، خط القاعدة، الخلية الذهبية */
const gridMark = () => {
  let g = '';
  for (const v of LX) g += `<path d="M${v} ${LY[0]}V${LY.at(-1)}" stroke="var(--line)" stroke-width="0.04"/>`;
  for (const v of LY) g += `<path d="M${LX[0]} ${v}H${LX.at(-1)}" stroke="var(--line)" stroke-width="0.04"/>`;
  return `<svg viewBox="-0.8 -0.8 ${N + 1.6} ${N + 1.6}" class="gridmark">${g}<path d="${K.ink}" fill="var(--ink)" opacity=".92"/><path d="${K.dot}" fill="#E3A535"/>
  <path d="M${LX[0] - 0.4} ${BASELINE}H${LX.at(-1) + 0.4}M${LX[0] - 0.4} ${TAIL}H${LX.at(-1) + 0.4}" stroke="#E3A535" stroke-width="0.08" stroke-dasharray="0.25 0.18"/></svg>`;
};
const MH = 64, WS = (MH * 0.92) / WM.ar_display.h, WW = WM.ar_display.w * WS, WH = WM.ar_display.h * WS, LW = WW + 20 + MH;
const lockup = (ink, dot) => `<svg viewBox="0 0 ${LW.toFixed(1)} ${MH}" class="lockup"><g transform="translate(0 ${((MH - WH) / 2).toFixed(1)}) scale(${WS.toFixed(4)})"><path d="${WM.ar_display.d}" fill="${ink}"/></g><g transform="translate(${(WW + 20).toFixed(1)} 0) scale(${MH / N})"><path d="${K.ink}" fill="${ink}"/><path d="${K.dot}" fill="${dot}"/></g></svg>`;
const appIcon = `<svg viewBox="-2.6 -2.6 ${N + 5.2} ${N + 5.2}"><rect x="-2.6" y="-2.6" width="${N + 5.2}" height="${N + 5.2}" rx="${((N + 5.2) * 0.225).toFixed(2)}" fill="#0E3B33"/><path d="${K.ink}" fill="#F7F5F0"/><path d="${K.dot}" fill="#E3A535"/></svg>`;

const FEATURED = [
  ['home', 'الرئيسية'], ['school', 'الصفوف'], ['chart', 'الدرجات'], ['calendar', 'الجدول'], ['apps', 'المزيد'],
  ['table', 'السجل'], ['clipboard', 'التحضير'], ['check-square', 'الحضور'], ['mic', 'الإدخال الصوتي'], ['formula', 'المعادلات'],
  ['users', 'الطلاب'], ['excel', 'Excel'], ['print', 'طباعة'], ['timer', 'المؤقت'], ['shuffle', 'القرعة'], ['flag', 'المهام'],
  ['pie', 'الإحصاء'], ['bell', 'التذكير'], ['cloud', 'المزامنة'], ['settings', 'الإعدادات'],
];

const COLORS = [
  ['أخضر نَهج', '#0E3B33', 'الأسطح البارزة، الأيقونة، رأس الرئيسية', '#FFFFFF'],
  ['الأخضر المائي', '#0B6E5E', 'الأزرار والتفاعل والتبويب النشط', '#FFFFFF'],
  ['ذهبي الخلية', '#E3A535', 'الخلية المضيئة في الشعار والأيقونات فقط', '#2B1E00'],
  ['الورق', '#F7F5F0', 'خلفية التطبيق والموقع', '#14211E'],
  ['الحبر', '#14211E', 'النصوص', '#FFFFFF'],
  ['الخط الفاصل', '#E6E2D9', 'حدود البطاقات (بلا ظلال)', '#14211E'],
];
const TONES = [['ناجح', '#E5F3EC', '#0B6B4B'], ['قريب', '#FBEFDF', '#8A4700'], ['راسب', '#FBE6E4', '#A82620'], ['معلومة', '#E6EEFA', '#1F4C8F']];

const shots = ['home', 'table', 'stats', 'schedule'].map((n) => `data:image/webp;base64,${b64(`apps/site/screens/${n}.webp`)}`);
const font = (f) => `data:font/woff2;base64,${b64(`apps/site/fonts/${f}.woff2`)}`;

const html = `<title>هوية نَهج</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
/* التخطيط: صفحة دليل هوية بأقسام متتالية، رأس أخضر عميق، شبكات للألوان والأيقونات */
@font-face { font-family: NahjSans; src: url(${font('thmanyahsans-Regular')}) format('woff2'); font-weight: 400; }
@font-face { font-family: NahjSans; src: url(${font('thmanyahsans-Bold')}) format('woff2'); font-weight: 700; }
@font-face { font-family: NahjDisplay; src: url(${font('thmanyahserifdisplay-Black')}) format('woff2'); font-weight: 900; }
:root {
  --paper: #F7F5F0; --card: #FFFFFF; --ink: #14211E; --ink2: #5A6662; --line: #E6E2D9;
  --green: #0E3B33; --teal: #0B6E5E; --gold: #E3A535; --soft: #E8F1EE; --on-green: #FFFFFF; --on-green2: #AFC8C1;
  --display: NahjDisplay, 'Noto Naskh Arabic', serif; --sans: NahjSans, 'Noto Sans Arabic', Tahoma, sans-serif;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --paper: #0B1412; --card: #121E1B; --ink: #EBF1EE; --ink2: #98A8A3; --line: #21302C; --green: #14423A; --teal: #4CC2AE; --soft: #16302B; color-scheme: dark } }
:root[data-theme="dark"] { --paper: #0B1412; --card: #121E1B; --ink: #EBF1EE; --ink2: #98A8A3; --line: #21302C; --green: #14423A; --teal: #4CC2AE; --soft: #16302B; color-scheme: dark }
* { box-sizing: border-box }
body { background: var(--paper); color: var(--ink); font-family: var(--sans); font-size: 16px; line-height: 1.75; direction: rtl }
.wrap { max-width: 1080px; margin: 0 auto; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)) }
h1, h2, h3 { font-family: var(--display); font-weight: 900; line-height: 1.35; margin: 0; text-wrap: balance }
h2 { font-size: clamp(26px, 4vw, 36px); display: flex; align-items: center; gap: 14px }
h2::before { content: ''; width: 10px; height: 10px; background: var(--gold); flex: none }
p { margin: 0; color: var(--ink2); max-width: 64ch }
section { padding-block: 56px; border-top: 1px solid var(--line); display: grid; gap: 22px }
.label { font-size: 12px; letter-spacing: .04em; color: var(--ink2); font-weight: 700 }

.hero { background: #0E3B33; color: #fff; padding-block: 64px 56px }
.hero .wrap { display: grid; gap: 26px }
.hero .lockup { width: min(380px, 84vw); height: auto }
.hero p { color: #AFC8C1; font-size: 19px }
.hero .tag { font-family: var(--display); font-size: clamp(30px, 5vw, 48px); color: #fff }
.hero .tag span { color: #E3A535 }

.anatomy { display: grid; grid-template-columns: minmax(0, 320px) minmax(0, 1fr); gap: 32px; align-items: center }
.anatomy .big { background: var(--card); border: 1px solid var(--line); border-radius: 24px; padding: 18px; aspect-ratio: 1; max-width: 100% }
.gridmark { width: 100%; height: auto; display: block }
.anatomy ol { margin: 0; padding: 0; list-style: none; display: grid; gap: 16px }
.anatomy li { display: grid; grid-template-columns: 34px 1fr; gap: 12px; align-items: start }
.anatomy li b { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 50%; background: var(--soft); color: var(--teal); font-size: 14px }
.anatomy li strong { display: block; color: var(--ink) }

.logos { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px }
.logo-tile { border-radius: 22px; border: 1px solid var(--line); padding: 30px; display: grid; place-items: center; min-height: 170px; gap: 12px }
.logo-tile .lockup { width: 230px; max-width: 100%; height: auto }
.logo-tile .m { width: 92px; height: 92px }
.logo-tile .cap { font-size: 13px; color: inherit; opacity: .75 }
.t-paper { background: #F7F5F0; color: #14211E } .t-green { background: #0E3B33; color: #fff } .t-card { background: var(--card); color: var(--ink) }

.colors { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px }
.sw { border-radius: 18px; overflow: hidden; border: 1px solid var(--line); background: var(--card) }
.sw .chip { height: 96px; display: flex; align-items: flex-end; padding: 10px 14px; font-weight: 700; font-size: 13px; font-variant-numeric: tabular-nums; direction: ltr; justify-content: flex-end }
.sw .txt { padding: 10px 14px 14px }
.sw .txt strong { display: block; font-size: 15px }
.sw .txt span { font-size: 13px; color: var(--ink2) }
.tones { display: flex; flex-wrap: wrap; gap: 8px }
.pill { border-radius: 999px; padding: 4px 14px; font-weight: 700; font-size: 14px }

.type { display: grid; gap: 14px }
.type .row { display: grid; grid-template-columns: 170px minmax(0, 1fr); gap: 18px; align-items: baseline; padding-block: 12px; border-bottom: 1px solid var(--line) }
.type .d1 { font-family: var(--display); font-size: 44px; line-height: 1.4 }
.type .d2 { font-family: var(--display); font-size: 28px }
.type .b1 { font-size: 17px; font-weight: 700 }
.type .b2 { font-size: 15px; color: var(--ink2) }

.icons { display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: 10px }
.ic { background: var(--card); border: 1px solid var(--line); border-radius: 18px; padding: 16px 8px 12px; display: grid; justify-items: center; gap: 8px; color: var(--teal) }
.ic svg { width: 34px; height: 34px }
.ic span { font-size: 12.5px; color: var(--ink2) }
.i-s { stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; fill: none }
.i-a { fill: var(--gold) }
.icon-anatomy { display: flex; flex-wrap: wrap; gap: 18px; align-items: center }
.icon-anatomy .ic { width: 150px } .icon-anatomy .ic svg { width: 84px; height: 84px }

.rules { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px }
.rule { background: var(--card); border: 1px solid var(--line); border-radius: 18px; padding: 18px; display: grid; gap: 6px }
.rule strong { font-size: 16px }

.screens { display: flex; gap: 16px; overflow-x: auto; padding-bottom: 8px }
.screens img { width: 220px; border-radius: 26px; border: 1px solid var(--line); flex: none }
footer { padding-block: 32px 48px; border-top: 1px solid var(--line); color: var(--ink2); font-size: 14px }
@media (max-width: 640px) { .anatomy { grid-template-columns: 1fr } .type .row { grid-template-columns: 1fr; gap: 4px } }
</style>

<header class="hero"><div class="wrap">
  ${lockup('#FFFFFF', '#E3A535')}
  <div class="tag">التدريس <span>بنهجٍ أذكى.</span></div>
  <p>دليل الهوية البصرية لتطبيق «نَهج»، رفيق المدرّس العراقي: الصفوف والطلاب، سجلات الدرجات، الحضور، الجدول، دفتر التحضير، والطباعة الرسمية.</p>
</div></header>

<main class="wrap">
  <section>
    <h2>الاسم</h2>
    <p><strong style="color:var(--ink)">نَهج</strong> هو الطريق الواضح والمنهج. لكل مدرّس نهجه في التدريس، والتطبيق يرتّب هذا النهج كله في مكان واحد: الصفوف، الدرجات، الحضور، الجدول، والتحضير. الاسم قصير، عربي فصيح، رسمي، ولا يرتبط بميزة واحدة.</p>
  </section>

  <section>
    <h2>الرمز</h2>
    <div class="anatomy">
      <div class="big">${gridMark()}</div>
      <ol>
        <li><b>١</b><div><strong>الخط الكوفي — من العراق</strong>وُلد الخط الكوفي في الكوفة، أقدم خطوط العربية. شعار تطبيق عراقي بخط عراقي الأصل.</div></li>
        <li><b>٢</b><div><strong>الكلمة كاملة على شبكة</strong>«نهج» بالكوفي المربّع على شبكة ١١×١٣ — مثل سجل الدرجات وجدول الحصص: كل حرف في خانته. النون قائمة، والهاء بعروتين فوق القاعدة وتحتها، والجيم برأسها ونقطتها وذيل يمتد تحت الكلمة كلها. الخطوط أعرض من الفراغات (٥ إلى ٣) فيبقى الرمز واضحاً حتى في أصغر أيقونة.</div></li>
        <li><b>٣</b><div><strong>خط القاعدة هو النهج</strong>خطّا القاعدة (المنقّطان بالذهبي في الرسم): الأول يربط الحروف الثلاثة في سطر واحد، والثاني ذيل الجيم يحمل الكلمة كلها: الطريق الذي يجمع عمل المدرّس كله.</div></li>
        <li><b>٤</b><div><strong>خلية ذهبية واحدة</strong>نقطة النون هي الخانة الوحيدة المضيئة في الشبكة — الدرجة التي تُكتب، والحصة الحاضرة. وهي توقيع الهوية كلها: في الأيقونات وقبل العناوين.</div></li>
      </ol>
    </div>
  </section>

  <section>
    <h2>الشعار</h2>
    <div class="logos">
      <div class="logo-tile t-paper">${lockup('#0E3B33', '#E3A535')}<div class="cap">الأساسي — على الورق</div></div>
      <div class="logo-tile t-green">${lockup('#FFFFFF', '#E3A535')}<div class="cap">المعكوس — على الأخضر</div></div>
      <div class="logo-tile t-card"><div class="m">${appIcon}</div><div class="cap">أيقونة التطبيق</div></div>
      <div class="logo-tile t-paper"><div class="m">${mark('#0E3B33', '#E3A535')}</div><div class="cap">الرمز وحده</div></div>
    </div>
    <p>المسافة الآمنة حول الشعار خليتان من شبكته على الأقل. يبقى مقروءاً حتى ١٦ بكسل لأنه مبني على الشبكة نفسها. لا يُمدّ ولا يُدوَّر ولا يُلوَّن بغير ألوان الهوية، والخلية الذهبية لا تتغير.</p>
  </section>

  <section>
    <h2>الألوان</h2>
    <div class="colors">
      ${COLORS.map(([n, hex, use, on]) => `<div class="sw"><div class="chip" style="background:${hex};color:${on}">${hex}</div><div class="txt"><strong>${n}</strong><span>${use}</span></div></div>`).join('')}
    </div>
    <div class="label">ألوان النتائج (للدرجات والحضور فقط)</div>
    <div class="tones">${TONES.map(([n, bg, fg]) => `<span class="pill" style="background:${bg};color:${fg}">${n}</span>`).join('')}</div>
    <p>الذهبي لا يُستخدم للأزرار ولا للخلفيات: هو لون الخلية المضيئة وحدها، فيبقى نادراً ولافتاً.</p>
  </section>

  <section>
    <h2>الخط</h2>
    <div class="type">
      <div class="row"><span class="label">ثمانية Serif Display · ٩٠٠</span><span class="d1">التدريس بنهجٍ أذكى</span></div>
      <div class="row"><span class="label">ثمانية Serif Display · عناوين</span><span class="d2">سجل السعي السنوي — الخامس العلمي / أ</span></div>
      <div class="row"><span class="label">ثمانية Sans · ٧٠٠</span><span class="b1">نسبة النجاح ٧٨٪ · المعدل ٦٨٫٤</span></div>
      <div class="row"><span class="label">ثمانية Sans · ٤٠٠</span><span class="b2">الأرقام عربية مشرقية (٠١٢٣…) والفاصلة العشرية «٫»، وكل الواجهة من اليمين لليسار.</span></div>
    </div>
  </section>

  <section>
    <h2>الأيقونات</h2>
    <p>مجموعة مرسومة خصيصاً لنَهج على شبكة ٢٤، بخط ١٫٨ وأطراف دائرية. توقيعها: <strong style="color:var(--ink)">الخلية الذهبية</strong> من الشعار، تظهر في الأيقونات الأساسية: نافذة البيت، قمّة أعلى عمود في الدرجات، اليوم في التقويم، وثلاث خلايا في «المزيد».</p>
    <div class="icon-anatomy">
      ${['home', 'chart', 'calendar', 'apps'].map((n) => `<div class="ic">${iconSvg(n)}</div>`).join('')}
    </div>
    <div class="icons">
      ${FEATURED.map(([n, l]) => `<div class="ic">${iconSvg(n)}<span>${l}</span></div>`).join('')}
    </div>
  </section>

  <section>
    <h2>قواعد الواجهة</h2>
    <div class="rules">
      <div class="rule"><strong>مسطّحة بلا ظلال</strong><p>البطاقات بحدّ رفيع بلون الخط الفاصل، والتمييز بالمسافات لا بالظلال.</p></div>
      <div class="rule"><strong>الخلية علامة القسم</strong><p>خلية ذهبية مربعة قبل عناوين الصفحات والأقسام، بدل الخطوط والزخارف.</p></div>
      <div class="rule"><strong>لون تفاعل واحد</strong><p>الأخضر المائي للأزرار والتبويب النشط والاختيار، والأخضر العميق للأسطح البارزة.</p></div>
      <div class="rule"><strong>زوايا هادئة</strong><p>١٨–٢٢ للبطاقات، كاملة للأزرار والشرائح، وأهداف لمس ٤٤ بكسل على الأقل.</p></div>
      <div class="rule"><strong>حركة قصيرة</strong><p>٢٢٠ مللي ثانية أو أقل، بلا ارتداد، وتحترم «تقليل الحركة».</p></div>
      <div class="rule"><strong>بلا إيموجي</strong><p>الأيقونات المرسومة فقط، والعربية أولاً في كل نص.</p></div>
    </div>
  </section>

  <section>
    <h2>في التطبيق</h2>
    <div class="screens">${shots.map((u) => `<img src="${u}" alt="">`).join('')}</div>
  </section>
</main>
<footer><div class="wrap">نَهج · دليل الهوية · الأصول: brand/*.svg في المستودع، ومصدر الرمز packages/shared/src/brand.ts</div></footer>
`;
fs.writeFileSync(path.join(__dirname, 'guide.html'), html);
console.log('✓ brand/guide.html', (html.length / 1024).toFixed(0), 'KB');
