// إعدادات ديناميكية فوق app.json:
// - نربط Firebase (الإشعارات) فقط إذا وُجد ملفه (يُكتب أثناء البناء من السر GOOGLE_SERVICES_JSON).
// - رقم النسخة = رقم بناء APK في GitHub (APK_BUILD)، والتطبيق يقارنه بآخر نسخة على الموقع ليعرض «تحديث متاح».
// - التحديث بلا تنزيل (OTA عبر EAS Update): يعمل فقط إذا وُجد معرّف المشروع EAS_PROJECT_ID (متغير في GitHub).
const fs = require('fs');
const path = require('path');

/**
 * رقم «الطبقة الأصلية». تحديثات OTA تصل فقط للنسخ التي تحمل نفس الرقم.
 * ارفعه (2، 3…) عند إضافة أو ترقية أي مكتبة أصلية (native) — حينها يلزم APK جديد.
 */
const RUNTIME_VERSION = '2';

module.exports = ({ config }) => {
  const build = Number(process.env.APK_BUILD) || 0;
  const projectId = process.env.EAS_PROJECT_ID || '';
  config.extra = { ...config.extra, buildNumber: build, runtime: RUNTIME_VERSION };
  if (build) {
    config.version = `1.0.${build}`;
    config.android = { ...config.android, versionCode: build };
  }
  if (fs.existsSync(path.join(__dirname, 'google-services.json'))) {
    config.android = { ...config.android, googleServicesFile: './google-services.json' };
  }
  config.runtimeVersion = RUNTIME_VERSION;
  if (projectId) {
    config.extra.eas = { projectId };
    config.updates = {
      url: `https://u.expo.dev/${projectId}`,
      enabled: true,
      // يفحص عند كل تشغيل ويُنزّل في الخلفية؛ التحديث يُطبَّق عند الفتح التالي (أو فوراً من «عن التطبيق»)
      checkAutomatically: 'ON_LOAD',
      fallbackToCacheTimeout: 0,
      requestHeaders: { 'expo-channel-name': 'production' },
    };
  } else {
    config.updates = { enabled: false };
  }
  return config;
};
