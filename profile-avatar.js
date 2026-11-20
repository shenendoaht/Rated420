(() => {
  'use strict';

  function initials(name) {
    const words = String(name || '').trim().split(/\s+/u)
      .map(word => word.replace(/^[^\p{L}\p{N}]+/u, '')).filter(Boolean);
    const letters = words.length > 1 ? [words[0], words[words.length - 1]] : words;
    return letters.map(word => Array.from(word)[0]).join('').toLocaleUpperCase() || '•';
  }

  function update(frame, { name, src, onError } = {}) {
    frame.querySelector('.profile-avatar-fallback').textContent = initials(name);
    const previous = frame.querySelector('img');
    const image = document.createElement('img');
    image.id = previous.id;
    if (!image.id) image.removeAttribute('id');
    image.alt = '';
    image.decoding = 'async';
    image.addEventListener('load', () => {
      if (image.parentNode === frame) image.classList.add('avatar-loaded');
    });
    image.addEventListener('error', () => {
      if (image.parentNode === frame) onError?.();
    });
    previous.replaceWith(image);
    if (src) image.src = src;
  }

  function create(options, size = 'small') {
    const frame = document.createElement('span');
    frame.className = 'profile-avatar profile-avatar--' + size;
    frame.setAttribute('aria-hidden', 'true');
    const fallback = document.createElement('span');
    fallback.className = 'profile-avatar-fallback';
    frame.append(fallback, document.createElement('img'));
    update(frame, options);
    return frame;
  }

  window.Rated420Avatar = { create, update };
})();
