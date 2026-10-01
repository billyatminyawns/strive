// One audio element for the whole app: fetches clips with the session token, keeps every play button,
// waveform and the mini player in sync, and wires lock-screen controls (Media Session).
import { api, message } from './api.js';
import { icon, clock, toast, photo } from './ui.js';
import { state } from './state.js';

const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
const audio = new Audio();
audio.preload = 'auto';
const urls = new Map(); // audioKey → object URL (clips are immutable)
const credited = new Set();
let current = null;     // { id, title, subtitle, key | url, transcript, dropId, duration }
let loading = false;
let token = 0;
let raf = 0;
let onCredit = () => {};
let onChange = () => {};

export const player = {
  get current() { return current; },
  get playing() { return !!current && !audio.paused && !loading; },
  get loading() { return loading; },
  get time() { return audio.currentTime || 0; },
  get duration() { return isFinite(audio.duration) && audio.duration > 0 ? audio.duration : current?.duration || 0; },
  isCurrent: (id) => current?.id === id,
  onCredit(fn) { onCredit = fn; },
  onChange(fn) { onChange = fn; },

  /** Call from a click handler: toggles the item if it's current, otherwise loads and plays it. */
  toggle(item) {
    if (current?.id === item.id && !loading) {
      audio.paused ? resume() : pause();
      return;
    }
    if (current?.id === item.id && loading) return;
    // Unlock playback inside the user gesture (iOS Safari blocks play() after an await otherwise).
    audio.src = SILENT;
    audio.play().catch(() => {});
    load(item);
  },
  pause, resume, stop,
  seek(t) { if (current && isFinite(audio.duration)) { audio.currentTime = Math.max(0, Math.min(t, audio.duration)); sync(); } },
  skip(d) { player.seek(audio.currentTime + d); },
};

async function load(item) {
  const mine = ++token;
  current = item;
  loading = true;
  sync();
  try {
    let src = item.url;
    if (!src) {
      src = urls.get(item.key);
      if (!src) {
        const blob = await api.audio(item.key);
        src = URL.createObjectURL(blob);
        urls.set(item.key, src);
      }
    }
    if (mine !== token) return;
    audio.src = src;
    await audio.play();
    loading = false;
    setSession();
    tick();
  } catch (e) {
    if (mine !== token) return;
    loading = false;
    current = null;
    sync();
    toast(e && e.name === 'NotAllowedError' ? 'Tap play again to listen.' : `Couldn't play that clip — ${message(e)}`, 'error');
  }
}

function pause() { audio.pause(); sync(); }
function resume() { if (current) audio.play().then(tick).catch(() => {}); sync(); }
function stop() {
  token++;
  audio.pause();
  current = null;
  loading = false;
  cancelAnimationFrame(raf);
  if ('mediaSession' in navigator) navigator.mediaSession.metadata = null;
  sync();
}

function tick() {
  cancelAnimationFrame(raf);
  const step = () => {
    syncProgress();
    credit();
    if (current && !audio.paused) raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  sync();
}

function credit(force) {
  const id = current?.dropId;
  if (!id || credited.has(id)) return;
  const d = player.duration;
  if (force || (d > 0 && audio.currentTime / d >= 0.6)) {
    credited.add(id);
    onCredit(id);
  }
}

audio.addEventListener('ended', () => { credit(true); sync(); });
audio.addEventListener('pause', () => sync());
audio.addEventListener('play', () => sync());
audio.addEventListener('loadedmetadata', () => syncProgress());

/** Updates every play button / waveform / time label on the page for the current clip. */
export function sync() {
  document.querySelectorAll('[data-play]').forEach((b) => {
    const isCur = current?.id === b.dataset.play;
    const isLoading = isCur && loading;
    const isPlaying = isCur && !loading && !audio.paused;
    b.innerHTML = isLoading ? '<span class="spin"></span>' : isPlaying ? icon.pause : icon.play;
    b.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
  });
  syncProgress();
  onChange();
}

function syncProgress() {
  const d = player.duration;
  const p = current && d > 0 ? Math.min(1, audio.currentTime / d) : 0;
  document.querySelectorAll('[data-wave]').forEach((w) => {
    const on = current?.id === w.dataset.wave ? p : 0;
    const bars = w.children;
    const lit = Math.round(on * bars.length);
    for (let i = 0; i < bars.length; i++) bars[i].classList.toggle('on', i < lit);
  });
  document.querySelectorAll('[data-time]').forEach((t) => {
    if (current?.id === t.dataset.time) t.textContent = `${clock(audio.currentTime)} / ${clock(d)}`;
    else if (t.dataset.dur !== undefined) t.textContent = clock(Number(t.dataset.dur));
  });
  const bar = document.querySelector('.player .bar');
  if (bar) bar.style.width = `${p * 100}%`;
  const mini = document.querySelector('.player [data-mini-time]');
  if (mini) mini.textContent = `${clock(audio.currentTime)} / ${clock(d)}`;
}

function setSession() {
  if (!('mediaSession' in navigator) || !current) return;
  const art = new URL(photo(state.athlete, 'head'), location.href).href;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: current.title, artist: current.subtitle || 'Strive', album: 'Strive', artwork: [{ src: art, sizes: '512x512' }],
  });
  const ms = navigator.mediaSession;
  ms.setActionHandler('play', () => resume());
  ms.setActionHandler('pause', () => pause());
  ms.setActionHandler('seekbackward', () => player.skip(-15));
  ms.setActionHandler('seekforward', () => player.skip(15));
  try { ms.setActionHandler('seekto', (e) => player.seek(e.seekTime)); } catch {}
}

window.addEventListener('strive:signout', () => {
  stop();
  urls.forEach((u) => URL.revokeObjectURL(u));
  urls.clear();
  credited.clear();
});

// ---------- playable builders ----------
export function dropItem(drop, athlete) {
  if (!drop.audioKey) return null;
  return { id: 'drop:' + drop.id, title: drop.title, subtitle: athlete?.name || 'Strive', key: drop.audioKey,
    transcript: drop.script, duration: drop.duration, dropId: drop.status === 'published' ? drop.id : null };
}
export function replyItem(q, athlete) {
  if (!q.audioKey) return null;
  return { id: 'reply:' + q.id, title: q.text, subtitle: `${athlete?.firstName || 'Angela'}'s reply`, key: q.audioKey, transcript: q.answer, duration: q.duration };
}
export function bioItem(athlete) {
  const b = athlete?.bio;
  if (!b?.audioKey) return null;
  return { id: 'bio:' + athlete.id, title: `Who is ${athlete.firstName}`, subtitle: 'In her own voice', key: b.audioKey, transcript: b.text, duration: b.duration };
}
