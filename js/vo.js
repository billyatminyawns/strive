/* STRIVE — real WellSaid voice registry.
   Seeded scripts were pre-rendered with WellSaid Studio (voice: Vanessa N. · Conversational).
   Playback looks up the exact spoken text by hash; anything not pre-rendered (live-typed asks,
   new drops) falls back to on-device speech in audio.js. */
(function () {
  'use strict';

  // djb2 over normalized text — MUST match the generator that produced assets/vo/*
  function key(text) {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    let h = 5381;
    for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }

  const KEYS = [
    'e06ora',  // drop-1 Morning skate mindset
    'lqryzn',  // drop-2 Road trip Q&A
    '4u0z9c',  // drop-3 Gold medal morning
    '14o8n5f', // kb-reset
    '1jcogz6', // kb-nerves
    '114pia2', // kb-gap
    '1ajsn0r', // kb-routine
    'lg57h',   // guardrail decline
    '1kn9xb6', // draft q-marcus
    '10ole5l', // draft q-priya
    '1gg6rma', // draft q-dev
    'xpwzy7',  // draft q-lena
    'axnv6t',  // voice studio sample line
    '14ensqe', '73jcju', '16hnm7k', '1d40o7y', '1m9bgl8', '1g3l7om', // lesson intros l1–l6
    '10urfhl', // kb-ioc (what have you done since hockey)
    'pz25xh',  // AMA opening
    'eoilho',  // AMA answer 1 (never-skip drill)
    '1qo0m41', // AMA answer 2 (welcome-to-the-Olympics)
  ];
  const map = {};
  KEYS.forEach(k => { map[k] = 'assets/vo/vo-' + k + '.mp3'; });

  window.VO = {
    key,
    srcFor(text) { return map[key(text)] || null; },
  };
})();
