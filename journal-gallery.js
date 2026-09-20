(() => {
  'use strict';
  const track = document.getElementById('poster-track');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (track) {
    const cards = [...track.querySelectorAll('.poster-card')];
    const filters = [...document.querySelectorAll('[data-poster-filter]')];
    const arrows = [...document.querySelectorAll('[data-poster-direction]')];
    document.querySelector('.poster-filters').hidden = false;
    document.querySelector('.poster-arrows').hidden = false;
    const sync = () => {
      const max = Math.max(0, track.scrollWidth - track.clientWidth);
      const position = Math.min(max, Math.abs(track.scrollLeft));
      arrows.forEach(button => { button.disabled = Number(button.dataset.posterDirection) > 0 ? position <= 2 : position >= max - 2; });
    };
    filters.forEach(button => button.addEventListener('click', () => {
      const category = button.dataset.posterFilter;
      filters.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      cards.forEach(card => { card.hidden = category !== 'همه' && card.dataset.category !== category; });
      document.getElementById('poster-count').textContent = cards.filter(card => !card.hidden).length.toLocaleString('fa-IR') + ' فیلم';
      track.scrollLeft = 0; sync();
    }));
    arrows.forEach(button => button.addEventListener('click', () => {
      const first = cards.find(card => !card.hidden);
      track.scrollBy({left: Number(button.dataset.posterDirection) * ((first?.getBoundingClientRect().width || 280) + 24), behavior: reduced ? 'auto' : 'smooth'});
    }));
    let start = null, moved = false, suppressUntil = 0;
    track.addEventListener('pointerdown', event => {
      if (event.pointerType !== 'mouse' || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      start = {id:event.pointerId,x:event.clientX,scroll:track.scrollLeft}; moved = false;
    });
    track.addEventListener('pointermove', event => {
      if (!start || event.pointerId !== start.id) return;
      const delta = event.clientX - start.x;
      if (!moved && Math.abs(delta) < 8) return;
      if (!moved) { moved = true; track.setPointerCapture(event.pointerId); track.classList.add('is-dragging'); }
      track.scrollLeft = start.scroll - delta; event.preventDefault();
    });
    const finish = () => { if (moved) suppressUntil = Date.now() + 350; start = null; moved = false; track.classList.remove('is-dragging'); sync(); };
    track.addEventListener('pointerup', finish); track.addEventListener('pointercancel', finish);
    track.addEventListener('lostpointercapture', finish);
    track.addEventListener('pointerleave', () => { if (!moved) start = null; });
    track.addEventListener('dragstart', event => event.preventDefault());
    track.addEventListener('click', event => { if (Date.now() < suppressUntil) { event.preventDefault(); event.stopPropagation(); } }, true);
    track.addEventListener('scroll', sync, {passive:true}); window.addEventListener('resize', sync); sync();
  }
  const video = document.getElementById('detail-video');
  if (video) {
    const error = document.querySelector('.film-detail-error');
    const showError = () => { error.hidden = false; };
    video.addEventListener('error', showError); video.querySelector('source')?.addEventListener('error', showError);
    video.addEventListener('loadeddata', () => { error.hidden = true; });
  }
})();
