<div dir="rtl">

# ما يحتاجه المشروع منك للإطلاق

> التطبيق **يعمل الآن كاملاً بلا أي إعداد** (البيانات على الهاتف). هذه الخطوات تفعّل: الحساب والمزامنة السحابية، الإشعارات البعيدة، الموقع، والتوقيع الدائم.
> كل الأسرار تُضاف في: GitHub ← المستودع ← **Settings ← Secrets and variables ← Actions**.

## ١) مفتاح التوقيع (قبل توزيع أول نسخة للمدرسين) — ٢ دقيقة
1. أضف سراً باسم `SIGNING_PASSPHRASE` = جملة سرية طويلة (احفظها عندك، ضياعها يكسر التحديثات).
2. Actions ← **Create Signing Key** ← Run workflow.
3. بعدها كل نسخة APK تُوقّع بنفس المفتاح وتُثبَّت فوق القديمة.

## ٢) Supabase (الحساب والمزامنة) — ١٠ دقائق
1. أنشئ مشروعاً في supabase.com (المنطقة: Frankfurt الأقرب للعراق). احفظ كلمة سر قاعدة البيانات.
2. Project Settings ← API: انسخ **Project URL** و **anon public key**.
3. أضف الأسرار:
   - `SUPABASE_URL` و `SUPABASE_ANON_KEY` (للتطبيق و keepalive)
   - `SUPABASE_ACCESS_TOKEN` (من supabase.com/dashboard/account/tokens)
   - `SUPABASE_DB_PASSWORD` (كلمة سر قاعدة البيانات)
   - `PUSH_SECRET` (أي نص سري طويل — لإرسال الإعلانات)
4. أضف **متغيراً** (Variables) باسم `SUPABASE_PROJECT_REF` = رمز المشروع (الجزء الأول من الرابط).
5. Actions ← **Deploy Supabase** ← Run workflow (يطبّق الجداول والصلاحيات ويرفع الدوال).
6. Authentication ← URL Configuration: أضف `rasd://auth-callback` في Redirect URLs.
7. (اختياري) تسجيل Google: Authentication ← Providers ← Google، وأدخل Client ID/Secret من Google Cloud Console (OAuth، نوع Web، Redirect = `https://<ref>.supabase.co/auth/v1/callback`).
8. أعد تشغيل **Build APK** لتأخذ النسخة الجديدة مفاتيح Supabase.

## ٣) Firebase (الإشعارات + الموقع) — ١٠ دقائق
1. console.firebase.google.com ← مشروع جديد (مثلاً `rasd-iq`).
2. أضف تطبيق Android بالحزمة **`app.rasd.teacher`** ← نزّل `google-services.json` ← ضع محتواه كاملاً في السر `GOOGLE_SERVICES_JSON`.
3. Project Settings ← Service accounts ← Generate new private key ← ضع محتوى ملف JSON في السرين:
   `FIREBASE_SERVICE_ACCOUNT` (نشر الموقع) و `FCM_SERVICE_ACCOUNT` (إرسال الإشعارات).
4. فعّل Hosting من لوحة Firebase. أضف متغيراً `FIREBASE_PROJECT_ID` = معرّف المشروع إن اختلف عن `rasd-iq`.
5. Actions ← **Deploy Site** ← Run workflow. الموقع على `https://<project>.web.app`.
6. **النطاق الخاص** (مثل rasd.iq أو rasd.app): Hosting ← Add custom domain، ثم أضف سجلات DNS التي يعطيك إياها Firebase عند مزوّد النطاق. وأضف متغيراً `SITE_URL` بالرابط الجديد.

## ٤) التنزيل والتحديث التلقائي
1. أنشئ مستودعاً **عاماً** فارغاً `dagg-iq/rasd-releases` (أو غيّر المتغير `RELEASES_REPO`).
2. أنشئ Personal Access Token (Fine-grained، صلاحية Contents: Read & Write على ذلك المستودع) وضعه في السر `RELEASES_TOKEN`.
3. من الآن كل بناء APK ناجح: يُنشر في المستودع العام ← يُحدَّث زر التنزيل في الموقع تلقائياً.

## ٥) تجربة على الهاتف (أشياء لا تُختبر إلا على جهاز حقيقي)
- [ ] الإدخال الصوتي: الميكروفون، فهم الأسماء والأرقام بلهجتك، مؤقت التأكيد، القراءة الصوتية.
  (يحتاج تطبيق Google على الهاتف، ويُفضّل تنزيل العربية للتعرّف بلا إنترنت من إعدادات Google ← الصوت).
- [ ] تذكير الحصص (اضبط حصة بعد ١٠ دقائق والتذكير ٥).
- [ ] تصدير Excel وفتحه في Excel/WPS، والطباعة PDF ومشاركتها على واتساب.
- [ ] استيراد أسماء من ملف Excel.
- [ ] تسجيل الدخول والمزامنة بين هاتفين (بعد خطوة ٢).

## ٦) قبل النشر في Google Play (لاحقاً)
- حساب مطوّر Google Play (٢٥$ مرة واحدة).
- سياسة الخصوصية جاهزة: `https://<site>/privacy.html`، وحذف الحساب موجود داخل التطبيق (شرط Google).
- بدّل `buildType` إلى `app-bundle` أو أضف خطوة `bundleRelease` في سير العمل.

## ملخص الأسرار
| السر | من أين | ضروري؟ |
|---|---|---|
| SIGNING_PASSPHRASE | أنت تختاره | نعم قبل التوزيع |
| SUPABASE_URL / SUPABASE_ANON_KEY | Supabase ← API | للمزامنة |
| SUPABASE_ACCESS_TOKEN / SUPABASE_DB_PASSWORD + متغير SUPABASE_PROJECT_REF | Supabase | للنشر الآلي |
| PUSH_SECRET | أنت تختاره | للإعلانات |
| GOOGLE_SERVICES_JSON | Firebase ← تطبيق Android | للإشعارات البعيدة |
| FIREBASE_SERVICE_ACCOUNT / FCM_SERVICE_ACCOUNT | Firebase ← Service accounts | للموقع والإشعارات |
| RELEASES_TOKEN | GitHub ← Developer settings | للتحديث التلقائي |

</div>
