/**
 * يولّد كل أيقونات «نَهج» (التطبيق، أندرويد، شاشة البداية، الإشعار، الموقع) من الرمز نفسه في
 * packages/shared/src/brand.ts — فتطابق LogoMark داخل التطبيق تماماً.
 *   node scripts/gen-icons.cjs
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const brand = fs.readFileSync(path.join(ROOT, 'packages/shared/src/brand.ts'), 'utf8');
const get = (name) => brand.match(new RegExp(`export const ${name} = '([^']+)'`))[1];
const num = (name) => Number(brand.match(new RegExp(`export const ${name} = (\\d+)`))[1]);
const BOWL = get('MARK_BOWL'), DOT = get('MARK_DOT'), STROKE = num('MARK_STROKE'), OY = num('MARK_OFFSET_Y');
const WM = JSON.parse(fs.readFileSync(path.join(ROOT, 'brand/wordmark.json'), 'utf8'));
const GREEN = '#0E3B33', PAPER = '#F7F5F0', GOLD = '#E3A535', WHITE = '#FFFFFF';

function mark({ ink, dot, bg, scale = 1, radius = 0, size = 120 }) {
  const t = (120 - 120 * scale) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 120 120">${bg ? `<rect width="120" height="120" rx="${radius}" fill="${bg}"/>` : ''}<g transform="translate(${t} ${t}) scale(${scale}) translate(0 ${OY})"><path d="${BOWL}" stroke="${ink}" stroke-width="${STROKE}" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="${DOT}" fill="${dot}"/></g></svg>`;
}

/** شعار أفقي: الرمز يميناً والكلمة يساراً (اتجاه القراءة) */
function lockup({ ink, dot, word }) {
  const s = 0.62, wh = WM.ar_display.h * s, ww = WM.ar_display.w * s, mh = 120 * s;
  const W = ww + 18 + mh, H = mh;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W.toFixed(1)} ${H.toFixed(1)}"><g transform="translate(0 ${((H - wh) / 2).toFixed(1)}) scale(${s})"><path d="${WM.ar_display.d}" fill="${word}"/></g><g transform="translate(${(ww + 18).toFixed(1)} 0) scale(${s}) translate(0 ${OY})"><path d="${BOWL}" stroke="${ink}" stroke-width="${STROKE}" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="${DOT}" fill="${dot}"/></g></svg>`;
}

const OUT = path.join(ROOT, 'apps/mobile/assets/images');
const SITE = path.join(ROOT, 'apps/site');
const jobs = [
  [`${OUT}/icon.png`, 1024, { bg: GREEN, ink: PAPER, dot: GOLD, scale: 0.9 }],
  [`${OUT}/android-icon-foreground.png`, 1024, { ink: PAPER, dot: GOLD, scale: 0.62 }],
  [`${OUT}/android-icon-background.png`, 1024, { bg: GREEN, ink: 'none', dot: 'none' }],
  [`${OUT}/android-icon-monochrome.png`, 1024, { ink: WHITE, dot: WHITE, scale: 0.62 }],
  [`${OUT}/splash-icon.png`, 512, { ink: GREEN, dot: GOLD, scale: 1 }],
  [`${OUT}/splash-icon-dark.png`, 512, { ink: PAPER, dot: GOLD, scale: 1 }],
  [`${OUT}/favicon.png`, 96, { bg: GREEN, ink: PAPER, dot: GOLD, scale: 0.94, radius: 26 }],
  [`${OUT}/notification-icon.png`, 96, { ink: WHITE, dot: WHITE, scale: 1 }],
  [`${SITE}/icon-512.png`, 512, { bg: GREEN, ink: PAPER, dot: GOLD, scale: 0.9, radius: 27 }],
  [`${SITE}/apple-touch-icon.png`, 180, { bg: GREEN, ink: PAPER, dot: GOLD, scale: 0.9 }],
  [`${SITE}/favicon.png`, 64, { bg: GREEN, ink: PAPER, dot: GOLD, scale: 0.94, radius: 26 }],
  [`${SITE}/og-icon.png`, 1024, { bg: GREEN, ink: PAPER, dot: GOLD, scale: 0.9 }],
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
  fs.writeFileSync(`${B}/app-icon.svg`, mark({ bg: GREEN, ink: PAPER, dot: GOLD, scale: 0.9, radius: 27 }));
  fs.writeFileSync(`${B}/logo.svg`, lockup({ ink: GREEN, dot: GOLD, word: GREEN }));
  fs.writeFileSync(`${B}/logo-light.svg`, lockup({ ink: PAPER, dot: GOLD, word: PAPER }));
  fs.writeFileSync(`${SITE}/logo.svg`, lockup({ ink: GREEN, dot: GOLD, word: GREEN }));
  fs.writeFileSync(`${SITE}/logo-light.svg`, lockup({ ink: PAPER, dot: GOLD, word: PAPER }));
  await browser.close();
  console.log('✓ icons + brand/*.svg');
})();
