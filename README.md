<div dir="rtl">

# نَهج — التدريس بنهجٍ أذكى.

تطبيق المدرّس العراقي على الهاتف والحاسوب: الصفوف والشعب والطلاب، **سجلات السنة المترابطة** (الأشهر بحقولها، سعي الفصلين، نصف السنة، السعي السنوي)
مع تنبيه الدرجات الحرجة، **التقارير** لكل شعبة، **إدخال الدرجات بالصوت**، الحضور والغياب، جدول الحصص مع التذكير، التحضير، القرعة والمؤقت،
وتصدير Excel وطباعة رسمية — يعمل بلا إنترنت، ومزامنة سحابية اختيارية (Supabase، أو Oracle عبر خادم نَهج).

| | |
|---|---|
| 📱 `apps/mobile` | التطبيق (Expo SDK 57 / React Native، أندرويد أولاً) |
| 💻 `apps/desktop` | نسخة الحاسوب (ويندوز exe عبر Electron) |
| 🌐 `apps/site` | الموقع التعريفي (Firebase Hosting) |
| 🧮 `packages/shared` | المنطق المختبر: المعادلات، القوالب، فهم الكلام، الجدول، المزامنة |
| 🗄️ `supabase/` | قاعدة البيانات والصلاحيات (RLS) والدوال |
| 🔶 `server/` | خادم المزامنة مع Oracle ومخطط جداولها ([`docs/ORACLE.md`](docs/ORACLE.md)) |
| 🧭 `docs/` | الخطة، الهوية، التقدّم، **وما يلزم منك للإطلاق** |

**ابدأ من:** [`docs/SETUP_TODO.md`](docs/SETUP_TODO.md) · الخطة: [`docs/PLAN.md`](docs/PLAN.md) · التقدّم: [`docs/PROGRESS.md`](docs/PROGRESS.md)

```bash
npm ci
npm test                                   # اختبارات المنطق
npm run typecheck
cd apps/mobile && npx expo start           # تشغيل للتطوير
cd server && npm test                       # اختبارات خادم Oracle
```

</div>
