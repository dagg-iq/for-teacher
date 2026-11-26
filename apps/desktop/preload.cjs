// يعرّف الواجهة بأنها تعمل داخل تطبيق سطح المكتب، ويوفّر فتح المتصفح وروابط العودة (الدخول بحساب Google)
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('nahjDesktop', {
  platform: process.platform,
  version: process.env.npm_package_version || '',
  openExternal: (url) => ipcRenderer.invoke('nahj:open-external', url),
  onDeepLink: (cb) => {
    const h = (_e, url) => cb(url);
    ipcRenderer.on('nahj:deeplink', h);
    return () => ipcRenderer.removeListener('nahj:deeplink', h);
  },
});
