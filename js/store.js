/* STRIVE — tiny persisted store. One state object shared by fan app + studio. */
(function () {
  'use strict';
  const KEY = 'strive-demo-v1';
  let state = null;

  function deepMerge(seed, saved) {
    // saved wins; seed fills gaps (lets us evolve the schema without nuking demos)
    if (Array.isArray(seed) || Array.isArray(saved)) return saved !== undefined ? saved : seed;
    if (typeof seed === 'object' && seed && typeof saved === 'object' && saved) {
      const out = {};
      for (const k of new Set([...Object.keys(seed), ...Object.keys(saved)])) {
        out[k] = k in saved ? deepMerge(seed[k], saved[k]) : seed[k];
      }
      return out;
    }
    return saved !== undefined ? saved : seed;
  }

  function load() {
    const seed = window.Data.seed();
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && saved.__v === seed.__v) return deepMerge(seed, saved);
      }
    } catch (e) { /* corrupted → reseed */ }
    return seed;
  }

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* private mode etc. */ }
  }

  window.Store = {
    get() { if (!state) state = load(); return state; },
    // mutate + persist + re-render
    set(fn) {
      if (!state) state = load();
      if (typeof fn === 'function') fn(state); else Object.assign(state, fn);
      persist();
      if (window.App) App.render();
    },
    // mutate + persist, no re-render (for high-frequency updates)
    silent(fn) {
      if (!state) state = load();
      if (typeof fn === 'function') fn(state); else Object.assign(state, fn);
      persist();
    },
    reset() {
      try { localStorage.removeItem(KEY); } catch (e) {}
      state = window.Data.seed();
      persist();
      if (window.Player) Player.stop();
      if (window.App) { location.hash = '#/'; App.render(); }
    },
  };
})();
