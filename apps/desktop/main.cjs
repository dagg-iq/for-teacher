/**
 * نَهج لسطح المكتب (ويندوز): نفس واجهة التطبيق (نسخة الويب من Expo) داخل نافذة Electron.
 * - تُقدَّم الملفات عبر بروتوكول خاص app://nahj (أصل ثابت فتبقى البيانات المحفوظة بين التشغيلات).
 * - الروابط الخارجية تُفتح في المتصفح، ونوافذ الطباعة تبقى داخل التطبيق.
 * - نسخة واحدة فقط تعمل، وحجم النافذة وموضعها يُحفظان.
 */
const { app, BrowserWindow, protocol, net, shell, Menu, nativeTheme, session, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const WEB = path.join(__dirname, 'web');
const ORIGIN = 'app://nahj';

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

if (!app.requestSingleInstanceLock()) app.quit();
// الصوت يعمل بلا انتظار ضغطة (الإدخال الصوتي: معالج الصوت لا يبدأ «متوقفاً»)
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// الدخول بحساب Google: يتم في متصفح النظام (Google يمنع الدخول داخل النوافذ المضمّنة)،
// ثم يعود إلى التطبيق برابط nahj://auth-callback?code=… فيُمرَّر للواجهة لإكمال الدخول
if (process.defaultApp && process.argv.length >= 2) app.setAsDefaultProtocolClient('nahj', process.execPath, [path.resolve(process.argv[1])]);
else app.setAsDefaultProtocolClient('nahj');
const deepLinkFrom = (argv) => (argv || []).find((a) => typeof a === 'string' && a.startsWith('nahj://'));
let pendingLink = deepLinkFrom(process.argv) || null;
function deliver(url) {
  if (!url) return;
  if (win && !win.webContents.isLoading()) win.webContents.send('nahj:deeplink', url);
  else pendingLink = url;
}
// ── التحديث من داخل التطبيق: الموقع ينشر رابط آخر نسخة في download.json، ننزّل المثبّت ونشغّله بصمت ثم يعيد فتح التطبيق
const SITE = 'https://nahj-iq.web.app';
const isPortable = () => !!process.env.PORTABLE_EXECUTABLE_FILE;
const verNum = (v) => Number(String(v || '').split('.').pop()) || 0;
ipcMain.handle('nahj:check-update', async () => {
  try {
    const res = await net.fetch(`${SITE}/download.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const d = (await res.json()).desktop || {};
    if (!d.url || verNum(d.version) <= verNum(app.getVersion())) return null;
    return { version: d.version, sizeMb: d.size_mb || '', url: d.url, portable: d.portable || '', isPortable: isPortable(), current: app.getVersion() };
  } catch { return null; }
});
let updating = false;
ipcMain.handle('nahj:install-update', async (e, url) => {
  if (updating) return { ok: false, error: 'busy' };
  if (typeof url !== 'string' || !/^https:\/\/github\.com\/dagg-iq\/[\w.-]+\/releases\/download\/[\w.-]+\/Nahj-Setup-[\w.-]+\.exe$/.test(url)) return { ok: false, error: 'bad-url' };
  updating = true;
  const os = require('os');
  const { spawn } = require('child_process');
  const file = path.join(os.tmpdir(), path.basename(url));
  try {
    const res = await net.fetch(url);
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    const total = Number(res.headers.get('content-length')) || 0;
    const out = fs.createWriteStream(file);
    let got = 0; let last = 0;
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      got += value.length;
      if (!out.write(Buffer.from(value))) await new Promise((r) => out.once('drain', r));
      if (total && Date.now() - last > 200) { last = Date.now(); e.sender.send('nahj:update-progress', got / total); }
    }
    await new Promise((r, j) => out.end((err) => (err ? j(err) : r())));
    e.sender.send('nahj:update-progress', 1);
    // NSIS: ‎/S‎ تثبيت صامت فوق الحالي (البيانات تبقى)، ‎--force-run‎ يفتح التطبيق بعد التثبيت
    spawn(file, ['/S', '--force-run'], { detached: true, stdio: 'ignore' }).unref();
    setTimeout(() => app.quit(), 400);
    return { ok: true };
  } catch (err) {
    updating = false;
    return { ok: false, error: String(err && err.message || err) };
  }
});

ipcMain.handle('nahj:open-external', (_e, url) => {
  if (typeof url === 'string' && /^https:\/\//i.test(url)) return shell.openExternal(url);
  return false;
});

const stateFile = () => path.join(app.getPath('userData'), 'window.json');
function loadBounds() {
  try { return JSON.parse(fs.readFileSync(stateFile(), 'utf8')); } catch { return { width: 1280, height: 820 }; }
}
function saveBounds(win) {
  try {
    const b = win.getNormalBounds();
    fs.writeFileSync(stateFile(), JSON.stringify({ ...b, maximized: win.isMaximized() }));
  } catch { /* */ }
}

const isExternal = (url) => /^(https?:|mailto:|tel:|whatsapp:|tg:)/i.test(url) && !url.startsWith(ORIGIN);

let win = null;
function createWindow() {
  const b = loadBounds();
  win = new BrowserWindow({
    ...b,
    minWidth: 420,
    minHeight: 600,
    show: false,
    title: 'نَهج',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0B1412' : '#0E3B33',
    icon: path.join(__dirname, 'build', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      spellcheck: false,
    },
  });
  if (b.maximized) win.maximize();
  win.once('ready-to-show', () => win.show());
  win.on('close', () => saveBounds(win));

  // الروابط: الخارجية للمتصفح، ونوافذ الطباعة/المعاينة (about:blank) داخل التطبيق
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternal(url)) { shell.openExternal(url); return { action: 'deny' }; }
    return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true, backgroundColor: '#FFFFFF' } };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (isExternal(url)) { e.preventDefault(); shell.openExternal(url); }
  });
  // أشرطة تمرير رفيعة هادئة تناسب تطبيق الحاسوب
  win.webContents.on('did-finish-load', () => {
    if (pendingLink) { win.webContents.send('nahj:deeplink', pendingLink); pendingLink = null; }
    win.webContents.insertCSS(`
      ::-webkit-scrollbar{width:10px;height:10px}
      ::-webkit-scrollbar-track{background:transparent}
      ::-webkit-scrollbar-thumb{background:rgba(20,33,30,.18);border-radius:10px;border:3px solid transparent;background-clip:content-box}
      ::-webkit-scrollbar-thumb:hover{background:rgba(20,33,30,.32);background-clip:content-box}
      @media (prefers-color-scheme: dark){::-webkit-scrollbar-thumb{background:rgba(255,255,255,.18);background-clip:content-box}}
    `).catch(() => {});
  });
  win.loadURL(`${ORIGIN}/`);
}

app.on('second-instance', (_e, argv) => {
  deliver(deepLinkFrom(argv));
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  // الملفات من مجلد الويب، وكل مسار غير موجود يعود إلى index.html (تطبيق صفحة واحدة)
  protocol.handle('app', (req) => {
    const u = new URL(req.url);
    let p = path.normalize(path.join(WEB, decodeURIComponent(u.pathname)));
    if (!p.startsWith(WEB) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(WEB, 'index.html');
    return net.fetch(pathToFileURL(p).toString());
  });
  // الميكروفون مسموح (الإدخال الصوتي بالتعرّف داخل الجهاز)، وما عداه مرفوض
  const allowed = (perm) => perm === 'media' || perm === 'clipboard-sanitized-write';
  session.defaultSession.setPermissionRequestHandler((_wc, perm, cb) => cb(allowed(perm)));
  session.defaultSession.setPermissionCheckHandler((_wc, perm) => allowed(perm));
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
