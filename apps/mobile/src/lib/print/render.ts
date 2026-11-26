/**
 * يبني صفحة الطباعة: الترويسة، الأقسام بالترتيب المختار، التواقيع، التذييل، وخطوط التطبيق مضمّنة.
 * التقسيم إلى صفحات A4 يتم داخل الصفحة نفسها (سكربت صغير) فتكون المعاينة هي المطبوع تماماً:
 * الجداول الطويلة تُقسم بين الصفحات مع تكرار رأسها، والعنوان لا يبقى وحيداً أسفل الصفحة، وأرقام الصفحات تُكتب.
 */
import { arDigits, formatNumericDate, formatYear, getDigitStyle, schoolYear, STAGE_LABEL } from '@nahj/shared';
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';
import { getSettings } from '@/data/db';
import { sectionClass, sectionLabel } from '@/data/queries';
import { marginMm, paperSize, type PrintLayout, type PrintStyle } from './style';

export const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** خيار خاص بنوع مطبوع (مثل عدد الأعمدة الفارغة في قائمة الأسماء) */
export interface ExtraDef {
  key: string;
  label: string;
  kind: 'toggle' | 'number' | 'choice' | 'text';
  def: number | boolean | string;
  min?: number;
  max?: number;
  choices?: { key: string; label: string }[];
}

export interface PrintBlock {
  id: string;
  /** اسم القسم في قائمة الأقسام */
  title: string;
  hint?: string;
  /** مفعّل افتراضياً */
  on?: boolean;
  /** محتوى القسم: عناصر متتالية (عنوان h3.keep، فقرات div.atom، جداول table) */
  html: string;
  /** لا محتوى (يظهر في القائمة معطّلاً مع السبب) */
  empty?: string | null;
}

export interface PrintDoc {
  kind: string;
  title: string;
  subtitle: string;
  fileName: string;
  sectionId?: string | null;
  /** يفضّل الوضع الأفقي (جداول عريضة) عند «تلقائي» */
  wide?: boolean;
  blocks: PrintBlock[];
  extras?: ExtraDef[];
  /** عناوين التواقيع (الافتراضي: مدرّس المادة، مدير المدرسة) */
  signers?: { role: string; name: string }[];
}

export interface Overrides {
  title?: string;
  subtitle?: string;
  note?: string;
}

// ------------------------------------------------------------------ الخطوط
const fontCache = new Map<string, string>();
const FACES = {
  sans: [['Body', 400, require('../../../assets/fonts/thmanyahsans-Regular.otf')], ['Body', 700, require('../../../assets/fonts/thmanyahsans-Bold.otf')]],
  serif: [['Body', 400, require('../../../assets/fonts/thmanyahseriftext-Regular.otf')], ['Body', 700, require('../../../assets/fonts/thmanyahseriftext-Bold.otf')]],
  display: [['Display', 900, require('../../../assets/fonts/thmanyahserifdisplay-Black.otf')]],
} as const;

async function faceCss(key: keyof typeof FACES): Promise<string> {
  const hit = fontCache.get(key);
  if (hit != null) return hit;
  const out: string[] = [];
  for (const [family, weight, mod] of FACES[key]) {
    try {
      const asset = Asset.fromModule(mod);
      await asset.downloadAsync();
      let src: string;
      if (Platform.OS === 'web') {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        src = /^(https?:|app:|data:|blob:)/.test(asset.uri) ? asset.uri : `${origin}${asset.uri.startsWith('/') ? '' : '/'}${asset.uri}`;
      } else {
        src = `data:font/otf;base64,${await new File(asset.localUri ?? asset.uri).base64()}`;
      }
      out.push(`@font-face{font-family:${family};font-weight:${weight};src:url(${src}) format('opentype');}`);
    } catch {
      // نكمل بخط النظام
    }
  }
  const css = out.join('\n');
  fontCache.set(key, css);
  return css;
}

async function fontsFor(style: PrintStyle): Promise<string> {
  if (style.font === 'system') return '';
  return [await faceCss(style.font), await faceCss('display')].join('\n');
}

// ------------------------------------------------------------------ الترويسة
export function headerInfo(sectionId?: string | null) {
  const p = getSettings().profile;
  const k = sectionId ? sectionClass(sectionId) : undefined;
  return {
    school: p?.school || '',
    teacher: p?.name || '',
    subject: k?.subject || p?.subject || '',
    section: sectionId ? sectionLabel(sectionId) : '',
    stage: k ? STAGE_LABEL[k.stage] : '',
    year: schoolYear(),
    governorate: p?.governorate || '',
    principal: p?.principal || '',
    gender: p?.gender ?? 'm',
  };
}

function headBlock(doc: PrintDoc, style: PrintStyle, ov: Overrides) {
  const h = headerInfo(doc.sectionId);
  const title = ov.title?.trim() || doc.title;
  const sub = ov.subtitle?.trim() ?? doc.subtitle;
  const right = style.officialHeader
    ? `جمهورية العراق<br>وزارة التربية${h.governorate ? `<br>المديرية العامة لتربية ${esc(h.governorate)}` : ''}`
    : '';
  const left = style.schoolInfo
    ? [h.school && `المدرسة: ${esc(h.school)}`, h.subject && `المادة: ${esc(h.subject)}`, `العام الدراسي: ${esc(formatYear(h.year))}`].filter(Boolean).join('<br>')
    : '';
  const center = `<h1>${esc(title)}</h1>${sub ? `<h2>${esc(sub)}</h2>` : ''}`;
  if (!right && !left) return `<div class="atom doc-head solo"><div class="c">${center}</div></div>`;
  return `<div class="atom doc-head"><div class="r">${right}</div><div class="c">${center}</div><div class="l">${left}</div></div>`;
}

function signBlock(doc: PrintDoc) {
  const h = headerInfo(doc.sectionId);
  const signers = doc.signers ?? [
    { role: h.gender === 'f' ? 'مدرّسة المادة' : 'مدرّس المادة', name: h.teacher },
    { role: 'مدير المدرسة', name: h.principal },
  ];
  return `<div class="atom sign">${signers.map((s) => `<div><b>${esc(s.role)}</b><span>${esc(s.name)}</span></div>`).join('')}</div>`;
}

// ------------------------------------------------------------------ القالب
function themeCss(style: PrintStyle) {
  const a = style.accent;
  const pad = style.density === 'compact' ? '2px 4px' : style.density === 'roomy' ? '7px 8px' : '4px 6px';
  const lh = style.density === 'compact' ? 1.35 : style.density === 'roomy' ? 1.7 : 1.5;
  const zebra = style.zebra && style.theme !== 'ink';
  const fail = !style.highlightFail ? '' : style.theme === 'ink'
    ? 'td.fail{font-weight:700;text-decoration:underline}'
    : 'td.fail{color:#B3261E;font-weight:700}';
  const base = `
  table.t{width:100%;border-collapse:collapse;margin:0 0 2mm}
  table.t th,table.t td{padding:${pad};text-align:center;line-height:${lh};vertical-align:middle}
  table.t th small{display:block;font-weight:400;opacity:.75;font-size:.82em}
  table.t td.name{text-align:right;white-space:nowrap}
  table.t td.txt{text-align:right}
  table.t td.mark{color:#8A4700}
  ${zebra ? 'table.t tbody tr:nth-child(even) td{background:#F6F6F3}' : ''}
  ${fail}`;
  const themes: Record<PrintStyle['theme'], string> = {
    official: `
      table.t th,table.t td{border:1px solid #333}
      table.t th{background:#E8E8E4;font-weight:700}
      .doc-head{border-bottom:2px solid #000}
      h3.bh{border-bottom:1px solid #000}
      .stat{border:1px solid #333}`,
    modern: `
      table.t th,table.t td{border:1px solid #D5DCD9}
      table.t th{background:${a};color:#fff;font-weight:700;border-color:${a}}
      .doc-head{border-bottom:3px solid ${a}}
      .doc-head h1{color:${a}}
      h3.bh{color:${a};border-bottom:2px solid ${a}22}
      h3.bh::before{content:'';display:inline-block;width:2.2mm;height:2.2mm;background:${a};margin-inline-end:2mm;vertical-align:middle}
      .stat{background:${a}12;border:0;border-radius:3mm}
      .stat b{color:${a}}
      .bar i{background:${a}}`,
    minimal: `
      table.t th,table.t td{border:0;border-bottom:1px solid #DDD}
      table.t th{border-bottom:1.5px solid #222;font-weight:700}
      .doc-head{border-bottom:1px solid #222}
      h3.bh{border-bottom:0}
      .stat{border:0;border-bottom:1px solid #DDD;border-radius:0}`,
    ink: `
      table.t th,table.t td{border:1px solid #000}
      table.t th{background:none;font-weight:700}
      .doc-head{border-bottom:1.5px solid #000}
      h3.bh{border-bottom:1px solid #000}
      .stat{border:1px solid #000}
      .bar i{background:#000}
      *{color:#000 !important}`,
  };
  return base + themes[style.theme];
}

// ------------------------------------------------------------------ التقسيم إلى صفحات
const PAGINATE = `
(function(){
  var REPEAT=__REPEAT__, ARAB=__ARAB__;
  var AR='٠١٢٣٤٥٦٧٨٩';
  function dg(n){var s=String(n);return ARAB?s.replace(/[0-9]/g,function(d){return AR[+d];}):s;}
  function el(t,c){var e=document.createElement(t);if(c)e.className=c;return e;}
  var flow=document.getElementById('flow'),out=document.getElementById('pages'),tpl=document.getElementById('foot-tpl');
  var body=null,count=0;
  function newPage(){var p=el('div','page');body=el('div','page-body');p.appendChild(body);
    if(tpl){var f=el('div','page-foot');f.innerHTML=tpl.innerHTML;p.appendChild(f);}out.appendChild(p);count++;}
  function fits(){return body.scrollHeight<=body.clientHeight+1;}
  function onlyKeeps(){for(var i=0;i<body.children.length;i++){if(!body.children[i].classList.contains('keep'))return false;}return true;}
  function breakPage(){var m=[];while(body.lastElementChild&&body.lastElementChild.classList.contains('keep')){m.unshift(body.lastElementChild);body.removeChild(body.lastElementChild);}
    newPage();m.forEach(function(x){body.appendChild(x);});}
  function atom(a){body.appendChild(a);if(fits())return;body.removeChild(a);if(onlyKeeps()){body.appendChild(a);return;}breakPage();body.appendChild(a);}
  function table(t){
    var head=t.tHead,rows=[].slice.call(t.tBodies[0]?t.tBodies[0].rows:[]),first=true,cur,tb;
    function open(){cur=t.cloneNode(false);var cg=t.querySelector('colgroup');if(cg)cur.appendChild(cg.cloneNode(true));
      if(head&&(first||REPEAT))cur.appendChild(head.cloneNode(true));tb=el('tbody');cur.appendChild(tb);body.appendChild(cur);}
    open();
    if(!rows.length){if(!fits()){body.removeChild(cur);if(!onlyKeeps())breakPage();body.appendChild(cur);}return;}
    for(var i=0;i<rows.length;i++){var r=rows[i];tb.appendChild(r);if(fits())continue;tb.removeChild(r);
      if(!tb.rows.length){body.removeChild(cur);if(onlyKeeps()){body.appendChild(cur);tb.appendChild(r);continue;}breakPage();open();tb.appendChild(r);continue;}
      first=false;newPage();open();tb.appendChild(r);}
    if(t.tFoot){var ft=t.tFoot.cloneNode(true);cur.appendChild(ft);if(!fits()){cur.removeChild(ft);}}
  }
  function run(){
    newPage();
    var items=[].slice.call(flow.children);
    for(var i=0;i<items.length;i++){var n=items[i];
      if(n.classList.contains('pb')){if(body.children.length)newPage();continue;}
      if(n.tagName==='TABLE')table(n);else atom(n);}
    flow.parentNode.removeChild(flow);
    var pn=document.querySelectorAll('.pn'),pt=document.querySelectorAll('.pt');
    for(var j=0;j<pn.length;j++)pn[j].textContent=dg(j+1);
    for(var k=0;k<pt.length;k++)pt[k].textContent=dg(count);
    zoom();document.body.classList.add('ready');
    var msg={type:'nahj-paged',pages:count};
    try{if(window.ReactNativeWebView){var sc=document.querySelectorAll('script');for(var q=0;q<sc.length;q++)sc[q].parentNode.removeChild(sc[q]);
      msg.html='<!doctype html>'+document.documentElement.outerHTML;window.ReactNativeWebView.postMessage(JSON.stringify(msg));}}catch(e){}
    try{if(window.parent&&window.parent!==window)window.parent.postMessage(msg,'*');}catch(e){}
  }
  function zoom(){var p=document.querySelector('.page');if(!p)return;var w=p.getBoundingClientRect().width/(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--z'))||1);
    var z=Math.min(1,(window.innerWidth-20)/w);document.documentElement.style.setProperty('--z',String(z>0?z:1));}
  window.addEventListener('resize',zoom);
  var go=function(){setTimeout(run,20);};
  if(document.fonts&&document.fonts.ready){document.fonts.ready.then(go,go);}else{go();}
})();`;

/** صفحة الطباعة الكاملة (HTML) — للمعاينة والطباعة معاً */
export async function renderDoc(doc: PrintDoc, style: PrintStyle, layout: PrintLayout, ov: Overrides = {}): Promise<{ html: string; landscape: boolean }> {
  const landscape = style.orientation === 'landscape' || (style.orientation === 'auto' && !!doc.wide);
  const { w, h } = paperSize(style.paper, landscape);
  const m = marginMm(style.margins);
  const fonts = await fontsFor(style);
  const family = style.font === 'system'
    ? `'Noto Naskh Arabic','Traditional Arabic','Arabic Typesetting',Tahoma,Arial,sans-serif`
    : `Body,'Noto Naskh Arabic',Tahoma,sans-serif`;
  const display = style.font === 'system' ? family : `Display,${family}`;

  const blocks = layout.order
    .map((id) => doc.blocks.find((b) => b.id === id))
    .filter((b): b is PrintBlock => !!b && !layout.off.includes(b.id) && !b.empty && !!b.html.trim());
  const flow = [
    headBlock(doc, style, ov),
    ...blocks.map((b, i) => `${i && layout.breaks.includes(b.id) ? '<div class="pb"></div>' : ''}${b.html}`),
    ov.note?.trim() ? `<div class="atom note">${esc(ov.note.trim()).replace(/\n/g, '<br>')}</div>` : '',
    style.signatures ? signBlock(doc) : '',
  ].join('\n');

  const footParts = [
    style.brand ? '<span class="brand">أُعدّ بتطبيق نَهج</span>' : '<span></span>',
    style.pageNumbers ? '<span>صفحة <i class="pn"></i> من <i class="pt"></i></span>' : '<span></span>',
    style.printDate ? `<span>${esc(formatNumericDate(new Date(), false))}</span>` : '<span></span>',
  ];
  const hasFoot = style.brand || style.pageNumbers || style.printDate;

  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(ov.title?.trim() || doc.title)}</title>
<style>
${fonts}
:root{--z:1}
@page{size:${w}mm ${h}mm;margin:0}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
html,body{margin:0;padding:0}
body{font-family:${family};color:#111;font-size:${style.size}pt;direction:rtl;background:#E9E7E1}
#pages{zoom:var(--z);display:flex;flex-direction:column;align-items:center;gap:14px;padding:12px 0}
.page{width:${w}mm;height:${h - 0.5}mm;padding:${m}mm ${m}mm ${Math.max(5, m - 4)}mm;background:#fff;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.18)}
.page-body{flex:1;min-height:0;overflow:hidden}
.page-foot{height:7mm;display:flex;justify-content:space-between;align-items:flex-end;font-size:7.5pt;color:#8A8A85;border-top:.3mm solid #E4E4E0;padding-top:1mm}
.page-foot i{font-style:normal}
#flow{width:${w - 2 * m}mm}
.doc-head{display:flex;justify-content:space-between;align-items:flex-start;gap:4mm;padding-bottom:2.5mm;margin-bottom:3.5mm}
.doc-head.solo{justify-content:center}
.doc-head .r,.doc-head .l{font-size:.86em;line-height:1.65;min-width:42mm}
.doc-head .l{text-align:left}
.doc-head .c{text-align:center;flex:1}
h1{font-family:${display};font-size:1.6em;margin:0;line-height:1.35}
h2{font-size:1em;margin:1mm 0 0;font-weight:700;color:#444}
h3.bh{font-size:1.08em;margin:4mm 0 2mm;padding-bottom:1mm;font-weight:700}
.atom{margin:0 0 2mm}
.stats{display:flex;flex-wrap:wrap;gap:2mm}
.stat{flex:1 1 24mm;padding:2mm 2.5mm;text-align:center}
.stat b{display:block;font-size:1.35em;font-family:${display}}
.stat span{font-size:.8em;color:#555}
.bars{display:flex;flex-direction:column;gap:1.2mm}
.bar{display:flex;align-items:center;gap:2mm;font-size:.9em}
.bar span{width:32mm}
.bar em{flex:1;height:3.2mm;background:#EFEFEA;position:relative;font-style:normal}
.bar i{position:absolute;top:0;bottom:0;right:0;background:#555}
.bar b{width:16mm;text-align:left}
.para{line-height:1.8}
.note{border:1px dashed #999;padding:2.5mm 3mm;line-height:1.7}
ul.list{margin:0;padding-inline-start:5mm;line-height:1.8}
.sign{display:flex;justify-content:space-between;gap:10mm;margin-top:8mm}
.sign div{text-align:center;min-width:45mm}
.sign span{display:block;margin-top:11mm;border-top:1px dotted #555;padding-top:1mm;min-height:5mm}
.muted{color:#777}
${themeCss(style)}
@media print{body{background:#fff}#pages{zoom:1;padding:0;gap:0;display:block}.page{box-shadow:none;page-break-after:always;break-after:page}.page:last-child{page-break-after:auto;break-after:auto}}
</style></head><body>
<div id="pages"></div>
<div id="flow">${flow}</div>
${hasFoot ? `<template id="foot-tpl">${footParts.join('')}</template>` : ''}
<script>${PAGINATE.replace('__REPEAT__', String(style.repeatHeader)).replace('__ARAB__', String(getDigitStyle() === 'arab'))}</script>
</body></html>`;
  return { html, landscape };
}
