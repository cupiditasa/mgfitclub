(() => {
  'use strict';
  const profile = document.getElementById('profile');
  if (profile) {
    const updateProfile = () => {
      for (const card of profile.querySelectorAll('.offer-card')) {
        const button = card.querySelector('button');
        if (button?.textContent.trim() === 'سفارش این پکیج') button.textContent = 'درخواست نقدی این پکیج';
        if (!card.querySelector('[data-cash-note]') && !card.textContent.includes('درخواست با پرداخت نقدی در باشگاه')) {
          const note = document.createElement('p');
          note.dataset.cashNote = 'workout';
          note.className = 'muted';
          note.textContent = 'درخواست با پرداخت نقدی در باشگاه؛ سفارش پس از ارسال برنامه تکمیل می‌شود.';
          card.append(note);
        }
      }
      for (const section of profile.querySelectorAll('.market-panel')) {
        if (section.querySelector('h2')?.textContent.trim() !== 'برنامهٔ غذایی') continue;
        const button = section.querySelector('button');
        if (button) button.textContent = 'درخواست برنامهٔ غذایی با پرداخت نقدی';
        const note = section.querySelector('[data-cash-note]') || section.querySelector('p.muted') || document.createElement('p');
        note.dataset.cashNote = 'nutrition';
        note.className = 'muted';
        note.textContent = 'مربی هنگام تأیید مبلغ نقدی را مشخص می‌کند؛ پس از ارسال برنامه، سفارش تکمیل می‌شود.';
        if (!note.isConnected) section.append(note);
      }
    };
    new MutationObserver(updateProfile).observe(profile, { childList: true, subtree: true });
    updateProfile();
  }

  const list = document.getElementById('request-list');
  if (!list) return;
  const isLogPage = location.pathname.endsWith('coach-market-log.html');
  const originalRequest = window.MGApi?.request;
  let cachedRequests = [];
  let nutritionPrice = null;
  if (originalRequest) {
    window.MGApi.request = function (path, options = {}) {
      const payload = options.body;
      const isRequestList = path === '/api/coach-market/requests' && (!options.method || options.method === 'GET');
      const isReview = typeof path === 'string' && /\/api\/coach-market\/requests\/[A-Za-z0-9_-]+$/.test(path) && options.method === 'PATCH';
      if (isReview && payload?.status === 'approved' && nutritionPrice !== null) {
        options = { ...options, body: { ...payload, cashAmountToman: nutritionPrice } };
        nutritionPrice = null;
      }
      const result = originalRequest.call(this, path, options);
      if (isRequestList) return result.then(data => { cachedRequests = data.requests || []; setTimeout(decorateRequests, 0); return data; });
      return result;
    };
  }
  const decorateRequests = () => {
    const tabSelector = isLogPage ? '[data-filter].primary' : '[data-kind].primary';
    const selectedKind = document.querySelector(tabSelector)?.dataset[isLogPage ? 'filter' : 'kind'] || 'workout';
    const shown = cachedRequests.filter(request => selectedKind === 'all' || request.kind === selectedKind);
    const cards = [...list.querySelectorAll('.request-card')];
    for (const [index, card] of cards.entries()) {
      const request = shown[index];
      const isNutrition = request?.kind === 'nutrition' || card.textContent.includes('درخواست برنامهٔ غذایی') || card.textContent.includes('برنامهٔ غذایی');
      const isWorkout = request?.kind === 'workout' || card.textContent.includes('درخواست برنامهٔ تمرینی') || card.textContent.includes('برنامهٔ تمرینی');
      if (!isNutrition && !isWorkout) continue;
      const note = card.querySelector('[data-cash-note]') || document.createElement('p');
      note.dataset.cashNote = isLogPage ? 'report' : 'coach';
      note.className = 'muted';
      const amount = request?.cash_amount_toman ? ` · مبلغ ${Number(request.cash_amount_toman).toLocaleString('fa-IR')} تومان` : '';
      const orderState = request?.status === 'completed' ? 'تکمیل‌شده' : request?.status === 'rejected' ? 'لغوشده' : request?.status === 'approved' ? 'در انتظار ارسال برنامه' : 'در انتظار تأیید مربی';
      note.textContent = `${request?.payment_method === 'cash' ? 'پرداخت نقدی' : 'درخواست قدیمیِ بدون سفارش نقدی'}${amount} · ${orderState}`;
      if (!note.isConnected) card.append(note);
      const approve = [...card.querySelectorAll('button')].find(button => button.textContent.trim() === 'تأیید');
      if (approve && isNutrition && request?.payment_method === 'cash' && !approve.dataset.cashPrompt) {
        approve.dataset.cashPrompt = '1';
        approve.addEventListener('click', event => {
          const input = window.prompt('مبلغ نقدی برنامهٔ غذایی را به تومان وارد کنید:');
          const value = Number(String(input || '').replace(/[۰-۹٠-٩,٬\s]/g, digit => {
            const chars = '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩';
            const index = chars.indexOf(digit);
            return index < 0 ? '' : String(index % 10);
          }));
          if (input === null || !Number.isSafeInteger(value) || value < 1 || value > 1000000000) {
            event.preventDefault();
            event.stopImmediatePropagation();
            if (input !== null) window.alert('مبلغ معتبر و بزرگ‌تر از صفر وارد کنید.');
            return;
          }
          nutritionPrice = value;
        }, true);
      }
      if (!isLogPage && card.querySelector('button.primary') && !card.querySelector('[data-build-plan]') && !card.textContent.includes('تکمیل‌شده')) {
        const createLink = document.createElement('a');
        createLink.dataset.buildPlan = '1';
        createLink.className = 'primary';
        createLink.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:8px 14px;border-radius:12px;background:#c5fa53;color:#15200c;font-weight:700;text-decoration:none';
        createLink.href = isNutrition ? 'nutrition-builder.html' : 'coach-programs.html';
        createLink.target = '_blank';
        createLink.rel = 'noopener';
        createLink.textContent = 'ساخت برنامهٔ جدید';
        createLink.setAttribute('aria-label', 'ساخت برنامهٔ جدید؛ درخواست باز می‌ماند تا برنامه ارسال شود');
        const actions = card.querySelector('.actions');
        if (actions && card.textContent.includes('تأییدشده')) actions.append(createLink);
      }
    }
  };
  new MutationObserver(decorateRequests).observe(list, { childList: true, subtree: true });
  decorateRequests();
  if (originalRequest) originalRequest.call(window.MGApi, '/api/coach-market/requests').then(data => { cachedRequests = data.requests || []; decorateRequests(); }).catch(() => {});
})();
