(() => {
  'use strict';
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce), (max-height: 540px)');
  const body = document.body;
  const prompt = document.querySelector('#typed-prompt');
  const promptText = prompt.textContent;
  const roleText = 'System:';
  const roleSpan = document.createElement('span');
  roleSpan.className = 'prompt-role';
  const promptTail = document.createTextNode('');
  prompt.replaceChildren(roleSpan, promptTail);
  function renderPrompt(text) {
    roleSpan.textContent = text.slice(0, roleText.length);
    promptTail.textContent = text.slice(roleText.length);
  }
  renderPrompt(promptText);
  let typingFrame, typingStarted = false, typingFinished = motionPreference.matches;
  let promptVisible = false, elapsed = 0, lastFrame = null;
  if (!reducedMotion.matches) body.classList.add('motion');
  function finishTyping() {
    cancelAnimationFrame(typingFrame);
    typingFinished = true;
    renderPrompt(promptText);
    prompt.classList.remove('typing-cursor');
    body.classList.remove('typing');
    prompt.parentElement.style.minHeight = '';
  }
  function type(now) {
    if (typingFinished) return;
    if (!document.hidden && promptVisible) {
      if (lastFrame !== null) elapsed += Math.min(now - lastFrame, 40);
      const length = Math.min(promptText.length, Math.max(0, Math.floor((elapsed - 250) / 14)));
      renderPrompt(promptText.slice(0, length));
      if (length === promptText.length) { finishTyping(); return; }
    }
    lastFrame = now;
    typingFrame = requestAnimationFrame(type);
  }
  function startTyping() {
    if (typingStarted || typingFinished || document.hidden || !promptVisible) return;
    typingStarted = true;
    prompt.parentElement.style.minHeight = `${prompt.parentElement.offsetHeight}px`;
    body.classList.add('typing');
    renderPrompt('');
    prompt.classList.add('typing-cursor');
    typingFrame = requestAnimationFrame(type);
  }
  const promptObserver = new IntersectionObserver(entries => {
    promptVisible = entries[0].isIntersecting;
    startTyping();
  }, { threshold: .15 });
  promptObserver.observe(prompt);
  document.addEventListener('visibilitychange', startTyping);
  motionPreference.addEventListener('change', () => { if (motionPreference.matches) finishTyping(); });
  document.querySelector('.full-prompt').addEventListener('toggle', event => {
    if (event.currentTarget.open) finishTyping();
  });

  const scenes = [...document.querySelectorAll('.scroll-scene')];
  const epilogueEnding = document.querySelector('.epilogue-ending');
  const clamp = n => Math.max(0, Math.min(1, n));
  let queued = false;
  function updateScenes() {
    queued = false;
    if (reducedMotion.matches) return;
    if (epilogueEnding) {
      const endingRect = epilogueEnding.getBoundingClientRect();
      const endingCenter = endingRect.top + endingRect.height / 2;
      const centerBand = Math.max(90, innerHeight * .12);
      const endingOpacity = clamp((innerHeight * (2 / 3) - endingCenter) / centerBand);
      epilogueEnding.style.setProperty('--epilogue-ending-opacity', endingOpacity);
    }
    for (const scene of scenes) {
      const rect = scene.getBoundingClientRect();
      if (scene.classList.contains('reveal-scene')) {
        const stage = scene.querySelector('.scene-stage');
        const lineRect = scene.querySelector('.reveal-line').getBoundingClientRect();
        const lineCenter = lineRect.top + lineRect.height / 2;
        const stageTop = parseFloat(getComputedStyle(stage).top) || 0;
        const progress = clamp((stageTop - rect.top) / Math.max(1, rect.height - stage.offsetHeight));
        const centerBand = Math.max(90, innerHeight * .12);
        const endingOpacity = clamp((innerHeight * .56 - lineCenter) / centerBand);
        scene.style.setProperty('--ending-opacity', endingOpacity);
        scene.style.setProperty('--image-opacity', clamp(progress / .24));
      } else {
        // No sticky positioning or added scroll distance: blend as the image center
        // moves through a short band around the viewport center.
        const imageRect = scene.querySelector('.image-stack').getBoundingClientRect();
        const center = imageRect.top + imageRect.height / 2;
        const distance = Math.min(80, innerHeight * .08);
        const fade = clamp((innerHeight / 2 + distance / 2 - center) / distance);
        scene.style.setProperty('--fade', fade);
        const after = scene.querySelector('.after');
        after.classList.toggle('active', fade >= .5);
        scene.querySelector('.before a').tabIndex = fade >= .5 ? -1 : 0;
        after.querySelector('a').tabIndex = fade >= .5 ? 0 : -1;
      }
    }
  }
  function scheduleScenes() { if (!queued) { queued = true; requestAnimationFrame(updateScenes); } }
  window.addEventListener('scroll', scheduleScenes, {passive:true});
  window.addEventListener('resize', scheduleScenes);
  reducedMotion.addEventListener('change', () => {
    body.classList.toggle('motion', !reducedMotion.matches);
    if (reducedMotion.matches) document.querySelectorAll('.image-stack a').forEach(a => a.tabIndex = 0);
    scheduleScenes();
  });
  scheduleScenes();

  const dialog = document.querySelector('#media-dialog');
  const mediaBody = document.querySelector('#media-body');
  const title = document.querySelector('#media-title');
  const galleryControls = document.querySelector('.gallery-controls');
  const closeButton = document.querySelector('#close-dialog');
  const gameTitles = {snake:'Snake', 'tiny-arena':'Tiny Arena', pelican:'Pelican Path'};
  let returnFocus, gallery = [], galleryIndex = 0;
  function resetZoom() {
    mediaBody.classList.remove('zoomed');
  }
  function toggleZoom() {
    const img = mediaBody.querySelector('img');
    if (!img) return;
    const zoomed = mediaBody.classList.toggle('zoomed');
    mediaBody.style.setProperty('--zoom-width', `${Math.min(img.naturalWidth || 3104, Math.max(1400, mediaBody.clientWidth * 2))}px`);
    img.setAttribute('aria-label', zoomed ? 'Fit image to viewer' : 'Zoom into image');
    img.setAttribute('aria-pressed', String(zoomed));
    mediaBody.scrollLeft = 0;
    mediaBody.scrollTop = 0;
  }
  mediaBody.addEventListener('keydown', event => {
    if (event.target.tagName === 'IMG' && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); toggleZoom(); }
  });
  mediaBody.addEventListener('click', event => { if (event.target.tagName === 'IMG') toggleZoom(); });
  function openViewer(source) {
    returnFocus = source;
    dialog.showModal();
    body.classList.add('locked');
    closeButton.focus();
  }
  function showImage(item) {
    resetZoom();
    title.textContent = item.caption;
    const image = new Image();
    image.alt = item.caption;
    image.width = 3104;
    image.height = 1974;
    image.src = item.src;
    image.tabIndex = 0;
    image.setAttribute('role', 'button');
    image.setAttribute('aria-label', 'Zoom into image');
    image.setAttribute('aria-pressed', 'false');
    mediaBody.replaceChildren(image);
    document.querySelector('#gallery-position').textContent = `${galleryIndex + 1} / ${gallery.length}`;
  }
  document.querySelectorAll('[data-lightbox]').forEach(link => link.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (link.hasAttribute('data-gallery')) {
      gallery = [
        {src: link.href, caption: link.dataset.caption},
        {src: 'assets/images/snakediff.png', caption: 'The Snake loses an eye between page renders.'}
      ];
      galleryIndex = 0;
      dialog.classList.remove('game-dialog');
      galleryControls.hidden = false;
      showImage(gallery[0]);
      openViewer(link);
      return;
    }
    gallery = [];
    dialog.classList.remove('game-dialog');
    galleryControls.hidden = true;
    showImage({src:link.href, caption:link.dataset.caption});
    openViewer(link);
  }));
  function stepGallery(direction) {
    if (!gallery.length) return;
    galleryIndex = (galleryIndex + direction + gallery.length) % gallery.length;
    showImage(gallery[galleryIndex]);
  }
  document.querySelector('#gallery-prev').addEventListener('click', () => stepGallery(-1));
  document.querySelector('#gallery-next').addEventListener('click', () => stepGallery(1));
  document.querySelectorAll('[data-game]').forEach(link => link.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    gallery = [];
    dialog.classList.add('game-dialog');
    galleryControls.hidden = true;
    resetZoom();
    title.textContent = gameTitles[link.dataset.game];
    const frame = document.createElement('iframe');
    frame.title = `${title.textContent} — playable game`;
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.src = link.href;
    mediaBody.replaceChildren(frame);
    openViewer(link);
  }));
  closeButton.addEventListener('click', () => dialog.close());
  window.addEventListener('message', event => {
    const frame = mediaBody.querySelector('iframe');
    if (frame && event.source === frame.contentWindow && event.data?.type === 'close-article-game') dialog.close();
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' && gallery.length) { event.preventDefault(); stepGallery(-1); }
    if (event.key === 'ArrowRight' && gallery.length) { event.preventDefault(); stepGallery(1); }
  });
  dialog.addEventListener('close', () => {
    body.classList.remove('locked');
    mediaBody.replaceChildren(); // Stop games and their timers when the modal closes.
    returnFocus?.focus({preventScroll:true});
  });
  let touchStart;
  mediaBody.addEventListener('touchstart', event => {
    if (event.touches.length === 1) touchStart = event.touches[0].clientX;
    else touchStart = undefined;
  }, {passive:true});
  mediaBody.addEventListener('touchend', event => {
    if (touchStart === undefined || !gallery.length || mediaBody.classList.contains('zoomed')) return;
    const delta = event.changedTouches[0].clientX - touchStart;
    if (Math.abs(delta) > 60) stepGallery(delta > 0 ? -1 : 1);
    touchStart = undefined;
  }, {passive:true});
  document.querySelectorAll('.note-trigger').forEach(button => button.addEventListener('click', () => {
    const expanded = button.getAttribute('aria-expanded') !== 'true';
    document.querySelectorAll('.note').forEach(note => {
      note.classList.remove('open');
      note.querySelector('button').setAttribute('aria-expanded', 'false');
    });
    button.closest('.note').classList.toggle('open', expanded);
    button.setAttribute('aria-expanded', String(expanded));
    if (!expanded) button.blur();
  }));
  document.addEventListener('click', event => {
    if (event.target.closest('.note')) return;
    document.querySelectorAll('.note').forEach(note => {
      note.classList.remove('open');
      note.querySelector('button').setAttribute('aria-expanded', 'false');
    });
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') document.querySelectorAll('.note.open').forEach(note => {
      note.classList.remove('open');
      note.querySelector('button').setAttribute('aria-expanded','false');
      note.querySelector('button').blur();
    });
  });
})();
