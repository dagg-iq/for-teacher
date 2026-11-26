// يعرّف الواجهة بأنها تعمل داخل تطبيق سطح المكتب (لإظهار حركة الشعار وتخطيط الحاسوب)
const { contextBridge } = require('electron');
contextBridge.exposeInMainWorld('nahjDesktop', { platform: process.platform, version: process.env.npm_package_version || '' });
