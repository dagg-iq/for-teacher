/**
 * يلتقط صور التطبيق للموقع التعريفي (بيانات تجريبية، دقة ×٢):
 *   node e2e/site-shots.cjs /tmp/web out-dir     ثم حوّلها إلى webp في apps/site/screens (Pillow: quality 82)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const dir = process.argv[2] || '/tmp/web';
const out = process.argv[3] || path.join(__dirname, 'site-shots');
fs.mkdirSync(out, { recursive: true });
const types = { '.js': 'text/javascript', '.html': 'text/html', '.png': 'image/png', '.otf': 'font/otf', '.ico': 'image/x-icon' };
const server = http.createServer((req, res) => {
  let f = path.join(dir, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dir, 'index.html');
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

async function shoot(base, scheme, plan) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme, locale: 'ar-IQ' });
  const page = await ctx.newPage();
  await page.goto(base + '/?demo', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.getByText('لنبدأ', { exact: true }).click();
  await page.waitForTimeout(400);
  await page.getByText('جرّب ببيانات تجريبية').click();
  await page.waitForTimeout(1500);
  const ids = await page.evaluate(() => {
    const g = (t) => JSON.parse(localStorage.getItem(`nahj.t.${t}`) || '[]');
    const books = g('gradebooks');
    const saey = books.find((b) => b.template === 'saey');
    return { book: saey.id, col: saey.columns.find((c) => c.kind === 'input' && c.name === 'نصف السنة').id, monthly: books.find((b) => b.template === 'monthly').id };
  });
  await plan(page, base, ids);
  await browser.close();
}

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = `http://localhost:${server.address().port}`;
  const snap = (page, name) => page.screenshot({ path: path.join(out, `${name}.png`) });
  await shoot(base, 'light', async (page, b, ids) => {
    await page.goto(b + '/', { waitUntil: 'networkidle' }); await page.waitForTimeout(1200); await snap(page, 'home');
    await page.goto(`${b}/book/${ids.book}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(900);
    await page.getByText('الجدول', { exact: true }).first().click(); await page.waitForTimeout(700); await snap(page, 'table');
    await page.goto(`${b}/book/stats?id=${ids.monthly}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1200); await snap(page, 'stats');
    await page.goto(`${b}/book/columns?id=${ids.book}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(900); await snap(page, 'formula');
    await page.goto(`${b}/schedule`, { waitUntil: 'networkidle' }); await page.waitForTimeout(900);
    await page.getByText('الأسبوع', { exact: true }).click(); await page.waitForTimeout(600); await snap(page, 'schedule');
    await page.goto(`${b}/voice?book=${ids.book}&column=${ids.col}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(900);
    await page.getByText(/^ابدأ/).first().click(); await page.waitForTimeout(700);
    await page.getByLabel('إعدادات الصوت').click(); await page.waitForTimeout(300);
    await page.getByText('خانة الكتابة', { exact: true }).click(); await page.mouse.click(200, 60); await page.waitForTimeout(400);
    const names = await page.evaluate(() => JSON.parse(localStorage.getItem('nahj.t.students') || '[]').map((s) => s.name));
    const box = page.getByPlaceholder(/أو اكتب: أحمد علي (٨٥|85)/);
    const say = async (t) => { await box.fill(t); await box.press('Enter'); await page.waitForTimeout(250); };
    const sorted = await page.evaluate(() => [...document.querySelectorAll('div')].length);
    void sorted; void names;
    // أسماء الشعبة الأولى بالترتيب الظاهر
    const visible = await page.evaluate(() => document.body.innerText.split('\n').filter((l) => /^[؀-ۿ ]{8,}$/.test(l.trim())).slice(0, 6));
    if (visible[1]) { await say(`${visible[1].split(' ').slice(0, 2).join(' ')} تسعين`); await say('نعم'); }
    if (visible[2]) { await say(`${visible[2].split(' ').slice(0, 2).join(' ')} خمسة وسبعين`); await say('نعم'); }
    if (visible[3]) { await say(`${visible[3].split(' ').slice(0, 2).join(' ')} سبعطعش`); await say('نعم'); }
    if (visible[4]) await say(`${visible[4].split(' ').slice(0, 2).join(' ')} ثمانين ونص`);
    await page.getByPlaceholder(/أو اكتب: أحمد علي (٨٥|85)/).blur();
    await page.waitForTimeout(300);
    await snap(page, 'voice');
  });
  await shoot(base, 'dark', async (page, b) => {
    await page.goto(b + '/', { waitUntil: 'networkidle' }); await page.waitForTimeout(1200); await snap(page, 'home-dark');
  });
  server.close();
  console.log('✓', fs.readdirSync(out).join(' '));
})().catch((e) => { console.error(e); process.exit(1); });
