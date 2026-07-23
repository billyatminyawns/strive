/* STRIVE — shared UI helpers. Everything renders as HTML strings. */
(function () {
  'use strict';

  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  // attribute-safe JSON for data-arg
  const arg = v => esc(JSON.stringify(v));

  const fmt = s => {
    s = Math.max(0, Math.round(s));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  };

  // deterministic waveform bar heights (same array as walkthrough/mockups)
  const HS = [0.42, 0.72, 0.5, 0.92, 0.6, 1, 0.46, 0.8, 0.55, 0.95, 0.5, 0.75, 0.4, 0.85, 0.62, 0.7];

  // waveform tied to a playable id — Player toggles .on via [data-wave-for]
  function wave(id, n, h, color, bw) {
    n = n || 16; h = h || 18; bw = bw || 3;
    const on = window.Player && Player.isPlaying(id);
    let bars = '';
    for (let i = 0; i < n; i++) {
      const hh = Math.max(3, Math.round(HS[i % 16] * h));
      bars += `<span style="width:${bw}px;height:${hh}px;${color ? `background:${color};` : ''}animation-delay:${(-i * 0.07).toFixed(2)}s"></span>`;
    }
    return `<div class="wave${on ? ' on' : ''}" ${id ? `data-wave-for="${esc(id)}"` : ''} style="height:${h}px">${bars}</div>`;
  }

  // play/pause round button for a playable
  function playBtn(p, size, iconSize) {
    size = size || 34; iconSize = iconSize || Math.round(size * 0.32);
    const on = window.Player && Player.isPlaying(p.id);
    return `<button class="playbtn" style="width:${size}px;height:${size}px"
      data-action="togglePlay" data-arg="${arg({ id: p.id })}" data-playbtn-for="${esc(p.id)}"
      aria-label="Play">${on ? icon.pause(iconSize) : icon.play(iconSize)}</button>`;
  }

  const icon = {
    play: (s = 11) => `<svg width="${s}" height="${s}" viewBox="0 0 14 14"><path d="M3.5 2l9 5-9 5z" fill="#0B0C0B"/></svg>`,
    pause: (s = 10) => `<svg width="${s}" height="${s}" viewBox="0 0 12 12"><rect x="2" y="1.5" width="3" height="9" rx="1" fill="#0B0C0B"/><rect x="7" y="1.5" width="3" height="9" rx="1" fill="#0B0C0B"/></svg>`,
    playMint: (s = 11) => `<svg width="${s}" height="${s}" viewBox="0 0 14 14"><path d="M3.5 2l9 5-9 5z" fill="var(--mint)"/></svg>`,
    back: `<svg width="9" height="16" viewBox="0 0 8 14"><path d="M7 1L1.5 7 7 13" stroke="#7C837D" stroke-width="1.8" fill="none"/></svg>`,
    send: `<svg width="14" height="14" viewBox="0 0 14 14"><path d="M2 7h9M8 3.5L11.5 7 8 10.5" stroke="#0B0C0B" stroke-width="1.8" fill="none"/></svg>`,
    search: (c = '#5C635D') => `<svg width="14" height="14" viewBox="0 0 14 14"><circle cx="6" cy="6" r="4.4" fill="none" stroke="${c}" stroke-width="1.6"/><path d="M9.4 9.4L13 13" stroke="${c}" stroke-width="1.6"/></svg>`,
    home: `<svg width="20" height="20" viewBox="0 0 20 20"><path d="M3 9.5L10 3l7 6.5V17h-5v-4h-4v4H3z" fill="currentColor"/></svg>`,
    discover: `<svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M13 7l-2 4-4 2 2-4z" fill="currentColor"/></svg>`,
    bars: `<svg width="18" height="14" viewBox="0 0 18 14"><rect x="1" y="5" width="2.4" height="4" rx="1.2" fill="#0B0C0B"/><rect x="5" y="2.5" width="2.4" height="9" rx="1.2" fill="#0B0C0B"/><rect x="9" y="0.5" width="2.4" height="13" rx="1.2" fill="#0B0C0B"/><rect x="13" y="3.5" width="2.4" height="7" rx="1.2" fill="#0B0C0B"/></svg>`,
    library: `<svg width="20" height="20" viewBox="0 0 20 20"><rect x="3" y="3" width="6" height="14" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="11" y="6" width="6" height="11" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`,
    you: `<svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="7" r="3.4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3.5 17c1-3.4 3.6-5 6.5-5s5.5 1.6 6.5 5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`,
    check: (c = '#0B0C0B', s = 12) => `<svg width="${s}" height="${Math.round(s * 0.85)}" viewBox="0 0 12 10"><path d="M1.5 5l3 3 6-7" stroke="${c}" stroke-width="2" fill="none"/></svg>`,
    mic: (c = '#0B0C0B', s = 22) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="12" rx="3" fill="${c}"/><path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21" stroke="${c}" stroke-width="2" fill="none"/></svg>`,
  };

  // monogram avatar
  function mono(txt, size, bg, fs) {
    size = size || 36; fs = fs || Math.round(size * 0.38);
    const cls = bg ? '' : ' ar';
    return `<div class="avatar${cls}" style="width:${size}px;height:${size}px;font-size:${fs}px;${bg ? `background:${bg};` : ''}">${esc(txt)}</div>`;
  }
  function ava(src, size) {
    size = size || 36;
    return `<div class="avatar" style="width:${size}px;height:${size}px"><img src="${esc(src)}" alt=""></div>`;
  }

  function toggle(on, action, argv) {
    return `<button class="tgl${on ? ' on' : ''}" data-action="${esc(action)}" data-arg="${arg(argv)}" role="switch" aria-checked="${!!on}"></button>`;
  }

  function slider(pct, action, argv) {
    return `<div class="slider" data-slider data-action-slide="${esc(action)}" data-arg="${arg(argv)}">
      <div class="fill" style="width:${pct}%"></div><div class="knob" style="left:${pct}%"></div></div>`;
  }

  // tier badge
  function tierBadge(tier) {
    const t = String(tier || '').toLowerCase();
    if (t === 'inner circle') return `<span style="font-size:9.5px;font-weight:900;letter-spacing:0.08em;color:var(--mint);border:1px solid var(--chip-line);border-radius:999px;padding:2px 7px;">INNER CIRCLE</span>`;
    if (t === 'all-access') return `<span style="font-size:9.5px;font-weight:800;color:var(--sub);border:1px solid var(--line2);border-radius:999px;padding:2px 7px;">ALL-ACCESS</span>`;
    return `<span style="font-size:9.5px;font-weight:800;color:var(--sub);border:1px solid var(--line2);border-radius:999px;padding:2px 7px;">ROOKIE</span>`;
  }

  window.UI = { esc, arg, fmt, wave, playBtn, icon, mono, ava, toggle, slider, tierBadge, HS };
})();
