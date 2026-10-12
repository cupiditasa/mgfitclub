(() => {
  "use strict";

  const version = "20261012-role-tours-v1";
  const PAGE_TOURS = {
    "dashboard.html": [
      { selector: ".topbar", title: "داشبورد ورزشکار", copy: "از این صفحه وضعیت حساب، دسترسی‌های سریع و مسیرهای اصلی پنل را پیدا می‌کنی." },
      { selector: '.quick-grid [data-pane-link="club"]', title: "عضویت", copy: "وضعیت عضویت و پکیج‌ها را اینجا ببین؛ اگر هنوز عضو نیستی، مسیر انتخاب پکیج نمایش داده می‌شود." },
      { selector: '.quick-grid a[href="workout-view.html"]', title: "برنامهٔ تمرینی", copy: "نسخه‌ای که مربی برایت فرستاده اینجا باز می‌شود. اگر برنامه نداری، می‌توانی از استودیو بسازی یا از مربی سفارش بدهی." },
      { selector: '.quick-grid a[href="nutrition-view.html"]', title: "برنامهٔ غذایی", copy: "برنامهٔ ارسال‌شدهٔ مربی را از این میان‌بر ببین؛ نسخهٔ دریافتی برای ورزشکار فقط خواندنی است." },
      { selector: '.quick-grid [data-pane-link="sessions"]', title: "جلسات باقی‌مانده", copy: "تعداد جلسات از عضویت‌های فعال حساب خوانده می‌شود؛ این بخش عدد نمایشی یا دستی نیست." },
      { selector: '[data-pane-link="chat"]', title: "پیام‌ها", copy: "از این بخش به مربی انتخاب‌شده یا باشگاه پیام بده؛ ارتباط ورزشکار با ورزشکار در دسترس نیست." },
      { selector: "#drawer [data-menu=\"settings\"]", activate: "#modernMenuButton", cleanup: "#closeDrawer", title: "تنظیمات و راهنمایی بیشتر", copy: "برای تغییر تم، مشخصات حساب و خروج از حساب از منوی تنظیمات استفاده کن. دکمهٔ راهنما هم در تمام صفحه‌های پنل برای مرور دوباره در دسترس است." },
    ],
    "coach-dashboard.html": [
      { selector: ".coach-app h1", title: "داشبورد مربی", copy: "نمای کلی کارها و مسیرهای اختصاصی مربی از این صفحه در دسترس است." },
      { selector: ".tabs", title: "بخش‌های اصلی مربی", copy: "درخواست‌ها، تنظیم خدمات، ساخت برنامه، کتابخانهٔ برنامه‌ها، تراکنش‌ها و آموزش را از این نوار باز کن." },
      { selector: ".coach-briefing .primary", title: "ساخت برنامه", copy: "برای ساخت برنامهٔ تمرینی وارد ویرایشگر شو؛ راهنمای مرحله‌به‌مرحلهٔ همان صفحه، نام‌گذاری، روزها، حرکت‌ها، تایمر و ذخیره را توضیح می‌دهد." },
      { selector: ".coach-orbit", title: "مرکز فرماندهی", copy: "میان‌برهای برنامه‌سازی، کتابخانه، تراکنش‌ها و آموزش حرکت‌ها اینجا جمع شده‌اند." },
      { selector: ".coach-team-meter", title: "وضعیت فعالیت", copy: "شاخص‌ها و فعالیت‌های اخیر برای مرور سریع وضعیت کارها هستند؛ وضعیت نهایی درخواست را در صفحهٔ درخواست‌ها ببین." },
      { selector: ".activity", title: "فعالیت‌های اخیر", copy: "ارسال برنامه و درخواست‌های تازه را پیگیری کن. برای ثبت و بررسی درخواست‌ها از تب درخواست‌های مربی استفاده کن." },
    ],
    "admin.html": [
      { selector: "#tabs [data-tab=\"athletes\"]", title: "مدیریت ورزشکاران", copy: "فهرست ورزشکاران و ابزارهای جست‌وجو و ارتباط در این بخش قرار دارد." },
      { selector: "#tabs [data-tab=\"coaches\"]", activate: "#tabs [data-tab=\"coaches\"]", title: "مربیان باشگاه", copy: "مربیان و وضعیت دسترسی آن‌ها را اینجا بررسی کن؛ درخواست‌های تأیید نقش از مرکز دسترسی پیگیری می‌شوند." },
      { selector: "#tabs [data-tab=\"attendance\"]", activate: "#tabs [data-tab=\"attendance\"]", title: "ورود و خروج", copy: "گزارش تردد تأییدشده و تعداد جلسات باقی‌مانده را ببین و در صورت نیاز داده‌ها را تازه کن." },
      { selector: "#tabs [data-tab=\"overview\"]", activate: "#tabs [data-tab=\"overview\"]", title: "خلاصهٔ مدیریت", copy: "نمای کلی شاخص‌های باشگاه در این تب نمایش داده می‌شود." },
      { selector: "#tabs [data-tab=\"messageReport\"]", activate: "#tabs [data-tab=\"messageReport\"]", title: "گزارش پیام‌ها", copy: "پیام‌های ورزشکاران به مربی یا منشی و پاسخ‌ها را در گزارش پیام‌ها بررسی کن." },
      { selector: "#messageReportStatus", title: "به‌روزرسانی گزارش", copy: "برای دریافت تازهٔ گزارش از دکمهٔ به‌روزرسانی همان بخش استفاده کن. راهنما فقط مسیر را نشان می‌دهد و داده‌ای را تغییر نمی‌دهد." },
    ],
    "admin-dashboard.html": [
      { selector: ".admin-orbit-center", title: "مرکز مدیریت باشگاه", copy: "این داشبورد میان‌بر مدیریت کامل، اعضا، مربیان و گزارش‌های باشگاه است." },
      { selector: ".admin-orbit-item[href*=\"admin.html\"]", title: "اعضا و مربیان", copy: "فهرست‌ها و گزارش پیام‌ها را در مدیریت کامل ببین؛ برای تأیید دسترسی کارکنان از مرکز دسترسی استفاده کن." },
      { selector: ".admin-orbit-item[href*=\"transactions\"]", title: "تراکنش‌ها", copy: "درخواست گزارش مالی و فهرست تراکنش‌های باشگاه از این میان‌بر باز می‌شود." },
      { selector: "#adminOrbit .admin-orbit-item:nth-of-type(5)", title: "تردد", copy: "ورود و خروج و ماندهٔ جلسات را مرور کن؛ تأییدهای حساس فقط در بخش مربوط انجام می‌شوند." },
      { selector: ".back[href*=\"coach-market-log\"]", title: "گزارش سفارش‌های مربیان", copy: "درخواست‌ها و ارسال برنامه‌های مربیان را از گزارش سفارش‌ها پیگیری کن." },
    ],
    "coach.html": [
      { selector: '[data-panel-tour="workout-title"]', title: "۱. نام برنامه", copy: "برای پیدا کردن برنامه در کتابخانه، یک نام کوتاه و قابل تشخیص وارد کن." },
      { selector: '[data-panel-tour="workout-days"]', title: "۲. روزهای هفته", copy: "برای هر روز برنامهٔ جدا بساز؛ روز بدون حرکت به‌صورت استراحت باقی می‌ماند." },
      { selector: '[data-panel-tour="workout-add"]', title: "۳. انتخاب حرکت", copy: "تمرین جدید را بزن و حرکت را از بانک آموزش انتخاب کن. اگر حرکت در فهرست نیست، ابتدا آن را با دسته‌بندی یکتا به بانک اضافه کن." },
      { selector: '[data-panel-tour="workout-settings"]', title: "۴. ست، تکرار و استراحت", copy: "پس از افزودن حرکت، تعداد ست و تکرار هر ست را مشخص کن. اگر تایمر را روشن کنی، زمان اجرای هر ست، استراحت بین ست‌ها و فاصله تا حرکت بعدی را وارد کن." },
      { selector: '[data-panel-tour="workout-timer"]', title: "۵. تایمر روز", copy: "تایمر برای هر روز جداگانه روشن یا خاموش می‌شود. زمان کل با توجه به ست‌ها و استراحت‌ها خودکار محاسبه می‌شود." },
      { selector: '[data-panel-tour="workout-duration"]', title: "۶. زمان محاسبه‌شده", copy: "این مقدار برآورد خودکار اجرای روز است؛ لازم نیست زمان کل را دستی حساب کنی." },
      { selector: '[data-panel-tour="workout-save"]', title: "۷. ذخیرهٔ نسخهٔ مربی", copy: "ذخیره، الگوی برنامه را در کتابخانهٔ شخصی مربی ثبت می‌کند. خروج پیش از ذخیره هم پیام تأیید دارد." },
      { selector: '[data-panel-tour="workout-program-list"]', title: "۸. ارسال به ورزشکار", copy: "از کتابخانه برنامهٔ ذخیره‌شده را انتخاب و ارسال کن. هنگام ارسال، یک نسخهٔ مستقل ثبت می‌شود؛ ویرایش بعدی الگو، نسخهٔ قبلی ورزشکار را تغییر نمی‌دهد و ارسال در گزارش مدیریت ثبت می‌شود." },
    ],
    "coach-programs.html": [
      { selector: '[data-panel-tour="workout-new"]', title: "برنامه‌های ذخیره‌شده", copy: "از این صفحه برنامهٔ تمرینی جدید بساز یا به کتابخانهٔ برنامه‌های غذایی برو." },
      { selector: '[data-panel-tour="workout-list"]', title: "کتابخانهٔ تمرینی", copy: "الگوهای ذخیره‌شدهٔ خودت را ببین و در صورت نیاز نسخهٔ مربی را ویرایش کن." },
      { selector: "#workout-root", title: "ارسال یا بایگانی", copy: "برای ارسال، برنامه و حساب ورزشکار را انتخاب کن. ارسال، نسخهٔ ثابت ایجاد می‌کند و در گزارش مدیریت باقی می‌ماند؛ بایگانی الگو نسخه‌های ارسال‌شده را حذف نمی‌کند." },
      { selector: ".workout-header nav", title: "گزارش ارسال‌ها", copy: "گزارش برنامه‌های ارسال‌شده را جداگانه باز کن تا نسخه‌های ثبت‌شده را ببینی." },
    ],
    "coach-requests.html": [
      { selector: ".tabs [data-kind=\"workout\"]", title: "درخواست‌های مربی", copy: "درخواست‌های برنامهٔ تمرینی، حضوری و غذایی را با تب‌های بالا جدا کن." },
      { selector: "#request-list", title: "بررسی درخواست", copy: "اطلاعات ارسالی ورزشکار، مثل قد، وزن، هدف و عکس، قبل از تصمیم در کارت درخواست نمایش داده می‌شود." },
      { selector: "#request-list", title: "تأیید و تحویل", copy: "پس از تأیید، برای تمرینی/غذایی برنامه را ارسال کن؛ برای غذای سفارشی مبلغ را تعیین کن. درخواست پس از تحویل کامل می‌شود و سابقه در گزارش ثبت می‌ماند." },
    ],
    "nutrition-builder.html": [
      { selector: '[data-panel-tour="nutrition-title"]', title: "نام برنامهٔ غذایی", copy: "نامی بگذار که در کتابخانه و هنگام ارسال برای ورزشکار به‌سادگی پیدا شود." },
      { selector: '[data-panel-tour="nutrition-days"]', title: "روزهای هفته", copy: "برای هر روز هفته وعده‌های جدا ثبت کن؛ روز بدون وعده خالی می‌ماند." },
      { selector: '[data-panel-tour="nutrition-add"]', title: "افزودن وعده", copy: "صبحانه، ناهار، شام، میان‌وعده، مکمل و زمان‌های تمرین را از فهرست انتخاب کن." },
      { selector: '[data-panel-tour="nutrition-meal"]', title: "نوع وعده و توضیح", copy: "در هر کارت نوع وعده را انتخاب و ترکیب یا توضیح آن را بنویس؛ اگر روز خالی است، با افزودن وعده یک کارت بساز." },
      { selector: '[data-panel-tour="nutrition-save"]', title: "ذخیره و ارسال", copy: "ابتدا الگوی مربی را ذخیره کن؛ سپس از فهرست برنامه‌های غذایی آن را به ورزشکار ارسال کن. نسخهٔ ارسال‌شده تغییر نمی‌کند و در گزارش مدیریت ثبت می‌شود." },
    ],
    "coach-food.html": [
      { selector: "#nutrition-root", title: "کتابخانهٔ برنامهٔ غذایی", copy: "برنامه‌های غذایی ذخیره‌شدهٔ مربی را اینجا ببین؛ می‌توانی برنامه بسازی، ویرایش کنی یا نسخه‌ای را برای ورزشکار ارسال کنی." },
      { selector: ".workout-header nav", title: "ساخت و گزارش", copy: "از لینک ساخت برنامهٔ غذایی برای ایجاد الگو و از گزارش ارسال‌ها برای مشاهدهٔ نسخه‌های تحویل‌شده استفاده کن." },
    ],
    "nutrition.html": [
      { selector: "#nutrition-root", title: "برنامه‌های غذایی مربی", copy: "فهرست الگوهای غذایی را مرور کن؛ ارسال برای ورزشکار از روی نسخهٔ ذخیره‌شده انجام می‌شود." },
      { selector: ".workout-header nav", title: "ساخت برنامه", copy: "برای افزودن وعده و توضیحات هر روز، صفحهٔ ساخت برنامهٔ غذایی را باز کن." },
    ],
    "workout-view.html": [
      { selector: ".workout-header", title: "برنامهٔ تمرینی دریافتی", copy: "نام مربی و نسخهٔ ارسالی مشخص می‌شود؛ برنامه برای ورزشکار قابل ویرایش نیست." },
      { selector: "#workout-root", title: "روزهای تمرین", copy: "روز موردنظر را انتخاب کن. اگر تایمر فعال باشد، زمان کار و استراحت را از همین‌جا اجرا کن." },
      { selector: ".workout-header nav", title: "آموزش حرکت", copy: "از پیوند آموزش‌ها یا دکمهٔ آموزش کنار هر حرکت، ویدیو و راهنمای فرم را ببین." },
    ],
    "nutrition-view.html": [
      { selector: ".workout-header", title: "برنامهٔ غذایی دریافتی", copy: "این نسخه را مربی برایت فرستاده و در پنل ورزشکار فقط خواندنی است." },
      { selector: "#nutrition-root", title: "روزها و وعده‌ها", copy: "روز هفته را انتخاب کن و نوع وعده و توضیح ثبت‌شده را ببین." },
    ],
    "food-plan-view.html": [
      { selector: ".workout-header", title: "برنامهٔ غذایی دریافتی", copy: "این نسخه را مربی برایت فرستاده و در پنل ورزشکار فقط خواندنی است." },
      { selector: "#nutrition-root", title: "روزها و وعده‌ها", copy: "روز هفته را انتخاب کن و نوع وعده و توضیح ثبت‌شده را ببین." },
    ],
    "workout-log.html": [
      { selector: "#workout-root", title: "گزارش برنامه‌های ارسالی", copy: "نسخه‌های ارسال‌شدهٔ تمرینی و غذایی با تاریخ و نام ورزشکار در این گزارش فهرست می‌شوند." },
      { selector: ".workout-header nav", title: "باز کردن نسخه", copy: "مشاهدهٔ نسخه، محتوای زمان ارسال را باز می‌کند؛ تغییرات بعدی الگوی مربی روی این نسخه اعمال نمی‌شود." },
    ],
    "exercise-library.html": [
      { selector: "#workout-status", title: "بانک حرکات", copy: "نام حرکت و گروه عضلانی را جست‌وجو یا فیلتر کن؛ این بانک با استودیو و برنامه‌ساز مربی مشترک است." },
      { selector: "#workout-root", title: "انتخاب دسته", copy: "گروه عضلانی و سبک تمرین را برای محدودکردن نتایج تنظیم کن و حرکت را باز کن تا آموزش‌های موجود را ببینی." },
    ],
    "education.html": [
      { selector: "main", title: "آموزش‌های پنل", copy: "از کتابخانهٔ حرکات برای دیدن راهنماها استفاده کن؛ برای ساخت برنامهٔ اختصاصی مربی، از داشبورد وارد برنامه‌ساز شو." },
    ],
    "coach-offerings.html": [
      { selector: "#workout-enabled", title: "تنظیم خدمات مربی", copy: "با روشن یا خاموش‌کردن پذیرش درخواست‌ها مشخص کن ورزشکار چه خدماتی را بتواند سفارش دهد." },
      { selector: "#workout-packages", title: "پکیج تمرینی", copy: "نام، قیمت و توضیحات هر پکیج تمرینی را ثبت کن؛ برنامهٔ غذایی پکیج قیمت‌دار ندارد." },
      { selector: "#inperson-packages", title: "پکیج مربی حضوری", copy: "در صورت فعال‌بودن مربی حضوری، پکیج‌های آن را جدا تعریف کن." },
      { selector: "#offers-form button[type=\"submit\"]", title: "ذخیرهٔ صفحهٔ مربی", copy: "پس از تکمیل معرفی و پکیج‌ها، تغییرات را ذخیره کن تا در صفحهٔ عمومی مربیان باشگاه نمایش داده شود." },
    ],
    "coach-profile.html": [
      { selector: "#coach-name", title: "صفحهٔ مربی", copy: "ورزشکاران از این صفحه معرفی، تخصص و خدمات مربی را می‌بینند." },
      { selector: "#profile", title: "انتخاب خدمت", copy: "برای سفارش تمرینی، غذایی یا حضوری، خدمت فعال و پکیج مناسب را انتخاب کن." },
    ],
    "coach-directory.html": [
      { selector: "#directory-title", title: "مربیان باشگاه", copy: "مربی تأییدشده و خدمت موردنظرت را از فهرست انتخاب کن." },
      { selector: "#coach-list", title: "مشاهدهٔ جزئیات", copy: "صفحهٔ هر مربی، معرفی و پکیج‌های فعال او را نشان می‌دهد؛ برای درخواست برنامه باید فرم اطلاعات اجباری را کامل کنی." },
    ],
    "training-request.html": [
      { selector: "main", title: "درخواست برنامه", copy: "قد، وزن، هدف و تصویر برای مربی ارسال می‌شوند؛ توضیحات اختیاری است. قبل از ارسال، شماره و اطلاعات را بازبینی کن." },
    ],
    "coach-transactions.html": [
      { selector: ".balance", title: "تراکنش‌های مربی", copy: "موجودی و درخواست تسویهٔ مربی در بالای صفحه قرار دارد." },
      { selector: ".purple .tabs", title: "فیلتر تراکنش‌ها", copy: "تراکنش‌های امروز یا همهٔ تراکنش‌ها را انتخاب کن و نتیجه را پایین صفحه ببین." },
    ],
    "admin-transactions.html": [
      { selector: ".balance", title: "گزارش مالی باشگاه", copy: "درخواست گزارش مالی و خلاصهٔ حساب از این صفحه قابل دسترسی است." },
      { selector: ".purple .tabs", title: "فیلتر تراکنش‌ها", copy: "میان تراکنش‌های امروز و همهٔ موارد جابه‌جا شو." },
    ],
    "coach-market-log.html": [
      { selector: ".tabs", title: "گزارش سفارش مربیان", copy: "درخواست‌های تمرینی، حضوری و غذایی را بر اساس نوع فیلتر کن." },
      { selector: "#request-list", title: "پیگیری وضعیت", copy: "وضعیت درخواست و تحویل برنامه را از این گزارش دنبال کن؛ این بخش برای مرور مدیریت است." },
    ],
    "club-attendance.html": [
      { selector: "#download-section", title: "رابط تردد", copy: "برنامهٔ رابط MG یک‌بار روی رایانهٔ باشگاه نصب می‌شود و برای استفادهٔ روزمره به این صفحه برگرد." },
      { selector: "#station-section", title: "اتصال دستگاه", copy: "دستگاه و اتصال محلی را از این بخش بررسی کن؛ تنظیم اتصال اولیه فقط برای پشتیبان فنی است." },
      { selector: "#events-section", title: "شناسایی‌ها", copy: "رکوردهای شناسایی و درخواست‌های در انتظار را بررسی کن؛ فقط رویداد حضوریِ مطمئن را تأیید کن." },
      { selector: "#members-section", title: "حساب‌های متصل", copy: "شناسهٔ فرد روی دستگاه را به حساب سایت وصل کن و نگاشت‌های ثبت‌شده را بازبینی کن." },
    ],
    "access-center.html": [
      { selector: "#access-app", title: "مرکز حساب و دسترسی", copy: "مشخصات شخصی، نقش‌ها، درخواست‌های تأیید و بخش‌های مدیریتی را از تب‌های این صفحه مدیریت کن." },
    ],
    "device-verification.html": [
      { selector: "#self-device", title: "تأیید دستگاه تردد", copy: "وضعیت درخواست خودت را اینجا ببین؛ تأیید نهایی پس از تطبیق حضوری با دستگاه انجام می‌شود." },
      { selector: "#staff-device", title: "بررسی کارکنان", copy: "مسئول مجاز می‌تواند وضعیت ثبت دستگاه کاربران را بررسی کند." },
    ],
    "attendance-pilot.html": [
      { selector: "main", title: "اشتراک آزمایشی حضور", copy: "مانده و وضعیت اشتراک آزمایشی رابط را بررسی کن؛ این صفحه جایگزین تأیید نهایی ورود حضوری نیست." },
    ],
    "secretary.html": [
      { selector: "nav", title: "پنل منشی", copy: "عضویت‌ها، تردد، درخواست‌ها، درخواست نقدی، پیام‌ها و تنظیمات در تب‌های پنل قرار دارند." },
      { selector: "#requests", activate: '[data-pane="requests"]', title: "درخواست‌ها", copy: "درخواست‌های برنامه یا خدمات را بررسی کن و نتیجه را از همان کارت ثبت کن." },
      { selector: "#membershipRequests", activate: '[data-pane="membershipRequests"]', title: "درخواست نقدی عضویت", copy: "مشخصات و پکیج درخواستی را تطبیق بده؛ پس از تأیید، عضویت برای همان حساب فعال می‌شود." },
      { selector: "#messages", activate: '[data-pane="messages"]', title: "پیام‌ها", copy: "پیام ورزشکاران به باشگاه و پاسخ منشی در همین بخش پیگیری می‌شود." },
    ],
    "support.html": [
      { selector: "#access-app", title: "پنل پشتیبان فنی", copy: "حساب، دسترسی‌ها، تنظیمات و ابزارهای رابط باشگاه در مرکز دسترسی قرار دارند." },
    ],
  };

  const HOME_PAGES = new Set(["dashboard.html", "coach-dashboard.html", "admin.html"]);
  const page = location.pathname.split("/").filter(Boolean).pop() || "index.html";
  const steps = PAGE_TOURS[page];
  if (!steps) return;

  const role = document.body?.dataset.role || localStorage.getItem("mg_role") ||
    (page.startsWith("coach") || page === "nutrition-builder.html" || page === "nutrition.html" || page === "coach-food.html" ? "coach" : page.startsWith("admin") ? "manager" : "athlete");
  const seenKey = `mg_panel_tour_seen_${version}_${role}`;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  function mount() {
    if (!document.body || document.querySelector("[data-mg-panel-tour-trigger]")) return;
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "mg-panel-tour-trigger";
    trigger.dataset.mgPanelTourTrigger = "";
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.setAttribute("aria-label", "راهنمای این صفحه را باز کن");
    trigger.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.7 9a2.4 2.4 0 1 1 4.2 1.6c-.9 1-1.9 1.2-1.9 2.8M12 17h.01"/></svg><span>راهنما</span>';

    const overlay = document.createElement("div");
    overlay.className = "mg-panel-tour";
    overlay.hidden = true;
    overlay.innerHTML = '<button class="mg-panel-tour__backdrop" type="button" data-tour-close aria-label="بستن راهنما"></button><div class="mg-panel-tour__spotlight" aria-hidden="true"></div><section class="mg-panel-tour__card" role="dialog" aria-modal="true" aria-labelledby="mgPanelTourTitle" aria-describedby="mgPanelTourCopy" tabindex="-1"><div class="mg-panel-tour__top"><span class="mg-panel-tour__mark" aria-hidden="true">MG</span><span class="mg-panel-tour__count" aria-live="polite"></span></div><h2 id="mgPanelTourTitle"></h2><p id="mgPanelTourCopy"></p><div class="mg-panel-tour__actions"><button type="button" class="mg-panel-tour__skip" data-tour-close>پایان راهنما</button><button type="button" data-tour-back>قبلی</button><button type="button" class="mg-panel-tour__next" data-tour-next>بعدی</button></div></section></div>';
    document.body.append(trigger, overlay);

    const card = overlay.querySelector(".mg-panel-tour__card");
    const title = overlay.querySelector("#mgPanelTourTitle");
    const copy = overlay.querySelector("#mgPanelTourCopy");
    const count = overlay.querySelector(".mg-panel-tour__count");
    const spotlight = overlay.querySelector(".mg-panel-tour__spotlight");
    const back = overlay.querySelector("[data-tour-back]");
    const next = overlay.querySelector("[data-tour-next]");
    let index = 0;
    let target = null;
    let returnFocus = null;
    let raf = 0;

    const markSeen = () => { try { localStorage.setItem(seenKey, "1"); } catch {} };
    const place = () => {
      raf = 0;
      if (overlay.hidden || !target?.isConnected) { spotlight.hidden = true; return; }
      const r = target.getBoundingClientRect();
      const pad = 6;
      const left = Math.max(4, r.left - pad), top = Math.max(4, r.top - pad);
      spotlight.hidden = false;
      Object.assign(spotlight.style, {
        left: `${left}px`, top: `${top}px`,
        width: `${Math.max(24, Math.min(innerWidth - left - 4, r.width + pad * 2))}px`,
        height: `${Math.max(24, Math.min(innerHeight - top - 4, r.height + pad * 2))}px`,
      });
      card.dataset.placement = r.top > innerHeight * .55 ? "top" : "bottom";
    };
    const schedulePlace = () => { if (!raf) raf = requestAnimationFrame(place); };

    async function render(focusControl = false) {
      const step = steps[index];
      if (step.activate) {
        const control = document.querySelector(step.activate);
        if (control && !control.classList.contains("active") && control.getAttribute("aria-selected") !== "true") {
          control.click();
          await wait(80);
        }
      }
      target?.classList.remove("mg-panel-tour__target");
      target = document.querySelector(step.selector);
      title.textContent = step.title;
      copy.textContent = step.copy;
      count.textContent = `${new Intl.NumberFormat("fa-IR").format(index + 1)} از ${new Intl.NumberFormat("fa-IR").format(steps.length)}`;
      back.disabled = index === 0;
      next.textContent = index === steps.length - 1 ? "پایان" : "بعدی";
      if (target) {
        target.classList.add("mg-panel-tour__target");
        target.scrollIntoView({ behavior: reduceMotion.matches ? "auto" : "smooth", block: "center", inline: "nearest" });
      }
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      schedulePlace();
      if (focusControl) next.focus({ preventScroll: true });
    }
    function cleanup(step = steps[index]) {
      if (step?.cleanup) document.querySelector(step.cleanup)?.click();
    }
    function close() {
      cleanup();
      markSeen();
      overlay.hidden = true;
      document.body.classList.remove("mg-panel-tour-open");
      target?.classList.remove("mg-panel-tour__target");
      target = null;
      if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    }
    async function open() {
      if (!overlay.hidden) return;
      returnFocus = document.activeElement;
      index = 0;
      overlay.hidden = false;
      document.body.classList.add("mg-panel-tour-open");
      await render();
      overlay.querySelector("[data-tour-close]").focus({ preventScroll: true });
    }

    trigger.addEventListener("click", open);
    overlay.querySelectorAll("[data-tour-close]").forEach(button => button.addEventListener("click", close));
    back.addEventListener("click", async () => {
      if (index === 0) return;
      cleanup();
      index -= 1;
      await render(true);
    });
    next.addEventListener("click", async () => {
      if (index >= steps.length - 1) return close();
      cleanup();
      index += 1;
      await render(true);
    });
    overlay.addEventListener("keydown", event => {
      if (event.key === "Escape") { event.preventDefault(); close(); return; }
      if (event.key !== "Tab") return;
      const controls = [...overlay.querySelectorAll("button:not(:disabled)")];
      if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus(); }
    });
    addEventListener("resize", schedulePlace, { passive: true });
    addEventListener("scroll", schedulePlace, { passive: true, capture: true });

    if (HOME_PAGES.has(page)) {
      let seen = false;
      try { seen = localStorage.getItem(seenKey) === "1"; } catch {}
      if (!seen) {
        const startOnce = () => setTimeout(() => { if (!seen) open(); }, 1200);
        if (document.readyState === "complete") startOnce();
        else addEventListener("load", startOnce, { once: true });
      }
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
  else mount();
})();
