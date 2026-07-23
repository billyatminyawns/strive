/* STRIVE — voice playback. speechSynthesis stands in for the WellSaid Studio voice in this demo.
   One thing plays at a time. Progress is timer-driven against an estimated duration so the UI
   stays smooth even when synthesis is unavailable (then playback is silent but visible). */
(function () {
  'use strict';

  const P = {
    id: null, playing: false, t: 0, dur: 0, text: '',
    _utter: null, _timer: null, _onEnd: null,
  };

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
    speechSynthesis.onvoiceschanged = () => {}; // warm the voice list
    speechSynthesis.getVoices();
  }

  function estimate(text, rate) {
    const words = String(text || '').trim().split(/\s+/).length;
    return Math.max(4, (words / (2.6 * (rate || 1))));
  }

  function delivery() {
    const d = (window.Store && Store.get().delivery) || { warmth: 70, energy: 55, pace: 45 };
    return {
      rate: 0.82 + (d.pace / 100) * 0.45,       // 45 → ~1.02
      pitch: 0.92 + (d.warmth / 100) * 0.22,     // 70 → ~1.07
      volume: 0.75 + (d.energy / 100) * 0.25,
    };
  }

  function clearTimer() { if (P._timer) { clearInterval(P._timer); P._timer = null; } }

  function updateDom() {
    // patch live elements without a full re-render
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

  function finish() {
    clearTimer();
    const wasId = P.id;
    P.playing = false; P.t = 0;
    if (window.speechSynthesis) try { speechSynthesis.cancel(); } catch (e) {}
    const cb = P._onEnd; P._onEnd = null;
    updateDom();
    if (cb) cb(wasId);
    if (window.App) App.render();
  }

  function start(text) {
    const d = delivery();
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
      } catch (e) { /* silent playback */ }
    }
    clearTimer();
    P._timer = setInterval(() => {
      if (!P.playing) return;
      P.t += 0.2;
      if (P.t >= P.dur + 1.5) { finish(); return; }  // grace if onend never fires
      updateDom();
    }, 200);
  }

  window.Player = {
    get state() { return P; },
    isPlaying(id) { return P.playing && P.id === id; },
    estimate,
    /* toggle({id, text, onEnd}) — play, pause, or resume */
    toggle(p) {
      if (P.id === p.id && P.playing) {           // pause
        P.playing = false;
        if (window.speechSynthesis) try { speechSynthesis.pause(); } catch (e) {}
        updateDom(); if (window.App) App.render();
        return;
      }
      if (P.id === p.id && !P.playing && P.t > 0) { // resume
        P.playing = true;
        if (window.speechSynthesis) try { speechSynthesis.resume(); } catch (e) {}
        clearTimer();
        P._timer = setInterval(() => {
          if (!P.playing) return;
          P.t += 0.2;
          if (P.t >= P.dur + 1.5) { finish(); return; }
          updateDom();
        }, 200);
        updateDom(); if (window.App) App.render();
        return;
      }
      // new playable
      P.id = p.id; P.text = p.text; P._onEnd = p.onEnd || null;
      start(p.text);
      if (window.App) App.render();
    },
    seek(delta) {
      if (!P.id) return;
      P.t = Math.max(0, Math.min(P.dur, P.t + delta));
      updateDom();
      // speechSynthesis can't seek — visual seek only, which is fine for the demo
    },
    stop() { P.id = null; finish(); },
  };

  // stop speech when leaving the page
  window.addEventListener('beforeunload', () => {
    if (window.speechSynthesis) try { speechSynthesis.cancel(); } catch (e) {}
  });
})();
