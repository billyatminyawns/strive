// Small view helpers: escaping, icons, formatting, shared components, toasts and sheets.

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const attr = (o) => esc(JSON.stringify(o));

const svg = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${d}</svg>`;
export const icon = {
  home: svg('<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),
  ask: svg('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 10.5h7M8.5 13.5h4.5"/>'),
  library: svg('<path d="M5 4h4v16H5zM11 4h4v16h-4z"/><path d="m17 4.5 3.5 1-4 15-3.5-1"/>'),
  you: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>'),
  bell: svg('<path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 20a2 2 0 0 0 4 0"/>'),
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 4.5v15a1 1 0 0 0 1.5.86l12.4-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect fill="currentColor" x="5" y="4" width="5" height="16" rx="1.5"/><rect fill="currentColor" x="14" y="4" width="5" height="16" rx="1.5"/></svg>',
  check: svg('<path d="m5 12.5 4.5 4.5L19 7.5"/>', ' stroke-width="2.6"'),
  x: svg('<path d="M6 6l12 12M18 6 6 18"/>', ' stroke-width="2.4"'),
  edit: svg('<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/>'),
  mic: svg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'),
  stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect fill="currentColor" x="6" y="6" width="12" height="12" rx="2"/></svg>',
  seal: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m12 1.8 2.3 1.9 3-.3.9 2.9 2.6 1.5-.8 2.9 1.1 2.8-2.4 1.8-.2 3-3 .5-1.6 2.6-2.9-1-2.9 1-1.6-2.6-3-.5-.2-3L1 13.4l1.1-2.8-.8-2.9L3.9 6.2l.9-2.9 3 .3z"/><path d="m8 12.3 2.6 2.6L16.2 9" stroke="#0B0C0B" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  up: svg('<path d="M12 19V5M5.5 11.5 12 5l6.5 6.5"/>', ' stroke-width="2.6"'),
  chev: svg('<path d="m9 5 7 7-7 7"/>'),
  back: svg('<path d="m15 5-7 7 7 7"/>', ' stroke-width="2.4"'),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  hand: svg('<path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V12M11 11V4.5a1.5 1.5 0 0 1 3 0V12M14 11.5V6a1.5 1.5 0 0 1 3 0v8a7 7 0 0 1-7 7h-.5A6.5 6.5 0 0 1 4 14.5V12a1.5 1.5 0 0 1 3 0v1"/>'),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  approve: svg('<rect x="3" y="4" width="18" height="16" rx="4"/><path d="m8 12 3 3 5-6"/>'),
  sliders: svg('<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>'),
  spark: svg('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.5 2.5M15.2 15.2l2.5 2.5M6.3 17.7l2.5-2.5M15.2 8.8l2.5-2.5"/>'),
  pin: svg('<path d="M9 4h6l-1 6 3 3H7l3-3zM12 13v7"/>'),
  link: svg('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
  trash: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  share: svg('<path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>'),
  wave: svg('<path d="M3 12h2M7 8v8M11 5v14M15 8v8M19 11v2"/>'),
  info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'),
  bookmark: svg('<path d="M6 3h12v18l-6-4-6 4z"/>'),
  bookmarkOn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6 3h12v18l-6-4-6 4z"/></svg>',
};

// ---------- formatting ----------
export function clock(sec) {
  if (!isFinite(sec) || sec <= 0) return '0:00';
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
export function rel(ms) {
  if (!ms) return '';
  const d = (Date.now() - ms) / 1000;
  if (d < 60) return 'just now';
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  if (d < 86400 * 7) return `${Math.floor(d / 86400)}d ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
export function greeting() {
  const h = new Date().getHours();
  return h >= 5 && h < 12 ? 'Good morning' : h < 17 && h >= 12 ? 'Good afternoon' : 'Good evening';
}
export const today = () => new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
export function hours(h) {
  if (h == null || !isFinite(h)) return '—';
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m`;
  if (h < 48) return `${Math.round(h)}h`;
  return `${Math.round(h / 24)}d`;
}

// ---------- athlete imagery ----------
const LOCAL = { head: 'assets/angela1.webp', hero: 'assets/medals.jpg', action: 'assets/angela2.webp' };
export function photo(athlete, kind) {
  if (!athlete || String(athlete.id || '').startsWith('angela')) return LOCAL[kind];
  return kind === 'head' ? athlete.photoURL || LOCAL.head : athlete.heroURL || athlete.photoURL || LOCAL[kind];
}
export const ava = (athlete, size = 40) =>
  `<img class="ava" src="${esc(photo(athlete, 'head'))}" alt="" width="${size}" height="${size}" style="width:${size}px;height:${size}px">`;
export function initial(name, size = 40, color = 'var(--lav)') {
  const ch = (String(name || '?').trim()[0] || '?').toUpperCase();
  return `<span class="initial" style="width:${size}px;height:${size}px;background:${color};font-size:${Math.round(size * 0.42)}px" aria-hidden="true">${esc(ch)}</span>`;
}

// ---------- audio components (player.js keeps them in sync) ----------
function heights(seed, n) {
  let h = 5381;
  for (const ch of String(seed)) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0;
  return Array.from({ length: n }, (_, i) => {
    h = (Math.imul(h, 1103515245) + 12345) >>> 0;
    const noise = (h % 1000) / 1000;
    const env = 0.55 + 0.45 * Math.sin((i / Math.max(n - 1, 1)) * Math.PI);
    return Math.round(6 + 18 * noise * env);
  });
}
export const wave = (id, n = 28, cls = '') =>
  `<span class="wave ${cls}" data-wave="${esc(id)}" aria-hidden="true">${heights(id, n).map((h) => `<i style="height:${h}px"></i>`).join('')}</span>`;
export const playBtn = (item, cls = '') =>
  `<button class="play ${cls}" data-act="play" data-arg="${attr(item)}" data-play="${esc(item.id)}" aria-label="Play ${esc(item.title)}">${icon.play}</button>`;
export const disclose = (first) => `<span class="disclose">${icon.seal}Approved by ${esc(first)} · AI voice</span>`;

// ---------- feedback ----------
let toastTimer;
export function toast(text, kind = 'ok') {
  const host = document.getElementById('toasts');
  if (!host) return;
  clearTimeout(toastTimer);
  host.innerHTML = `<div class="toast ${kind === 'error' ? 'error' : ''}" role="status">${kind === 'error' ? icon.info : icon.check}<span>${esc(text)}</span></div>`;
  toastTimer = setTimeout(() => { host.innerHTML = ''; }, kind === 'error' ? 4200 : 2800);
}

/** Opens a modal sheet (bottom sheet on phones). Returns { el, close }. */
export function sheet(content, { onClose } = {}) {
  const veil = document.createElement('div');
  veil.className = 'veil';
  veil.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${content}</div>`;
  const close = () => {
    veil.remove();
    document.removeEventListener('keydown', onKey);
    onClose && onClose();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  veil.addEventListener('click', (e) => { if (e.target === veil || e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(veil);
  const first = veil.querySelector('textarea, input');
  if (first && matchMedia('(min-width: 700px)').matches) first.focus();
  return { el: veil, close };
}

export const spinner = () => '<span class="spin" aria-label="Loading"></span>';

export function emptyState(ico, title, text, action = '') {
  return `<div class="card empty"><span class="ico">${ico}</span><h2 style="color:var(--txt)">${esc(title)}</h2>
    <p class="muted small" style="margin:0;max-width:340px">${esc(text)}</p>${action}</div>`;
}

/** Busy state for a button while a promise runs; restores it afterwards. */
export async function busy(btn, fn) {
  if (!btn) return fn();
  const was = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = spinner();
  try { return await fn(); } finally { if (btn.isConnected) { btn.disabled = false; btn.innerHTML = was; } }
}
