/**
 * نَهج لسطح المكتب (ويندوز): نفس واجهة التطبيق (نسخة الويب من Expo) داخل نافذة Electron.
 * - تُقدَّم الملفات عبر بروتوكول خاص app://nahj (أصل ثابت فتبقى البيانات المحفوظة بين التشغيلات).
 * - الروابط الخارجية تُفتح في المتصفح، ونوافذ الطباعة تبقى داخل التطبيق.
 * - نسخة واحدة فقط تعمل، وحجم النافذة وموضعها يُحفظان.
 */
const { app, BrowserWindow, protocol, net, shell, Menu, nativeTheme, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const WEB = path.join(__dirname, 'web');
const ORIGIN = 'app://nahj';

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

if (!app.requestSingleInstanceLock()) app.quit();

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

app.on('second-instance', () => {
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
