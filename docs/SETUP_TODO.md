<div dir="rtl">

# ما يحتاجه المشروع منك للإطلاق

> التطبيق **يعمل الآن كاملاً بلا أي إعداد** (البيانات على الهاتف). هذه الخطوات تفعّل: الحساب والمزامنة السحابية، الإشعارات البعيدة، الموقع، والتوقيع الدائم.
> كل الأسرار تُضاف في: GitHub ← المستودع ← **Settings ← Secrets and variables ← Actions**.

## ١) مفتاح التوقيع (قبل توزيع أول نسخة للمدرسين) — ٢ دقيقة
1. أضف سراً باسم `SIGNING_PASSPHRASE` = جملة سرية طويلة (احفظها عندك، ضياعها يكسر التحديثات).
2. Actions ← **Create Signing Key** ← Run workflow.
3. بعدها كل نسخة APK تُوقّع بنفس المفتاح وتُثبَّت فوق القديمة.
4. انتبه: النسخ الحالية (حتى apk-16) موقّعة بمفتاح تجريبي عام. بعد إنشاء المفتاح الخاص احذف النسخة القديمة من الهاتف مرة واحدة ثم ثبّت الجديدة (توقيع مختلف).

> كل نسخة تُوقَّع بـ v1+v2+v3 ويتحقق البناء من v1: هواتف ريلمي/أوبو (ColorOS) ترفض الحزمة بـ«تبدو غير صالحة» من دونه.

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
6. Authentication ← URL Configuration: أضف `nahj://auth-callback` في Redirect URLs.
7. (اختياري) تسجيل Google: Authentication ← Providers ← Google، وأدخل Client ID/Secret من Google Cloud Console (OAuth، نوع Web، Redirect = `https://<ref>.supabase.co/auth/v1/callback`).
8. أعد تشغيل **Build APK** لتأخذ النسخة الجديدة مفاتيح Supabase.

## ٣) Firebase (الإشعارات + الموقع) — ١٠ دقائق
1. console.firebase.google.com ← مشروع جديد (مثلاً `nahj-iq`).
2. أضف تطبيق Android بالحزمة **`app.nahj.teacher`** ← نزّل `google-services.json` ← ضع محتواه كاملاً في السر `GOOGLE_SERVICES_JSON`.
3. Project Settings ← Service accounts ← Generate new private key ← ضع محتوى ملف JSON في السرين:
   `FIREBASE_SERVICE_ACCOUNT` (نشر الموقع) و `FCM_SERVICE_ACCOUNT` (إرسال الإشعارات).
4. فعّل Hosting من لوحة Firebase. أضف متغيراً `FIREBASE_PROJECT_ID` = معرّف المشروع إن اختلف عن `nahj-iq`.
5. Actions ← **Deploy Site** ← Run workflow. الموقع على `https://<project>.web.app`.
6. **النطاق الخاص** (مثل nahj.iq أو nahj.app): Hosting ← Add custom domain، ثم أضف سجلات DNS التي يعطيك إياها Firebase عند مزوّد النطاق. وأضف متغيراً `SITE_URL` بالرابط الجديد.

## ٤) التنزيل والتحديث التلقائي
1. أنشئ مستودعاً **عاماً** فارغاً `dagg-iq/nahj-releases` (أو غيّر المتغير `RELEASES_REPO`).
2. أنشئ Personal Access Token (Fine-grained، صلاحية Contents: Read & Write على ذلك المستودع) وضعه في السر `RELEASES_TOKEN`.
3. من الآن كل بناء APK ناجح: يُنشر في المستودع العام ← يُحدَّث زر التنزيل في الموقع تلقائياً،
   والتطبيق نفسه يرى النسخة الجديدة ويحمّلها من داخله (شريط تقدّم ثم «تثبيت الآن»).

### ٤-ب) التحديث الفوري بلا تنزيل (OTA) — ٥ دقائق
تعديلات الواجهة والمنطق تصل للمدرّسين وحدها عند فتح التطبيق، بلا APK جديد.
1. أنشئ حساباً مجانياً على expo.dev ← Projects ← Create project باسم `nahj` ← انسخ **Project ID**.
2. GitHub ← Settings ← Variables ← أضف `EAS_PROJECT_ID` = ذلك المعرّف.
3. expo.dev ← Account settings ← Access tokens ← أنشئ رمزاً وضعه في السر `EXPO_TOKEN`.
4. ابنِ APK جديداً مرة واحدة (Actions ← Build APK) — النسخ القديمة لا تعرف خادم التحديث.
5. بعدها كل دفع لتعديلات `apps/mobile/src` أو `packages/shared` يشغّل **OTA Update** تلقائياً.
> عند إضافة مكتبة أصلية (native) ارفع `RUNTIME_VERSION` في `apps/mobile/app.config.js` وابنِ APK جديداً؛
> سير العمل يتخطى OTA تلقائياً إن تغيّر `package.json` أو إعدادات التطبيق.

## ٤-ج) نسخة الحاسوب (ويندوز)
- تُبنى تلقائياً مع كل تحديث (Actions ← **Build Desktop**) وتُنشر في Releases باسم `desktop-N`:
  `Nahj-Setup-….exe` (مثبّت) و`Nahj-Portable-….exe` (بلا تثبيت).
- غير موقّعة بشهادة تجارية بعد، فيظهر تحذير SmartScreen أول مرة: «مزيد من المعلومات» ← «تشغيل على أي حال».
  للتخلص منه لاحقاً: شهادة توقيع كود (Code Signing) وأضفها أسراراً لـ electron-builder (`CSC_LINK`، `CSC_KEY_PASSWORD`).
- بياناتها محفوظة على الحاسوب، وتتزامن مع الهاتف بعد إعداد Supabase وتسجيل الدخول بنفس الحساب.
- الإدخال الصوتي على الحاسوب يعمل **بالتعرّف داخل الجهاز** (Whisper): أول استعمال ينزّل النموذج (~٨٠ م.ب، أو ~٢٥٠ م.ب لـ«دقة أعلى») من Hugging Face مرة واحدة، ثم يعمل بلا إنترنت.
  اسمح لتطبيقات سطح المكتب بالميكروفون في ويندوز: الإعدادات ← الخصوصية ← الميكروفون. وتبقى خانة الكتابة متاحة دائماً.

## ٤-د) قاعدة بيانات Oracle (بدل Supabase للبيانات)
التفاصيل وما أحتاجه منك في `docs/ORACLE.md`. باختصار: معلومات الاتصال بـ Oracle، ومكان تشغيل خادم نَهج، ثم متغيرا GitHub `SYNC_BACKEND=rest` و `API_URL`.

> **مهم (تشرين الثاني ٢٠٢٦):** أُضيفت مكتبة أصلية (`react-native-webview` لمعاينة الطباعة) ورُفع `RUNTIME_VERSION` إلى `2` —
> يلزم **APK جديد** (Actions ← Build APK). النسخ القديمة لن تستلم تحديثات OTA الجديدة.

## ٥) تجربة على الهاتف (أشياء لا تُختبر إلا على جهاز حقيقي)
- [ ] تثبيت apk-16 (أو أحدث) على هاتفك — الأيقونة الكوفية الجديدة، الأيقونة المتكيفة، وشاشة البداية.
- [ ] ويدجت «حصص اليوم» على الشاشة الرئيسية.
- [ ] الإدخال الصوتي: الميكروفون، فهم الأسماء والأرقام بلهجتك، مؤقت التأكيد، القراءة الصوتية.
  (يحتاج تطبيق Google على الهاتف، ويُفضّل تنزيل العربية للتعرّف بلا إنترنت من إعدادات Google ← الصوت).
- [ ] تذكير الحصص (اضبط حصة بعد ١٠ دقائق والتذكير ٥).
- [ ] تصدير Excel وفتحه في Excel/WPS.
- [ ] استوديو الطباعة: المعاينة على الهاتف (WebView)، «طباعة» و«PDF» ومشاركته على واتساب، وتغيير القالب والخط والأقسام.
- [ ] الإدخال الصوتي على أندرويد ١٣+: استماع متواصل بلا صفير بين الطلاب.
- [ ] الإدخال الصوتي على الحاسوب: تنزيل النموذج أول مرة ثم التعرّف على «خمسة وسبعين» و«أحمد علي تسعين».
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
| RELEASES_TOKEN | GitHub ← Developer settings | لتحديث APK من داخل التطبيق |
| EXPO_TOKEN + متغير EAS_PROJECT_ID | expo.dev | للتحديث الفوري بلا تنزيل (OTA) |

</div>
