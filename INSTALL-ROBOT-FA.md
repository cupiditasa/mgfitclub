# نصب نسخه ایزوله ربات MG

تمام فایل‌های این پوشه باید با حفظ ساختار روی ریشه سایت بارگذاری شوند.

فایل‌های اصلی سایت `app.js` و `styles.css` دست‌نخورده‌اند. ربات داخل Shadow DOM اجرا می‌شود تا CSS و عناصر آن با اکشن‌های سایت، ویدئوی اول، گالری یا منو تداخل نداشته باشند.

اتصال فعال:

```text
POST https://chat.mgfitclub.ir/site-api/chat
siteKey: site_-ejTQPH6RC91X28aTTwxBL3A
```

فایل‌های لازم ربات:

- `assistant-loader.js`
- `assistant.js`
- `assistant.css`

پس از آپلود، بررسی کنید هر سه URL زیر پاسخ 200 بدهند و صفحه 404 برنگردانند:

```text
https://mgfitclub.ir/assistant-loader.js?v=20260813.6
https://mgfitclub.ir/assistant.js?v=20260813.6
https://mgfitclub.ir/assistant.css?v=20260813.6
```

سپس صفحه را با `Ctrl + F5` بازخوانی کنید.

برای تست محلی، `START-LOCAL-TEST.bat` را اجرا کنید. اگر پورت 8765 اشغال باشد، سرور به‌صورت خودکار پورت آزاد دیگری تا 8785 انتخاب می‌کند.
