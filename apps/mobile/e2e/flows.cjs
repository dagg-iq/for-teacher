/**
 * اختبار المسارات التفاعلية على نسخة الويب:
 *   node e2e/flows.cjs /tmp/web
 * ١) إنشاء ملف + صف + طلاب بلصق قائمة   ٢) سجل من قالب   ٣) إدخال سريع   ٤) الإدخال الصوتي (بالكتابة)
 * ٥) المعادلة تُحسب   ٦) الحضور   ٧) الجدول
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const dir = process.argv[2] || '/tmp/web';
const shots = process.env.SHOTS || path.join(__dirname, 'shots');
fs.mkdirSync(shots, { recursive: true });
const types = { '.js': 'text/javascript', '.html': 'text/html', '.png': 'image/png', '.otf': 'font/otf', '.ico': 'image/x-icon', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let f = path.join(dir, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dir, 'index.html');
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

let failed = 0;
const ok = (cond, msg) => { console.log(cond ? '✓' : '✗', msg); if (!cond) failed++; };

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = `http://localhost:${server.address().port}`;
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ar-IQ' })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const db = (t) => page.evaluate((t) => JSON.parse(localStorage.getItem(`nahj.t.${t}`) || '[]').filter((r) => !r.deleted), t);
  const wait = (ms = 400) => page.waitForTimeout(ms);
  const click = async (text, exact = true) => { await page.getByText(text, { exact }).first().click(); await wait(); };

  // ١) الترحيب والملف
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await wait(1200);
  await click('لنبدأ');
  await page.getByPlaceholder('مثال: محمد حازم').fill('زينب كاظم');
  await click('ست');
  await click('الكيمياء');
  await click('ابدأ');
  await wait(800);
  ok(page.url().endsWith('/'), 'الملف حُفظ والانتقال للرئيسية');
  const settings = await page.evaluate(() => JSON.parse(localStorage.getItem('nahj.settings') || '{}'));
  ok(settings.profile?.name === 'زينب كاظم' && settings.profile?.gender === 'f', 'الاسم واللقب محفوظان');

  // صف جديد
  await page.goto(base + '/class/new', { waitUntil: 'networkidle' });
  await wait(800);
  await click('الرابع العلمي');
  await click('ب');
  await click('إضافة الصف');
  await wait(800);
  const sections = await db('sections');
  ok(sections.length === 2 && sections.map((s) => s.name).sort().join() === ['أ', 'ب'].sort().join(), 'أُنشئ الصف بشعبتين أ و ب');
  const sec = sections.find((s) => s.name === 'أ');

  // لصق قائمة
  await page.goto(base + `/section/import?id=${sec.id}`, { waitUntil: 'networkidle' });
  await wait(800);
  await page.locator('textarea').first().fill('١- أحمد علي حسين\n٢- علي حسن كاظم\n٣- مصطفى كريم ناصر\n٤- أحمد عادل مهدي\n٥- زيد خالد\n٢- علي حسن كاظم');
  await wait(300);
  await page.getByText(/إضافة ٥ طلاب/).first().click();
  await wait(800);
  const students = await db('students');
  ok(students.length === 5, `أُضيف ٥ طلاب (بلا تكرار) — ${students.length}`);

  // ٢) سجل من قالب
  await page.goto(base + `/book/new?section=${sec.id}`, { waitUntil: 'networkidle' });
  await wait(800);
  await click('فصل دراسي');
  await page.getByPlaceholder('مثال: امتحان الشهر الأول').fill('الفصل الأول');
  await click('إنشاء السجل');
  await wait(1000);
  const books = await db('gradebooks');
  ok(books.length === 1 && books[0].columns.length === 3, 'أُنشئ السجل بثلاثة أعمدة');
  const book = books[0];
  const [m1, m2, avg] = book.columns;

  // ٣) إدخال سريع
  await page.goto(base + `/book/${book.id}`, { waitUntil: 'networkidle' });
  await wait(1000);
  const inputs = page.getByLabel(/^درجة /);
  await inputs.nth(0).fill('٨٠');
  await inputs.nth(0).press('Enter');
  await wait(300);
  await inputs.nth(1).fill('45');
  await inputs.nth(1).press('Enter');
  await wait(300);
  await inputs.nth(2).fill('150');
  await inputs.nth(2).press('Enter');
  await wait(500);
  let grades = await db('grades');
  ok(grades.filter((g) => g.column_id === m1.id && g.value != null).length === 2, 'الإدخال السريع كتب درجتين');
  ok(!grades.some((g) => g.value === 150), 'رُفضت درجة أكبر من العظمى (قبل الإكمال)');
  ok(!grades.some((g) => g.value === 150), 'رُفضت درجة أكبر من العظمى');
  // ملء العمود كاملاً: يجب ألا تقفز الشاشة لعمود آخر
  for (const i of [2, 3, 4]) { await inputs.nth(i).fill('60'); await inputs.nth(i).press('Enter'); await wait(250); }
  await wait(400);
  const colText = await page.evaluate(() => document.body.innerText);
  ok(/الشهر الأول\s*·\s*من ١٠٠\s*·\s*أُدخل ٥ من ٥/.test(colText), 'الإدخال السريع: إكمال العمود لا يقفز لعمود آخر');
  await page.screenshot({ path: `${shots}/flow-entry.png` });

  // ٤) الإدخال الصوتي بالكتابة على العمود الثاني
  await page.goto(base + `/voice?book=${book.id}&column=${m2.id}`, { waitUntil: 'networkidle' });
  await wait(900);
  await page.getByText(/^ابدأ/).first().click();
  await wait(800);
  await page.getByLabel('إعدادات الصوت').click();
  await wait(400);
  await click('خانة الكتابة');
  await page.mouse.click(200, 60);
  await wait(400);
  const box = page.getByPlaceholder('أو اكتب: أحمد علي ٨٥');
  const sayIt = async (t) => { await box.fill(t); await box.press('Enter'); await wait(350); };
  // أسماء الطلاب مرتبة أبجدياً: أحمد عادل، أحمد علي، زيد، علي حسن، مصطفى
  await sayIt('مصطفى خمسة وسبعين');
  await sayIt('نعم');
  await sayIt('احمد علي تسعين');
  await sayIt('نعم');
  await sayIt('خمسين'); // رقم بلا اسم بعد التثبيت: لا يستبدل درجة أحمد علي
  await wait(3500);
  ok((await page.getByText(/لمن؟/).count()) > 0, 'صوتياً: رقم بلا اسم يُسأل «لمن؟» ولا يُكتب للطالب السابق');
  await sayIt('علي حسن مية وعشرين'); // أكبر من العظمى
  await sayIt('زيد غايب');
  await sayIt('نعم');
  await sayIt('احمد ستين'); // اسم متكرر ← اختيار
  await page.screenshot({ path: `${shots}/flow-voice.png` });
  const ambiguous = await page.getByText(/أكثر من طالب/).count();
  ok(ambiguous > 0, 'تشابه الأسماء يطلب الاختيار');
  await page.getByText('أحمد عادل مهدي', { exact: true }).last().click();
  await wait(300);
  await sayIt('نعم');
  await sayIt('تراجع');
  await wait(400);
  grades = await db('grades');
  const byName = Object.fromEntries(students.map((s) => [s.name, s.id]));
  const g2 = (n) => grades.find((g) => g.student_id === byName[n] && g.column_id === m2.id);
  ok(g2('مصطفى كريم ناصر')?.value === 75, 'صوتياً: مصطفى ٧٥');
  ok(g2('أحمد علي حسين')?.value === 90, 'صوتياً: أحمد علي ٩٠');
  ok(g2('زيد خالد')?.mark === 'absent', 'صوتياً: زيد غائب');
  ok(!g2('علي حسن كاظم')?.value, 'صوتياً: رُفضت ١٢٠');
  ok(g2('أحمد عادل مهدي') && g2('أحمد عادل مهدي').value == null, 'صوتياً: التراجع ألغى آخر درجة');

  // ٥) المعادلة: معدل الفصل لأحمد علي = (٨٠ أو ٤٥ حسب الترتيب) …
  await page.goto(base + `/book/${book.id}`, { waitUntil: 'networkidle' });
  await wait(800);
  await click('الجدول');
  await page.screenshot({ path: `${shots}/flow-table.png` });
  const tableText = await page.evaluate(() => document.body.innerText);
  ok(/جيد جداً|امتياز|جيد|متوسط|مقبول|ضعيف/.test(tableText), 'الجدول يعرض التقديرات المحسوبة');

  // ٥ب) استيراد درجات من Excel إلى الشهر الأول (تُستبدل درجة أحمد علي بـ ٦٦)
  {
    const XLSX = require('xlsx');
    const ws = XLSX.utils.aoa_to_sheet([['ت', 'الاسم', 'الشهر الأول'], [1, 'احمد علي حسين', 66], [2, 'زيد خالد', 70], [3, 'شخص غريب تماما', 99]]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'S');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    await page.goto(base + `/book/import?id=${book.id}`, { waitUntil: 'networkidle' });
    await wait(800);
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByText('اختيار ملف Excel').click()]);
    await chooser.setFiles({ name: 'g.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: buf });
    await wait(1200);
    await page.screenshot({ path: `${shots}/flow-import.png` });
    ok((await page.getByText('غير موجود', { exact: true }).count()) > 0, 'الاستيراد: الاسم الغريب «غير موجود»');
    ok((await page.getByText(/«ت» في الملف/).count()) === 0, 'الاستيراد: عمود التسلسل لا يُعامل كدرجات');
    await page.getByText('استيراد', { exact: true }).last().click();
    await wait(800);
    grades = await db('grades');
    const gi = (n) => grades.find((g) => g.student_id === byName[n] && g.column_id === m1.id);
    ok(gi('أحمد علي حسين')?.value === 66 && gi('زيد خالد')?.value === 70, 'الاستيراد: كُتبت درجات Excel في الشهر الأول');
  }

  // ٥ج) تصدير Excel حقيقي: يُنزَّل ملف ويُقرأ ويُتحقق من محتواه
  {
    await page.goto(base + `/book/${book.id}`, { waitUntil: 'networkidle' });
    await wait(800);
    await page.getByLabel('خيارات').click();
    await wait(400);
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByText('تصدير Excel', { exact: true }).click()]);
    const file = await dl.path();
    const XLSX = require('xlsx');
    const wb = XLSX.read(require('fs').readFileSync(file));
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
    const flat = rows.flat().map(String);
    ok(flat.includes('أحمد علي حسين') && flat.includes('66') && wb.Workbook?.Views?.[0]?.RTL, 'تصدير Excel: الأسماء والدرجات، والورقة من اليمين لليسار');
    ok(flat.some((x) => /نسبة النجاح/.test(x)), 'تصدير Excel: فيه الإحصاء');
    // الطباعة: تفتح نافذة فيها الجدول والترويسة
    await page.getByLabel('خيارات').click();
    await wait(400);
    const [popup] = await Promise.all([page.waitForEvent('popup'), page.getByText('طباعة', { exact: true }).click()]);
    await popup.waitForLoadState();
    const html = await popup.content();
    ok(/وزارة التربية/.test(html) && /أحمد علي حسين/.test(html) && /@font-face/.test(html), 'الطباعة: ترويسة رسمية وأسماء وخط مضمّن');
    await popup.setViewportSize({ width: 1123, height: 794 });
    await popup.screenshot({ path: `${shots}/flow-print.png` });
    await popup.close();
  }

  // ٦) الحضور
  await page.goto(base + `/attendance?section=${sec.id}`, { waitUntil: 'networkidle' });
  await wait(800);
  await page.getByLabel(/زيد خالد: حاضر/).click();
  await wait(400);
  const att = await db('attendance');
  ok(att.length === 5 && att.filter((a) => a.status === 'absent').length === 1, 'الحضور: غائب واحد والباقون حاضرون');

  // ٧) الجدول
  await page.goto(base + '/schedule/setup', { waitUntil: 'networkidle' });
  await wait(800);
  await click('حفظ');
  await wait(800);
  const s2 = await page.evaluate(() => JSON.parse(localStorage.getItem('nahj.settings') || '{}'));
  ok(s2.timetable?.periods?.length === 6, 'أُعدّ الجدول بستة حصص');

  ok(errors.length === 0, `بلا أخطاء JavaScript ${errors.length ? errors.join(' | ') : ''}`);
  await browser.close();
  server.close();
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
