/**
 * اختبار دخان لكل الشاشات على نسخة الويب:
 *   npx expo export -p web --output-dir /tmp/web && node e2e/smoke.cjs /tmp/web
 * يفتح التطبيق، يملأ البيانات التجريبية، يمر على كل الشاشات، يلتقط صوراً في e2e/shots، ويفشل عند أي خطأ.
 * متغيرات: THEME=dark  ROUTES=/a,/b  W=390 H=844  SHOTS=dir
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const dir = process.argv[2] || '/tmp/web';
const shots = process.env.SHOTS || path.join(__dirname, 'shots');
fs.mkdirSync(shots, { recursive: true });

const types = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.png': 'image/png', '.otf': 'font/otf', '.ico': 'image/x-icon', '.json': 'application/json', '.ttf': 'font/ttf' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  let f = path.join(dir, u);
  if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dir, 'index.html');
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

const ROUTES = (process.env.ROUTES || [
  '/', '/classes', '/grades', '/schedule', '/more',
  '/class/new', '/book/new', '/voice', '/attendance', '/plans', '/plans/edit', '/tasks', '/picker', '/timer',
  '/account', '/settings', '/about', '/schedule/setup',
].join(',')).split(',');

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = `http://localhost:${server.address().port}`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: Number(process.env.W || 390), height: Number(process.env.H || 844) },
    deviceScaleFactor: Number(process.env.DPR || 1),
    colorScheme: process.env.THEME === 'dark' ? 'dark' : 'light',
    locale: 'ar-IQ',
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource|placeholder\.supabase/.test(m.text())) errors.push(`console: ${m.text()}`); });

  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  // الترحيب ← البيانات التجريبية
  if (page.url().includes('welcome')) {
    await page.screenshot({ path: `${shots}/00-welcome.png` });
    await page.getByText('لنبدأ', { exact: true }).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${shots}/01-profile.png` });
    await page.getByText('جرّب ببيانات تجريبية').click();
    await page.waitForTimeout(1500);
  }
  // معرفات من البيانات المحفوظة
  const ids = await page.evaluate(() => {
    const get = (t) => JSON.parse(localStorage.getItem(`rasd.t.${t}`) || '[]');
    return { classes: get('classes'), sections: get('sections'), students: get('students'), books: get('gradebooks') };
  });
  const extra = [];
  if (ids.classes[0]) extra.push(`/class/${ids.classes[0].id}`);
  if (ids.sections[0]) extra.push(`/section/${ids.sections[0].id}`, `/section/${ids.sections[0].id}?tab=books`, `/section/${ids.sections[0].id}?tab=attendance`, `/section/import?id=${ids.sections[0].id}`, `/attendance?section=${ids.sections[0].id}`, `/voice?section=${ids.sections[0].id}`);
  if (ids.students[0]) extra.push(`/student/${ids.students[0].id}`);
  if (ids.books[0]) extra.push(`/book/${ids.books[0].id}`, `/book/columns?id=${ids.books[0].id}`, `/book/stats?id=${ids.books[0].id}`, `/voice?book=${ids.books[0].id}`);
  const all = process.env.ROUTES ? ROUTES : [...ROUTES, ...extra];
  let i = 2;
  for (const r of all) {
    const before = errors.length;
    await page.goto(base + r, { waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
    const body = await page.evaluate(() => document.body.innerText);
    if (/حدث خطأ غير متوقع|This screen doesn't exist|Unmatched Route/.test(body)) errors.push(`${r}: error screen — ${body.slice(0, 200)}`);
    const name = r.replace(/[/?=&]+/g, '_').replace(/^_/, '') || 'home';
    await page.screenshot({ path: `${shots}/${String(i++).padStart(2, '0')}-${name.slice(0, 60)}.png`, fullPage: !!process.env.FULL });
    console.log(errors.length > before ? '✗' : '✓', r);
  }
  await browser.close();
  server.close();
  if (errors.length) {
    console.error('\nErrors:\n' + [...new Set(errors)].join('\n'));
    process.exit(1);
  }
  console.log('\nكل الشاشات تعمل بلا أخطاء');
})().catch((e) => { console.error(e); process.exit(1); });
