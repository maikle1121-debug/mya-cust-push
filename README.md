# مشروع إشعارات العملاء الجدد (Web Push) — مشروع Vercel مستقل
## هيكل المشروع
```
api/push-subscribe.js     ← استقبال اشتراك الموبايل
api/notify-customers.js   ← إرسال الإشعارات (Cron/يدوي)
public/sw-push.js         ← Service Worker يظهر الإشعار
public/index.html         ← صفحة "اشترك في التنبيهات" (اللي الموبايل يفتحها)
vercel.json               ← Cron يومي "مرة في اليوم" فقط (متوافق مع خطة Hobby المجانية)
```

## ملاحظة هامة عن الـ Cron
خطة **Hobby المجانية** تمنع الـ Cron الأقل من مرة يوميًا. لذلك:
- **الإضافة نفسها هي المنقّل**: بتندي دالة `/api/notify-customers` كل دقيقة (وفور أي عميل جديد) أثناء عملها — فالإشعار لحظي بدون أي Cron.
- الـ Cron اليومي هنا مجرد **احتياط**، فلا يحتاج ترقية لخطة Pro.

## عالمي وليس مربوط برين
- أي اشتراك ييجي من صفحة الاشتراك (بدون `vatId`) يُخزّن `global: true`.
- دالة الإرسال تبعت الحدث **لكل الاشتراكات العالمية + اشتراكات نفس الرين** — يعني أي عميل جديد من أي حساب هيوصلك إشعار.
## متغيرات البيئة (Environment Variables)
- `REST_APIKEY = sb_publishable_xQcMrCMwwggfAKggkxfYxQ_Ty0DbgRK`
- `REST_BASE = https://mya-alpha.vercel.app` (افتراضي — نفس القيمة)
- `VAPID_SUBJECT = mailto:you@example.com`
- `VAPID_PUBLIC_KEY = BBMarC-ffcX6k7X0k9JVvbh8qs847GGGU-lg5yHCkcOqzRIHEjP_9_MVFYcGeKkuMSn3kn5Lpw1r_oj046mka_8`
- `VAPID_PRIVATE_KEY = fFCP3dRn4Q9989ysQVeVAYrs9yMWY0-6L56HkNAHgGQ`

## التشغيل محليًا (اختياري)
1. `npm i web-push`
2. `npx vercel dev` → افتح `http://localhost:3000` واشتري منهم.

## لاستبدال المفاتيح
`node generate-vapid.js` ثم ضع الجديدة في envs وحدّث `VAPID_PUBLIC` في `public/index.html`.