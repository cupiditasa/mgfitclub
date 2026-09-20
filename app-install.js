(() => {
  'use strict';
  const install = document.getElementById('install-app');
  const status = document.getElementById('install-status');
  const standalone = window.matchMedia('(display-mode: standalone)');
  // Detection only tailors instructions; installation always uses browser capability.
  const ua = navigator.userAgent || '';
  const hint = document.getElementById('browser-hint');
  if (hint && /Firefox\/|FxiOS\//.test(ua)) {
    hint.textContent = /Android/.test(ua)
      ? 'در فایرفاکس اندروید، از منوی خود مرورگر برای نصب یا افزودن به صفحهٔ اصلی استفاده کن؛ مراحل زیر را دنبال کن.'
      : /iPhone|iPad|iPod|FxiOS/.test(ua)
        ? 'در فایرفاکس آیفون، اگر افزودن به صفحهٔ اصلی در دسترس نیست، صفحهٔ ورود را در Safari باز کن.'
        : 'در فایرفاکس این دستگاه، منوی مرورگر را برای افزودن سایت بررسی کن؛ دکمهٔ نصب داخل سایت فقط با پشتیبانی مرورگر ظاهر می‌شود.';
  }
  let pending = null;
  const installed = () => standalone.matches || navigator.standalone === true;
  const showInstalled = () => {
    if (!installed()) return;
    pending = null; install.hidden = true;
    status.textContent = 'MG را در حالت اپلیکیشن باز کرده‌ای؛ برای ادامه، «ورود به نسخهٔ وب» را انتخاب کن.';
  };
  showInstalled();
  standalone.addEventListener?.('change', showInstalled);
  window.addEventListener('beforeinstallprompt', event => {
    if (installed()) return;
    event.preventDefault(); pending = event; install.hidden = false;
    status.textContent = 'مرورگر امکان نصب را آماده کرده؛ برای افزودن MG، دکمهٔ نصب را بزن.';
  });
  install.addEventListener('click', async () => {
    if (!pending) return;
    const prompt = pending; pending = null; install.disabled = true;
    try {
      await prompt.prompt();
      const result = await prompt.userChoice;
      status.textContent = result.outcome === 'accepted'
        ? 'درخواست نصب پذیرفته شد؛ مراحل مرورگر را کامل کن و سپس آیکن MG را در دستگاهت پیدا کن.'
        : 'نصب لغو شد؛ همچنان می‌توانی از نسخهٔ وب یا راهنمای دستی استفاده کنی.';
    } catch (_) {
      status.textContent = 'پنجرهٔ نصب باز نشد؛ از راهنمای دستی مرورگرت استفاده کن.';
    } finally { install.disabled = false; install.hidden = !pending; }
  });
  window.addEventListener('appinstalled', () => {
    pending = null; install.hidden = true;
    status.textContent = 'نصب MG انجام شد؛ از آیکن برنامه روی دستگاهت وارد شو.';
  });
  if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      if (!installed()) status.textContent = 'آماده‌سازی نصب کامل نشد؛ اتصال اینترنت را بررسی کن. ورود به نسخهٔ وب همچنان در دسترس است.';
    });
  }
})();
