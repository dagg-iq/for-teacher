/**
 * يولّد كل أيقونات «نَهج» (التطبيق، أندرويد، شاشة البداية، الإشعار، الموقع) من الشعار الكوفي نفسه في
 * packages/shared/src/brand.ts — فتطابق LogoMark داخل التطبيق تماماً.
 *   node scripts/gen-icons.cjs
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const brand = fs.readFileSync(path.join(ROOT, 'packages/shared/src/brand.ts'), 'utf8');
const { ROWS, N, LX, LY, BASELINE, TAIL, cells } = require('../brand/kufic.cjs');
const WM = JSON.parse(fs.readFileSync(path.join(ROOT, 'brand/wordmark.json'), 'utf8'));
const GREEN = '#0E3B33', PAPER = '#F7F5F0', GOLD = '#E3A535', WHITE = '#FFFFFF';

const C = cells();

/** pad: الهامش بوحدة الخلية */
function mark({ ink, dot, bg, pad = 0, radius = 0.225, size = 120 }) {
  const n = N + 2 * pad;
  const crisp = size <= 64 ? ' shape-rendering="crispEdges"' : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${-pad} ${-pad} ${n} ${n}"${crisp}>${bg ? `<rect x="${-pad}" y="${-pad}" width="${n}" height="${n}" rx="${(n * radius).toFixed(2)}" fill="${bg}"/>` : ''}${ink === 'none' ? '' : `<path d="${C.ink}" fill="${ink}"/><path d="${C.dot}" fill="${dot}"/>`}</svg>`;
}

/** شعار أفقي: الرمز يميناً وكلمة «نَهج» يساراً */
function lockup({ ink, dot, word }) {
  const mh = 64, s = mh / N;                 // الرمز بارتفاع ٦٤
  const ws = (mh * 0.92) / WM.ar_display.h;  // الكلمة بارتفاع قريب
  const ww = WM.ar_display.w * ws, wh = WM.ar_display.h * ws, gap = 20;
  const W = ww + gap + mh;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W.toFixed(1)} ${mh}"><g transform="translate(0 ${((mh - wh) / 2).toFixed(1)}) scale(${ws.toFixed(4)})"><path d="${WM.ar_display.d}" fill="${word}"/></g><g transform="translate(${(ww + gap).toFixed(1)} 0) scale(${s})"><path d="${C.ink}" fill="${ink}"/><path d="${C.dot}" fill="${dot}"/></g></svg>`;
}

const OUT = path.join(ROOT, 'apps/mobile/assets/images');
const SITE = path.join(ROOT, 'apps/site');
const jobs = [
  [`${OUT}/icon.png`, 1024, { bg: GREEN, ink: PAPER, dot: GOLD, pad: 2.6, radius: 0 }],
  [`${OUT}/android-icon-foreground.png`, 1024, { ink: PAPER, dot: GOLD, pad: 7.2 }],
  [`${OUT}/android-icon-background.png`, 1024, { bg: GREEN, ink: 'none', dot: 'none', pad: 0, radius: 0 }],
  [`${OUT}/android-icon-monochrome.png`, 1024, { ink: WHITE, dot: WHITE, pad: 7.2 }],
  [`${OUT}/splash-icon.png`, 512, { ink: GREEN, dot: GOLD, pad: 0.6 }],
  [`${OUT}/splash-icon-dark.png`, 512, { ink: PAPER, dot: GOLD, pad: 0.6 }],
  [`${OUT}/favicon.png`, 96, { bg: GREEN, ink: PAPER, dot: GOLD, pad: 1.8 }],
  [`${OUT}/notification-icon.png`, 96, { ink: WHITE, dot: WHITE, pad: 0.8 }],
  [`${SITE}/icon-512.png`, 512, { bg: GREEN, ink: PAPER, dot: GOLD, pad: 2.6 }],
  [`${SITE}/apple-touch-icon.png`, 180, { bg: GREEN, ink: PAPER, dot: GOLD, pad: 2.6, radius: 0 }],
  [`${SITE}/favicon.png`, 64, { bg: GREEN, ink: PAPER, dot: GOLD, pad: 1.6 }],
  [`${SITE}/og-icon.png`, 1024, { bg: GREEN, ink: PAPER, dot: GOLD, pad: 2.6, radius: 0 }],
  [path.join(ROOT, 'apps/desktop/build/icon.png'), 1024, { bg: GREEN, ink: PAPER, dot: GOLD, pad: 2.2, radius: 0.225 }],
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const [file, size, o] of jobs) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<html><body style="margin:0;background:transparent">${mark({ ...o, size })}</body></html>`);
    await page.locator('svg').screenshot({ path: file, omitBackground: true });
  }
  // ملفات الهوية (SVG) للاستخدام في أي مكان
  const B = path.join(ROOT, 'brand');
  fs.writeFileSync(`${B}/mark.svg`, mark({ ink: GREEN, dot: GOLD }));
  fs.writeFileSync(`${B}/mark-light.svg`, mark({ ink: PAPER, dot: GOLD }));
  fs.writeFileSync(`${B}/app-icon.svg`, mark({ bg: GREEN, ink: PAPER, dot: GOLD, pad: 2.6 }));
  fs.writeFileSync(`${B}/logo.svg`, lockup({ ink: GREEN, dot: GOLD, word: GREEN }));
  fs.writeFileSync(`${B}/logo-light.svg`, lockup({ ink: PAPER, dot: GOLD, word: PAPER }));
  fs.writeFileSync(`${SITE}/logo.svg`, lockup({ ink: GREEN, dot: GOLD, word: GREEN }));
  fs.writeFileSync(`${SITE}/logo-light.svg`, lockup({ ink: PAPER, dot: GOLD, word: PAPER }));
  await browser.close();
  console.log('✓ icons + brand/*.svg');
})();
