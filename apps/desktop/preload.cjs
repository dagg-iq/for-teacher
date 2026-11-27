// يعرّف الواجهة بأنها تعمل داخل تطبيق سطح المكتب، ويوفّر فتح المتصفح وروابط العودة (الدخول بحساب Google)
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('nahjDesktop', {
  platform: process.platform,
  version: process.env.npm_package_version || '',
  openExternal: (url) => ipcRenderer.invoke('nahj:open-external', url),
  checkUpdate: () => ipcRenderer.invoke('nahj:check-update'),
  installUpdate: (url) => ipcRenderer.invoke('nahj:install-update', url),
  onUpdateProgress: (cb) => {
    const h = (_e, p) => cb(p);
    ipcRenderer.on('nahj:update-progress', h);
    return () => ipcRenderer.removeListener('nahj:update-progress', h);
  },
  onDeepLink: (cb) => {
    const h = (_e, url) => cb(url);
    ipcRenderer.on('nahj:deeplink', h);
    return () => ipcRenderer.removeListener('nahj:deeplink', h);
  },
});
