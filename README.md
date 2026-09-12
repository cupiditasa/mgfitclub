# MG FitClub — GitHub package

این خروجی، نسخهٔ کامل و قابل نگهداری پروژهٔ MG FitClub است: فرانت‌اند استاتیک، داشبورد همهٔ نقش‌ها، PWA، صفحهٔ مجله، رسانه‌های مجله، Worker بک‌اند Cloudflare، schema و migration دیتابیس و تست‌های API.

## اجرای محلی فرانت‌اند

از ریشهٔ پروژه اجرا کنید:

```bash
python -m http.server 8080 --bind 127.0.0.1
```

سپس `http://127.0.0.1:8080/index.html` را باز کنید. صفحهٔ مجله در `mg-journal.html` قرار دارد و صفحه‌های ویدیویی آن داخل `videos/` هستند.

## اتصال API

کد فرانت‌اند از `window.MG_API_BASE` یا `data-api-base` روی عنصر `html` پشتیبانی می‌کند. آدرس Worker را در محیط انتشار خود تنظیم کنید. هیچ کلید Cloudflare، کلید SMS یا فایل خصوصی داخل این بسته قرار نگرفته است؛ این مقادیر باید فقط به‌صورت Secret/Binding در Cloudflare تنظیم شوند.

## بک‌اند Cloudflare

محتویات `backend/` شامل `worker.js`، `schema.sql`، migration زمان اجرا، تست‌ها و `wrangler.toml.example` است. ابتدا D1 را بسازید، schema و migration را اجرا کنید، سپس Secretهای لازم را با Wrangler ثبت و Worker را deploy کنید. راهنمای endpointها در `docs/API.md` آمده است.

```bash
cd backend
npm test
```

## مسیرهای مهم

| بخش | مسیر |
| --- | --- |
| سایت اصلی | `index.html` |
| ورود | `account.html` |
| اپلیکیشن/PWA | `app.html` |
| داشبورد ورزشکار | `dashboard.html?demo=athlete` |
| داشبورد مربی | `coach-dashboard.html?demo=coach` |
| داشبورد مدیریت | `admin-dashboard.html?demo=manager` |
| مجله | `mg-journal.html` |

## نکتهٔ انتشار

این بسته برای نگهداری در GitHub آماده شده است. فایل‌های `docs/*_MANIFEST.json` فهرست و SHA-256 فایل‌های همین خروجی را ثبت می‌کنند. ویدیوها و تصاویر مجله عمداً در نسخهٔ کامل نگه داشته شده‌اند؛ فایل‌های خصوصی، backup و token در بسته وجود ندارند.
