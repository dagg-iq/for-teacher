/**
 * يولّد أيقونات «رَصد» من الرمز نفسه (ra-path.txt = حرف الراء من ثمانية Serif Display Black) (SVG) بالمتصفح — نفس LogoMark في التطبيق تماماً.
 * الرمز «رَ»: حرف الراء بخط ثمانية العريض + فتحة ذهبية (طبشورة).
 *   node scripts/gen-icons.cjs
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const RA = fs.readFileSync(path.join(__dirname, 'ra-path.txt'), 'utf8').trim();
const BOARD = '#123A33', CREAM = '#F5F2EA', GOLD = '#F2B544', WHITE = '#FFFFFF';
// الفتحة: شرطة مائلة فوق رأس الراء
const FATHA = 'M54 14 L76 5';

const mark = (ink, dot, scale = 1) => `<g transform="translate(60 60) scale(${scale}) translate(-60 -60)">
  <path d="${RA}" fill="${ink}"/>
  <path d="${FATHA}" stroke="${dot}" stroke-width="8" stroke-linecap="round" fill="none"/>
</g>`;

function svg(size, { bg, ink, dot, scale, radius = 0 }) {
  const r = radius ? (radius / size) * 120 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 120 120">
  ${bg ? `<rect width="120" height="120" rx="${r}" fill="${bg}"/>` : ''}
  ${mark(ink, dot, scale)}
</svg>`;
}

const OUT = path.join(ROOT, 'apps/mobile/assets/images');
const SITE = path.join(ROOT, 'apps/site');
const jobs = [
  // الأيقونة: ذهبي الطباشير والحرف بأخضر السبورة
  [`${OUT}/icon.png`, 1024, { bg: GOLD, ink: BOARD, dot: BOARD, scale: 0.74 }],
  [`${OUT}/android-icon-foreground.png`, 1024, { ink: BOARD, dot: BOARD, scale: 0.5 }],
  [`${OUT}/android-icon-background.png`, 1024, { bg: GOLD, ink: 'none', dot: 'none', scale: 1 }],
  [`${OUT}/android-icon-monochrome.png`, 1024, { ink: WHITE, dot: WHITE, scale: 0.5 }],
  [`${OUT}/splash-icon.png`, 512, { ink: BOARD, dot: GOLD, scale: 0.9 }],
  [`${OUT}/splash-icon-dark.png`, 512, { ink: CREAM, dot: GOLD, scale: 0.9 }],
  [`${OUT}/favicon.png`, 96, { bg: GOLD, ink: BOARD, dot: BOARD, scale: 0.84, radius: 24 }],
  [`${OUT}/notification-icon.png`, 96, { ink: WHITE, dot: WHITE, scale: 0.94 }],
  [`${SITE}/icon-512.png`, 512, { bg: GOLD, ink: BOARD, dot: BOARD, scale: 0.74, radius: 112 }],
  [`${SITE}/apple-touch-icon.png`, 180, { bg: GOLD, ink: BOARD, dot: BOARD, scale: 0.74 }],
  [`${SITE}/favicon.png`, 64, { bg: GOLD, ink: BOARD, dot: BOARD, scale: 0.84, radius: 16 }],
  [`${SITE}/og-icon.png`, 1024, { bg: GOLD, ink: BOARD, dot: BOARD, scale: 0.74 }],
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const [file, size, o] of jobs) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg(size, o)}</body></html>`);
    await page.locator('svg').screenshot({ path: file, omitBackground: true });
  }
  fs.writeFileSync(path.join(SITE, 'logo.svg'), svg(120, { ink: BOARD, dot: GOLD, scale: 1 }));
  await browser.close();
  console.log('✓ icons');
})();
