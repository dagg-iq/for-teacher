<div dir="rtl">

# ربط نَهج بقاعدة بيانات Oracle

التطبيق جاهز للعمل مع Oracle بدل Supabase في حفظ البيانات ومزامنتها. الهاتف والحاسوب لا يتصلان بـ Oracle مباشرة (غير آمن وغير ممكن من الهاتف)، بل عبر **خادم مزامنة نَهج** الصغير (`server/`)، وهو بدوره يتصل بقاعدة Oracle.

```
التطبيق (هاتف/حاسوب) ──HTTPS + رمز الدخول──▶ خادم نَهج (server/) ──oracledb──▶ Oracle
```

## ما هو جاهز
- **المخطط** `server/sql/schema.sql`: كل الجداول (الصفوف، الشعب، الطلاب، السجلات، الدرجات، الحضور، الجدول، المهام، التحضير، الملاحظات، الإعدادات) — يُولَّد من `server/src/schema.mjs`.
- **خادم المزامنة** `server/src/server.mjs` (Node 20+، مكتبة Oracle الرسمية `oracledb` بوضع thin — لا يحتاج Oracle Client):
  - `POST /v1/sync/push` دمج «آخر تعديل يفوز» (MERGE) مع عزل كل مدرس ببياناته.
  - `GET /v1/sync/pull` سحب تزايدي حسب `synced_at`.
  - `GET/PUT /v1/settings`، `POST /v1/account/delete`، `GET /v1/health`.
- **التطبيق**: طبقة مزامنة قابلة للتبديل (`apps/mobile/src/data/backends.ts`). التبديل بمتغيرين فقط:
  `EXPO_PUBLIC_SYNC_BACKEND=rest` و `EXPO_PUBLIC_API_URL=https://…`.
- **الاختبارات**: بناء الاستعلامات وتحويل الأنواع مختبر (`cd server && npm test`) ويعمل في CI.

> لم يُجرَّب الخادم على قاعدة Oracle حقيقية بعد — هذا أول ما نفعله عند وصول معلومات الاتصال.

## ما أحتاجه منك
1. **نوع قاعدة Oracle**: Oracle Autonomous Database (سحابة Oracle، الأسهل) أم Oracle على خادم خاص؟ والإصدار (19c / 21c / 23ai).
2. **معلومات الاتصال**:
   - المستخدم وكلمة السر (مستخدم مخصص لنَهج، لا SYS/ADMIN).
   - `connect string` (مثل `host:1521/service` أو اسم الخدمة من tnsnames).
   - لـ Autonomous: ملف **Wallet** (zip) وكلمة سره — أو تفعيل TLS بلا Wallet.
3. **أين يعمل خادم نَهج**: (أ) Oracle Cloud (مجاني: Always Free Compute)، (ب) Google Cloud Run / Render / Railway، (ج) خادمك الخاص. ونطاق له (مثل `api.nahj.iq`) إن وُجد.
4. **تسجيل الدخول**: هل نُبقي حسابات المدرسين على Supabase Auth (الحالي، والخادم يتحقق من رموزه عبر JWKS) أم مزوّد آخر؟

> **لا تضع كلمات السر في المحادثة.** عند التنفيذ أطلب منك إضافتها أسراراً في GitHub أو في إعدادات الخادم مباشرة.

## خطوات التشغيل (بعد المعلومات)
1. إنشاء الجداول: شغّل `server/sql/schema.sql` في قاعدة Oracle (SQL Developer أو SQLcl أو Database Actions).
2. تشغيل الخادم بالمتغيرات:
   `ORACLE_USER`، `ORACLE_PASSWORD`، `ORACLE_CONNECT_STRING`، (`ORACLE_WALLET_DIR`، `ORACLE_WALLET_PASSWORD`)،
   `JWKS_URL=https://<project>.supabase.co/auth/v1/.well-known/jwks.json` (أو `JWT_SECRET`)، `PORT`، `CORS_ORIGIN`.
3. فحص: `GET https://<الخادم>/v1/health` ← `{ "ok": true }`.
4. في GitHub ← Variables: `SYNC_BACKEND=rest` و `API_URL=https://<الخادم>`، ثم بناء نسخة جديدة (التطبيق والحاسوب).
5. نقل البيانات الحالية (إن وُجدت على Supabase): سكربت نقل لمرة واحدة نكتبه عند الحاجة.

</div>
