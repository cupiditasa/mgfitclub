# MG FitClub API

Cloudflare Worker + D1 API for login, roles, dashboards and training requests.

## Required bindings and secrets

- `DB`: D1 database binding.
- `SMS_API_KEY`: SMS.ir X-API-KEY secret.
- `SMS_TEMPLATE_ID`: optional; if configured, it must be `791767`. Other template IDs are rejected.
- `APP_ORIGIN`: final frontend origin.
- `DEV_MODE`: use only for local/test environments.
- `OTP_SECRET`: secret used to hash OTP challenges.

The SMS.ir verification template already contains the approved text and the `#CODE#` variable. The Worker sends only the generated six-digit code as the `CODE` parameter to `/v1/send/verify`; the API key never belongs in frontend files. `SMS_LINE_NUMBER` and other private/public sender bindings are not used for OTP. There is no bulk-send or alternate-template fallback, including on timeout.

Approved message text (rendered by SMS.ir, not assembled by the frontend):

```text
کد ورود شما: #CODE#
آدرس سایت: MGFitClub.ir
```

SMS.ir selects the verification service sender. Do not force the old dedicated line, or hard-code the sender shown for one receipt. HTTP acceptance with provider status `1` and a message ID means the provider accepted the request, not that the handset received it. The provider message ID/status are recorded in `audit_logs` without the OTP or API key.

## انتشار اصلاح پیامک روی Worker فعال

صرف آپلود `backend/worker.js` روی مخزن فرانت‌اند، Worker جداگانهٔ Cloudflare را به‌روز نمی‌کند؛ مگر اینکه همان Worker به فرایند استقرار آن مخزن متصل باشد.

در بررسی فقط‌خواندنی ۱۲ سپتامبر ۲۰۲۶، Worker فعال `mg-fitclub-api` هنوز از `send/bulk` استفاده می‌کرد؛ فایل محلی قبلاً قالبی شده بود اما آن تغییر روی Worker فعال نبود. این اصلاح باید روی همان Worker منتشر شود، نه روی یک Worker جدید با آدرس متفاوت.

1. در Cloudflare، Worker با نام `mg-fitclub-api` را باز کنید و محتوای ماژول `worker.js` را با فایل همین پوشه جایگزین و Deploy کنید؛ یا از فرایند استقرار تنظیم‌شدهٔ خودتان استفاده کنید.
2. Binding دیتابیس `DB` و Secretهای موجود، به‌خصوص `SMS_API_KEY` و `OTP_SECRET` را حفظ کنید. تغییر دیتابیس، اجرای دوبارهٔ schema یا تعویض کلید لازم نیست.
3. `SMS_TEMPLATE_ID` می‌تواند تنظیم نشده باشد؛ اگر وجود دارد مقدارش باید `791767` باشد. تنظیم شمارهٔ فرستنده برای این مسیر لازم نیست.
4. در پاسخ `GET /health` باید `version` برابر `20260912-sms-template-1` و مشخصات زیر دیده شود. باقی‌ماندن نسخهٔ `20260911` یعنی Worker قدیمی هنوز فعال است.

```json
{"provider":"sms.ir","method":"verify","templateId":791767,"parameter":"CODE"}
```

پس از Deploy، یک کد از صفحهٔ ورود درخواست کنید و رسید همان پیام را در SMS.ir بررسی کنید. تست‌های زیر شبیه‌سازی‌شده‌اند و پیامک واقعی ارسال نمی‌کنند؛ دریافت واقعی فقط پس از انتشار و بررسی گوشی/رسید قابل تأیید است.

## Test

```bash
npm test
```
