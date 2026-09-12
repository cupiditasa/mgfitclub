# قرارداد API و استقرار

Worker در `backend/worker.js` قرار دارد و به D1 با binding به نام `DB` متصل می‌شود. نام و شناسهٔ واقعی دیتابیس در فایل نمونهٔ Wrangler قرار نمی‌گیرد و باید در محیط Cloudflare تنظیم شود.

## endpointهای اصلی

- `POST /api/auth/request-code` — درخواست کد ورود
- `POST /api/auth/verify-code` — تأیید کد و ساخت session
- `POST /api/auth/logout` — پایان session
- `GET /api/me` — کاربر و نقش فعلی
- `GET /api/dashboard` — دادهٔ داشبورد نقش فعلی
- `GET/POST /api/programs` — فهرست و ساخت برنامه
- `GET/POST /api/messages` — پیام‌ها
- `GET /api/admin/users` — مدیریت کاربران برای نقش مجاز

## SMS.ir و Secretها

قالب تأییدشدهٔ SMS.ir شناسهٔ `791767` دارد و متغیر آن `CODE` است. Worker به endpoint قالبی `send/verify` وصل می‌شود و فقط کد شش‌رقمی را به‌عنوان پارامتر می‌فرستد. مقدار واقعی `SMS_API_KEY` و `OTP_SECRET` را در GitHub یا فایل‌های HTML/JavaScript قرار ندهید؛ آن‌ها باید فقط در Cloudflare Secret/Binding باشند. در فرانت‌اند، آدرس عمومی Worker را با `window.MG_API_BASE` یا `data-api-base` تنظیم کنید.

## تست

```bash
cd backend
npm test
```
