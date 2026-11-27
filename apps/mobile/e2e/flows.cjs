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
  await page.getByText(/إضافة (٥|5) طلاب/).first().click();
  await wait(800);
  const students = await db('students');
  ok(students.length === 5, `أُضيف ٥ طلاب (بلا تكرار) — ${students.length}`);

  // ٢) سجلات السنة (الحقول: تحريري ٦٠ + إنشاء ١٠ + شفهي ٣٠)
  await page.goto(base + `/book/year?section=${sec.id}`, { waitUntil: 'networkidle' });
  await wait(900);
  await page.getByText(/^إنشاء السجلات/).first().click();
  await wait(1200);
  const books = await db('gradebooks');
  ok(books.length === 8 && new Set(books.map((b) => b.group_id)).size === 1, `أُنشئت سجلات السنة الثمانية مترابطة — ${books.length}`);
  const bt = (t) => books.find((x) => x.title === t);
  const book = bt('الشهر الأول — الفصل الأول');
  const book2 = bt('الشهر الثاني — الفصل الأول');
  const term1 = bt('سعي الفصل الأول');
  const [m1, m2, m3, total] = book.columns;
  ok(book.columns.length === 4 && total.max === 100 && m1.name === 'التحريري' && m1.max === 60, 'الشهر: التحريري ٦٠ والإنشاء والشفهي والمجموع ١٠٠');
  ok(term1.columns.filter((c) => c.kind === 'link').length === 2 && term1.columns.some((c) => c.boost), 'سعي الفصل: مرتبط بالشهرين ومعه تنبيه الدرجات الحرجة');

  // ٣) إدخال سريع (التحريري من ٦٠)
  await page.goto(base + `/book/${book.id}`, { waitUntil: 'networkidle' });
  await wait(1000);
  const inputs = page.getByLabel(/^درجة /);
  await inputs.nth(0).fill('٥٠');
  await inputs.nth(0).press('Enter');
  await wait(300);
  await inputs.nth(1).fill('45');
  await inputs.nth(1).press('Enter');
  await wait(300);
  await inputs.nth(2).fill('70');
  await inputs.nth(2).press('Enter');
  await wait(500);
  let grades = await db('grades');
  ok(grades.filter((g) => g.column_id === m1.id && g.value != null).length === 2, 'الإدخال السريع كتب درجتين');
  ok(!grades.some((g) => g.value === 70), 'رُفضت درجة أكبر من العظمى (٧٠ من ٦٠)');
  for (const i of [2, 3, 4]) { await inputs.nth(i).fill('40'); await inputs.nth(i).press('Enter'); await wait(250); }
  await wait(400);
  const colText = await page.evaluate(() => document.body.innerText);
  ok(/التحريري\s*·\s*من (٦٠|60)\s*·\s*أُدخل (٥|5) من (٥|5)/.test(colText), 'الإدخال السريع: إكمال العمود لا يقفز لعمود آخر');
  await page.screenshot({ path: `${shots}/flow-entry.png` });

  // ٤) الإدخال الصوتي (وضع الاسم + الدرجة) على «الشفهي» من ٣٠
  await page.goto(base + `/voice?book=${book.id}&column=${m3.id}`, { waitUntil: 'networkidle' });
  await wait(900);
  await click('الاسم + الدرجة');
  await page.getByText(/^ابدأ/).first().click();
  await wait(800);
  await page.getByLabel('إعدادات الصوت').click();
  await wait(400);
  await click('خانة الكتابة');
  await page.mouse.click(200, 60);
  await wait(400);
  const box = page.getByPlaceholder(/أو اكتب: أحمد علي (٨٥|85)/);
  const sayIt = async (t) => { await box.fill(t); await box.press('Enter'); await wait(350); };
  await sayIt('مصطفى خمسة وعشرين');
  await sayIt('نعم');
  await sayIt('احمد علي ثمنطعش');
  await sayIt('نعم');
  await sayIt('عشرين'); // رقم بلا اسم بعد التثبيت: لا يستبدل درجة أحمد علي
  await wait(3500);
  ok((await page.getByText(/لمن؟/).count()) > 0, 'صوتياً: رقم بلا اسم يُسأل «لمن؟» ولا يُكتب للطالب السابق');
  await sayIt('علي حسن اربعين'); // أكبر من العظمى (٣٠)
  await sayIt('زيد غايب');
  await sayIt('نعم');
  await sayIt('احمد عشرين'); // اسم متكرر ← اختيار
  await page.screenshot({ path: `${shots}/flow-voice.png` });
  ok((await page.getByText(/أكثر من طالب/).count()) > 0, 'تشابه الأسماء يطلب الاختيار');
  await page.getByText('أحمد عادل مهدي', { exact: true }).last().click();
  await wait(300);
  await sayIt('نعم');
  await sayIt('تراجع');
  await wait(400);
  grades = await db('grades');
  const byName = Object.fromEntries(students.map((s) => [s.name, s.id]));
  const g2 = (n) => grades.find((g) => g.student_id === byName[n] && g.column_id === m3.id);
  ok(g2('مصطفى كريم ناصر')?.value === 25, 'صوتياً: مصطفى ٢٥');
  ok(g2('أحمد علي حسين')?.value === 18, 'صوتياً: أحمد علي «ثمنطعش» = ١٨');
  ok(g2('زيد خالد')?.mark === 'absent', 'صوتياً: زيد غائب');
  ok(!g2('علي حسن كاظم')?.value, 'صوتياً: رُفضت ٤٠ (أكبر من ٣٠)');
  ok(g2('أحمد عادل مهدي') && g2('أحمد عادل مهدي').value == null, 'صوتياً: التراجع ألغى آخر درجة');

  // ٥) السعي من السجلات + الدرجات الحرجة: أحمد علي ٤٨ في الشهر الأول و٤٧ في الثاني ← ٤٨ (حرجة) ← يرفعها المدرس إلى ٥٠
  {
    const ahmad = byName['أحمد علي حسين'];
    await page.evaluate(({ ahmad, book, book2 }) => {
      const now = new Date().toISOString();
      const gs = JSON.parse(localStorage.getItem('nahj.t.grades') || '[]').filter((g) => !(g.student_id === ahmad && (g.gradebook_id === book.id || g.gradebook_id === book2.id)));
      const put = (b, vals) => b.columns.filter((c) => c.kind === 'input').forEach((c, i) => gs.push({ id: `${b.id}|${ahmad}|${c.id}`, gradebook_id: b.id, student_id: ahmad, column_id: c.id, value: vals[i], mark: null, created_at: now, updated_at: now }));
      put(book, [30, 5, 13]); put(book2, [30, 5, 12]);
      localStorage.setItem('nahj.t.grades', JSON.stringify(gs));
    }, { ahmad, book, book2 });
    await page.goto(base + `/book/${term1.id}`, { waitUntil: 'networkidle' });
    await wait(1200);
    ok((await page.getByText(/حرجة قريبة من النجاح/).count()) > 0, 'سعي الفصل: يُحسب من الشهرين وينبّه بالدرجة الحرجة (٤٨)');
    await page.getByText('مراجعة', { exact: true }).click();
    await wait(500);
    await page.getByText(/^رفع المحدد/).click();
    await wait(400);
    await page.getByText('رفع', { exact: true }).last().click();
    await wait(600);
    grades = await db('grades');
    const dec = term1.columns.find((c) => c.id === term1.result.column_id);
    ok(grades.find((g) => g.gradebook_id === term1.id && g.student_id === ahmad && g.column_id === dec.id)?.value === 50, 'الدرجة الحرجة رُفعت إلى ٥٠ بعد الموافقة');
    await page.screenshot({ path: `${shots}/flow-term.png` });
  }

  // ٥ب) استيراد درجات من Excel إلى الشهر الأول (تُستبدل درجة أحمد علي بـ ٦٦)
  {
    const XLSX = require('xlsx');
    const ws = XLSX.utils.aoa_to_sheet([['ت', 'الاسم', 'التحريري'], [1, 'احمد علي حسين', 55], [2, 'زيد خالد', 44], [3, 'شخص غريب تماما', 59]]);
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
    ok(gi('أحمد علي حسين')?.value === 55 && gi('زيد خالد')?.value === 44, 'الاستيراد: كُتبت درجات Excel في التحريري');
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
    ok(flat.includes('أحمد علي حسين') && flat.includes('55') && wb.Workbook?.Views?.[0]?.RTL && !flat.includes('التقدير'), 'تصدير Excel: الأسماء والدرجات، من اليمين لليسار، وبلا تقدير');
    ok(flat.some((x) => /نسبة النجاح/.test(x)), 'تصدير Excel: فيه الإحصاء');
    // الطباعة: استوديو بمعاينة A4 مقسّمة صفحات، وخيارات تُطبّق على المعاينة
    await page.getByLabel('خيارات').click();
    await wait(400);
    await page.getByText('طباعة / PDF', { exact: true }).click();
    await page.waitForURL(/\/print/);
    const preview = async () => {
      if (!(await page.locator('iframe').count())) { await page.getByText('المعاينة', { exact: true }).click(); await wait(300); }
      await page.waitForFunction(() => { const f = document.querySelector('iframe'); return !!f?.contentDocument?.body?.classList.contains('ready'); }, null, { timeout: 20000 });
      return page.evaluate(() => document.querySelector('iframe').contentDocument.documentElement.outerHTML);
    };
    let html = await preview();
    const pages = (html.match(/class="page"/g) || []).length;
    ok(/وزارة التربية/.test(html) && /أحمد علي حسين/.test(html) && /@font-face/.test(html) && pages >= 1, `الطباعة: معاينة A4 (${pages} صفحة) بترويسة رسمية وأسماء وخط مضمّن`);
    ok(/أُعدّ بتطبيق نَهج/.test(html) && /صفحة <i class="pn">1<\/i> من/.test(html), 'الطباعة: علامة نَهج وأرقام الصفحات');
    await page.getByText('التنسيق', { exact: true }).click();
    await wait(300);
    await page.getByText('علامة نَهج', { exact: true }).click();
    await page.getByText('عصري', { exact: true }).click();
    await wait(900);
    html = await preview();
    ok(!/أُعدّ بتطبيق نَهج/.test(html) && /#0B6E5E/.test(html), 'الطباعة: إخفاء علامة نَهج وتغيير القالب يظهران في المعاينة');
    const pp = await page.evaluate(() => JSON.parse(localStorage.getItem('nahj.settings')).prefs.print);
    ok(pp?.brand === false && pp?.theme === 'modern', 'الطباعة: التنسيق محفوظ');
    await page.getByText('الأقسام', { exact: true }).click();
    await wait(300);
    await page.getByLabel('تحريك الإحصاء للأعلى').click();
    await wait(900);
    html = await preview();
    ok(html.indexOf('الإحصاء —') > -1 && html.indexOf('الإحصاء —') < html.indexOf('<table class="t"'), 'الطباعة: ترتيب الأقسام (الإحصاء قبل الجدول)');
    await page.getByText('المعاينة', { exact: true }).click();
    await wait(500);
    await page.screenshot({ path: `${shots}/flow-print.png` });
  }

  // ٥د) تقرير الشعبة: Excel بأوراق الملخص والسجل الشامل، وطباعة
  {
    await page.goto(base + `/reports?section=${sec.id}`, { waitUntil: 'networkidle' });
    await wait(1000);
    await page.screenshot({ path: `${shots}/flow-report.png` });
    ok((await page.getByText('النتائج حسب السجل').count()) > 0, 'التقرير: النتائج حسب السجل');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByText('Excel', { exact: true }).click()]);
    const XLSX = require('xlsx');
    const wb = XLSX.read(require('fs').readFileSync(await dl.path()));
    ok(['الملخص', 'السجل الشامل', 'الراسبون', 'الغياب'].every((n) => wb.SheetNames.includes(n)), 'التقرير Excel: الملخص والسجل الشامل والراسبون والغياب');
    await page.getByText('طباعة / PDF', { exact: true }).click();
    await page.waitForURL(/\/print/);
    await page.waitForFunction(() => { const f = document.querySelector('iframe'); return !!f?.contentDocument?.body?.classList.contains('ready'); }, null, { timeout: 20000 });
    const rh = await page.evaluate(() => document.querySelector('iframe').contentDocument.documentElement.outerHTML);
    ok(/تقرير الشعبة/.test(rh) && /السجل الشامل/.test(rh), 'التقرير: معاينة الطباعة');
  }

  // ٦) الحضور
  await page.goto(base + `/attendance?section=${sec.id}`, { waitUntil: 'networkidle' });
  await wait(800);
  await page.getByLabel(/زيد خالد: حاضر/).click();
  await wait(400);
  const att = await db('attendance');
  ok(att.length === 5 && att.filter((a) => a.status === 'absent').length === 1, 'الحضور: غائب واحد والباقون حاضرون');
  ok((await page.getByText(/\d{2}\/\d{2}\/\d{4}/).count()) > 0 && (await page.getByText(/تشرين|كانون/).count()) === 0, 'الحضور: التاريخ رقمي بلا أسماء أشهر');
  await page.getByLabel(/أحمد علي حسين: متأخر/).click();
  await wait(300);
  await page.getByText('سجل الغياب', { exact: true }).click();
  await wait(600);
  ok((await page.getByText(/زيد خالد/).count()) > 0 && (await page.getByText(/غائب 1|غائب ١/).count()) > 0 && (await page.getByText(/أحمد علي حسين/).count()) > 0, 'سجل الغياب: الغائب والمتأخر بالأسماء');

  // ٦ب) ترقيم الطلاب: الطالب الجديد يأخذ مكانه الأبجدي ورقمه = مكانه، والرقم نفسه في الحضور
  await page.goto(base + `/section/${sec.id}`, { waitUntil: 'networkidle' });
  await wait(800);
  await page.getByPlaceholder('اسم طالب جديد أو الصق قائمة').fill('إبراهيم كريم');
  await page.keyboard.press('Enter');
  await wait(600);
  const rowsText = await page.evaluate(() => document.body.innerText);
  ok(/1\s*\n?\s*إبراهيم كريم/.test(rowsText), 'الطلاب: «إبراهيم» الجديد رقمه ١ (مكانه الأبجدي) لا ٦');
  await page.goto(base + `/attendance?section=${sec.id}`, { waitUntil: 'networkidle' });
  await wait(800);
  const attText = await page.evaluate(() => document.body.innerText);
  ok(/1\s*\n?\s*إبراهيم كريم/.test(attText), 'الحضور: نفس الرقم (١)');

  // ٧) الجدول: فرصة ثانية، والحفظ يبقى عند إعادة الفتح
  await page.goto(base + '/schedule/setup', { waitUntil: 'networkidle' });
  await wait(800);
  await page.getByText('+ إضافة فرصة', { exact: true }).click();
  await wait(300);
  await page.getByLabel('زيادة').nth(3).click(); // الاستراحة بين الحصص ٥ ← ٦
  await wait(300);
  await click('حفظ');
  await wait(800);
  const s2 = await page.evaluate(() => JSON.parse(localStorage.getItem('nahj.settings') || '{}'));
  ok(s2.timetable?.periods?.length === 6 && s2.timetable?.plan?.breaks?.length === 2 && s2.timetable?.plan?.gap === 6, 'أوقات الدوام: فرصتان واستراحة ٦ دقائق محفوظة');
  await page.goto(base + '/schedule/setup', { waitUntil: 'networkidle' });
  await wait(800);
  ok((await page.getByText('الفرصة الثانية', { exact: true }).count()) > 0, 'أوقات الدوام: الفرصة الثانية تبقى بعد إعادة الفتح');
  await page.goto(base + '/schedule', { waitUntil: 'networkidle' });
  await wait(800);
  ok((await page.getByText(/الفرصة الأولى ·/).count()) > 0, 'الجدول: الفرص ظاهرة بين الحصص');

  // ٨) الإعدادات: كل قسم في صفحته، ودرجة النجاح تُطبّق على السجلات
  await page.goto(base + '/settings/grades', { waitUntil: 'networkidle' });
  await wait(800);
  await page.getByLabel('زيادة').first().click();
  await wait(200);
  await click('تطبيق النجاح والحرجة على السجلات الحالية');
  await click('تطبيق');
  await wait(500);
  const bks = await db('gradebooks');
  ok(bks.length && bks.every((b) => b.result.pass === 51), 'إعدادات الدرجات: حد النجاح ٥١ طُبّق على كل السجلات');
  const s3 = await page.evaluate(() => JSON.parse(localStorage.getItem('nahj.settings') || '{}'));
  ok(s3.prefs.passMark === 51, 'إعدادات الدرجات محفوظة');

  ok(errors.length === 0, `بلا أخطاء JavaScript ${errors.length ? errors.join(' | ') : ''}`);
  await browser.close();
  server.close();
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
