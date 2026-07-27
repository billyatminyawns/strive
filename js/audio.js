/* STRIVE — voice playback.
   Two engines behind one Player API:
   1. Real WellSaid Studio audio (assets/vo/*, looked up by exact text via window.VO) — real
      duration, real pause/resume, real ±15s seeking.
   2. On-device speechSynthesis fallback for live-typed content the demo can't pre-render.
   One thing plays at a time. UI hooks: [data-wave-for], [data-playbtn-for], [data-prog-for],
   [data-time-for], [data-dur-for]. */
(function () {
  'use strict';

  const P = {
    id: null, playing: false, t: 0, dur: 0, text: '', engine: null, // 'audio' | 'tts'
    _utter: null, _timer: null, _onEnd: null, _audio: null,
  };

  /* ---------- shared ---------- */

  function pickVoice() {
    const voices = window.speechSynthesis ? speechSynthesis.getVoices() : [];
    if (!voices.length) return null;
    const en = voices.filter(v => /^en/i.test(v.lang));
    const prefer = ['Samantha', 'Ava', 'Allison', 'Susan', 'Victoria', 'Karen', 'Google US English', 'Zira'];
    for (const name of prefer) {
      const v = en.find(v => v.name.includes(name));
      if (v) return v;
    }
    return en.find(v => /female/i.test(v.name)) || en[0] || voices[0];
  }
  if (window.speechSynthesis) {
    speechSynthesis.onvoiceschanged = () => {};
    speechSynthesis.getVoices();
  }

  function estimate(text, rate) {
    const words = String(text || '').trim().split(/\s+/).length;
    return Math.max(4, (words / (2.6 * (rate || 1))));
  }

  function delivery() {
    const d = (window.Store && Store.get().delivery) || { warmth: 70, energy: 55, pace: 45 };
    return {
      rate: 0.82 + (d.pace / 100) * 0.45,
      pitch: 0.92 + (d.warmth / 100) * 0.22,
      volume: 0.75 + (d.energy / 100) * 0.25,
    };
  }

  function clearTimer() { if (P._timer) { clearInterval(P._timer); P._timer = null; } }

  function updateDom() {
    document.querySelectorAll('[data-wave-for]').forEach(el => {
      el.classList.toggle('on', P.playing && el.dataset.waveFor === P.id);
    });
    document.querySelectorAll('[data-playbtn-for]').forEach(el => {
      const on = P.playing && el.dataset.playbtnFor === P.id;
      el.innerHTML = on ? UI.icon.pause(Math.round(el.offsetWidth * 0.3)) : UI.icon.play(Math.round(el.offsetWidth * 0.33));
    });
    document.querySelectorAll('[data-prog-for]').forEach(el => {
      if (el.dataset.progFor === P.id && P.dur) el.style.width = Math.min(100, (P.t / P.dur) * 100) + '%';
    });
    document.querySelectorAll('[data-time-for]').forEach(el => {
      if (el.dataset.timeFor === P.id) el.textContent = UI.fmt(P.t);
    });
    document.querySelectorAll('[data-dur-for]').forEach(el => {
      if (el.dataset.durFor === P.id && P.dur) el.textContent = UI.fmt(P.dur);
    });
  }

  function teardownAudio() {
    if (P._audio) {
      try { P._audio.pause(); } catch (e) {}
      P._audio.onended = null; P._audio.ontimeupdate = null; P._audio.onloadedmetadata = null; P._audio.onerror = null;
      P._audio = null;
    }
  }

  function finish() {
    clearTimer();
    teardownAudio();
    const wasId = P.id;
    P.playing = false; P.t = 0; P.engine = null;
    if (window.speechSynthesis) try { speechSynthesis.cancel(); } catch (e) {}
    const cb = P._onEnd; P._onEnd = null;
    updateDom();
    if (cb) cb(wasId);
    if (window.App) App.render();
  }

  /* ---------- engine: real audio file ---------- */

  function startAudio(src, text) {
    const a = new Audio(src);
    P._audio = a; P.engine = 'audio';
    P.dur = estimate(text, 1); // provisional until metadata arrives
    P.t = 0; P.playing = true;
    a.onloadedmetadata = () => { if (isFinite(a.duration) && a.duration > 0) { P.dur = a.duration; updateDom(); } };
    a.ontimeupdate = () => { P.t = a.currentTime; updateDom(); };
    a.onended = () => { if (P._audio === a) finish(); };
    a.onerror = () => { // file missing/corrupt → fall back to TTS transparently
      if (P._audio !== a) return;
      teardownAudio();
      startTts(text);
    };
    a.play().catch(() => { /* autoplay block → user will tap again */ });
  }

  /* ---------- engine: speechSynthesis ---------- */

  function ttsTick() {
    clearTimer();
    P._timer = setInterval(() => {
      if (!P.playing) return;
      P.t += 0.2;
      if (P.t >= P.dur + 1.5) { finish(); return; }
      updateDom();
    }, 200);
  }

  function startTts(text) {
    const d = delivery();
    P.engine = 'tts';
    P.dur = estimate(text, d.rate);
    P.t = 0; P.playing = true;
    if (window.speechSynthesis) {
      try {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        const v = pickVoice();
        if (v) u.voice = v;
        u.rate = d.rate; u.pitch = d.pitch; u.volume = d.volume;
        u.onend = () => { if (P.playing && P._utter === u) finish(); };
        P._utter = u;
        speechSynthesis.speak(u);
      } catch (e) { /* silent visual playback */ }
    }
    ttsTick();
  }

  /* ---------- public API ---------- */

  // pre-rendered VO file, or a runtime WellSaid render stashed by js/api.js
  function srcForText(text) {
    if (!window.VO) return null;
    return VO.srcFor(text) || (window.RuntimeVO && RuntimeVO[VO.key(text)]) || null;
  }

  window.Player = {
    get state() { return P; },
    isPlaying(id) { return P.playing && P.id === id; },
    estimate,
    isReal(text) { return !!srcForText(text); },

    /* toggle({id, text, onEnd}) — play, pause, or resume */
    toggle(p) {
      if (P.id === p.id && P.playing) {                 // pause
        P.playing = false;
        if (P.engine === 'audio' && P._audio) { try { P._audio.pause(); } catch (e) {} }
        else if (window.speechSynthesis) try { speechSynthesis.pause(); } catch (e) {}
        clearTimer();
        updateDom(); if (window.App) App.render();
        return;
      }
      if (P.id === p.id && !P.playing && P.t > 0) {     // resume
        P.playing = true;
        if (P.engine === 'audio' && P._audio) { P._audio.play().catch(() => {}); }
        else {
          if (window.speechSynthesis) try { speechSynthesis.resume(); } catch (e) {}
          ttsTick();
        }
        updateDom(); if (window.App) App.render();
        return;
      }
      // new playable — stop whatever is active, then choose engine by text
      clearTimer(); teardownAudio();
      if (window.speechSynthesis) try { speechSynthesis.cancel(); } catch (e) {}
      P.id = p.id; P.text = p.text; P._onEnd = p.onEnd || null;
      const src = srcForText(p.text);
      if (src) startAudio(src, p.text); else startTts(p.text);
      if (window.App) App.render();
    },

    seek(delta) {
      if (!P.id) return;
      if (P.engine === 'audio' && P._audio) {
        try {
          P._audio.currentTime = Math.max(0, Math.min(P.dur || P._audio.duration || 0, P._audio.currentTime + delta));
          P.t = P._audio.currentTime;
        } catch (e) {}
      } else {
        P.t = Math.max(0, Math.min(P.dur, P.t + delta)); // TTS can't seek — visual only
      }
      updateDom();
    },

    stop() { P.id = null; finish(); },
  };

  window.addEventListener('beforeunload', () => {
    if (window.speechSynthesis) try { speechSynthesis.cancel(); } catch (e) {}
  });
})();
