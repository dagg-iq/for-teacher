<div dir="rtl">

# سجل التقدّم

> يُحدَّث بعد كل دفعة عمل. عند الاستيقاظ: اقرأ هذا الملف ثم أكمل من «التالي».

## ما أُنجز
- ✅ الخطة `docs/PLAN.md`، والهوية (الاسم «مِداد»، الشعار، الألوان، الأيقونات المولّدة بـ `scripts/gen-icons.py`).
- ✅ `packages/shared`: المعادلات (محلل آمن بالعربية)، القوالب العراقية (السعي السنوي…)، التقديرات والإحصاء، فهم الكلام (الأعداد بالعامية العراقية + مطابقة الأسماء)، الجدول، المزامنة، أدوات النص — **٦٦ اختباراً ناجحاً**.
- ✅ `apps/mobile` (Expo 57): الثيم والخطوط، طبقة البيانات المحلية `src/data/db.ts`، محرك المزامنة `src/data/sync.ts`، الحساب `src/lib/auth.tsx`، الإشعارات المحلية `src/lib/notify.ts`، التصدير `src/lib/export.ts`.
- ✅ الشاشات: الترحيب، الرئيسية، الصفوف، الصف، الشعبة، الاستيراد، الطالب، الدرجات، سجل جديد، السجل (إدخال سريع + جدول)، الأعمدة والمعادلات، الإحصاء، الإدخال الصوتي، الجدول، إعداد الجدول، المزيد.
- ✅ اختبار دخان ويب بـ Playwright: `apps/mobile/e2e/smoke.cjs`.

## أُنجز أيضاً
- ✅ كل الشاشات + اختبار المسارات `e2e/flows.cjs` (١٧ فحصاً) + اختبار الشاشات فاتح/داكن.
- ✅ Supabase: migrations + RLS مختبرة (`supabase/tests`) + دوال `push` و `delete-account`.
- ✅ الموقع `apps/site` (+ privacy.html، صور التطبيق `e2e/site-shots.cjs`).
- ✅ GitHub Actions: CI، Build APK، Create Signing Key، Deploy Site، Deploy Supabase، Keepalive.
- ✅ التوثيق: README، `docs/BRAND.md`، **`docs/SETUP_TODO.md`**.
- ✅ تنبيه التحديث داخل التطبيق، تسجيل الجهاز للإشعارات، حذف الحساب.

## التالي
1. ✅ أول بناء APK نجح (apk-1 في Releases، ~١٥ دقيقة) ووحدة expo-speech-recognition داخل النسخة. كل CI أخضر.
2. تحسينات اختيارية: ويدجت أندرويد لجدول اليوم، شاشة الإعلانات، استيراد درجات من Excel.

## أوامر التحقق
```bash
npm test                                  # اختبارات المنطق
cd apps/mobile && npx tsc --noEmit        # الأنواع
cd apps/mobile && npx expo export -p web --output-dir /tmp/web && node e2e/smoke.cjs /tmp/web
```

</div>
