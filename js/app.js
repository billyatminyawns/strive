/* STRIVE — shell: router, frames (iPhone / browser), landing, event delegation, scaling. */
(function () {
  'use strict';
  const { esc, arg, icon } = UI;

  /* ---------- routing ---------- */
  function route() {
    const h = (location.hash || '#/').replace(/^#/, '');
    const parts = h.split('/').filter(Boolean);      // e.g. ['fan','lesson','l4']
    if (!parts.length) return { view: 'landing', key: null, params: [] };
    if (parts[0] === 'fan') {
      const s = Store.get();
      let screen = parts[1] || 'home';
      if (!s.unlocked) screen = 'invite';
      return { view: 'fan', key: 'fan/' + screen, params: parts.slice(2) };
    }
    if (parts[0] === 'studio') return { view: 'studio', key: 'studio/' + (parts[1] || 'overview'), params: parts.slice(2) };
    if (parts[0] === 'athlete') return { view: 'athlete', key: 'athlete/' + (parts[1] || 'home'), params: parts.slice(2) };
    return { view: 'landing', key: null, params: [] };
  }

  /* ---------- fan chrome ---------- */
  const FAN_TABS = [
    { id: 'home', label: 'Home', ic: icon.home },
    { id: 'discover', label: 'Discover', ic: icon.discover },
    { id: 'ask', label: 'Ask', ask: true },
    { id: 'library', label: 'Library', ic: icon.library },
    { id: 'you', label: 'You', ic: icon.you },
  ];

  function tabbar(active) {
    const s = Store.get();
    return `<div class="tabbar">${FAN_TABS.map(t => {
      if (t.ask) {
        return `<button class="ask-tab" data-action="nav" data-arg="${arg('#/fan/ask')}">
          <div class="orb" style="position:relative">${icon.bars}
            ${s.fan.unread ? `<span class="dot" style="position:absolute;top:0;right:0;width:10px;height:10px;border-radius:50%;background:var(--papaya);border:2px solid #0B0C0B"></span>` : ''}
          </div><span>Ask</span></button>`;
      }
      return `<button class="tab${active === t.id ? ' on' : ''}" data-action="nav" data-arg="${arg('#/fan/' + t.id)}">
        <div style="position:relative">${t.ic}</div><span>${t.label}</span></button>`;
    }).join('')}</div>`;
  }

  /* ---------- athlete chrome (Angela's pocket studio) ---------- */
  const ATH_TABS = [
    { id: 'home', label: 'Today', ic: icon.home },
    { id: 'approve', label: 'Approve' },
    { id: 'capture', label: 'Capture', orb: true },
    { id: 'studio', label: 'Studio' },
    { id: 'profile', label: 'You' },
  ];

  const approveIcon = `<svg width="20" height="20" viewBox="0 0 20 20"><rect x="3" y="4" width="14" height="12" rx="3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M6.5 10l2.4 2.4L13.5 7.6" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>`;
  const studioIcon = `<svg width="20" height="20" viewBox="0 0 20 20"><rect x="3" y="11" width="3" height="6" rx="1" fill="currentColor"/><rect x="8.5" y="7" width="3" height="10" rx="1" fill="currentColor"/><rect x="14" y="3" width="3" height="14" rx="1" fill="currentColor"/></svg>`;

  function athleteTabbar(active) {
    const s = Store.get();
    const waiting = s.inbox.filter(q => q.status === 'draft').length;
    return `<div class="tabbar">${ATH_TABS.map(t => {
      if (t.orb) {
        return `<button class="ask-tab" data-action="nav" data-arg="${arg('#/athlete/capture')}">
          <div class="orb" style="${active === t.id ? '' : 'background:#2E3A31'}">${icon.mic(active === t.id ? 'var(--ink)' : 'var(--mint)', 20)}</div>
          <span style="color:${active === t.id ? 'var(--mint)' : 'var(--dim)'}">${t.label}</span></button>`;
      }
      const ic = t.id === 'approve' ? approveIcon : t.id === 'studio' ? studioIcon : t.id === 'profile' ? icon.you : t.ic;
      return `<button class="tab${active === t.id ? ' on' : ''}" data-action="nav" data-arg="${arg('#/athlete/' + t.id)}">
        <div style="position:relative">${ic}
          ${t.id === 'approve' && waiting ? `<span class="dot" style="width:15px;height:15px;border-radius:8px;top:-5px;right:-8px;display:flex;align-items:center;justify-content:center;font-size:8.5px;font-weight:900;color:#141614">${waiting}</span>` : ''}
        </div><span>${t.label}</span></button>`;
    }).join('')}</div>`;
  }

  /* persistent now-playing bar (fan + athlete phone frames, above the tab bar) */
  function miniPlayer(activeScreenKey) {
    const P = window.Player && Player.state;
    if (!P || !P.id || (!P.playing && P.t <= 0)) return '';
    if (activeScreenKey === 'fan/reply') return '';   // full-screen player owns that view
    const title = P.title || 'Now playing';
    return `<div style="display:flex;align-items:center;gap:10px;background:#151915;border-top:1px solid var(--line2);padding:8px 14px;flex-shrink:0;position:relative;z-index:41">
      ${UI.ava(Data.IMG.head, 30)}
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(title)}</div>
        <div style="font-size:10px;color:var(--dim2)"><span data-time-for="${esc(P.id)}">${UI.fmt(P.t)}</span> / <span data-dur-for="${esc(P.id)}">${UI.fmt(P.dur)}</span> · Angela Ruggiero</div>
      </div>
      ${UI.wave(P.id, 8, 14, null, 3)}
      ${UI.playBtn({ id: P.id }, 32)}
      <button data-action="stopPlayback" aria-label="Close player"
        style="width:26px;height:26px;border:none;background:none;color:var(--dim);font-size:14px;display:flex;align-items:center;justify-content:center">✕</button>
    </div>`;
  }

  function statusbar() {
    return `<div class="statusbar"><span class="time">9:41</span>
      <span class="icons">
        <svg width="17" height="11" viewBox="0 0 17 11"><rect x="0" y="6" width="3" height="5" rx="1" fill="#F3F5F3"/><rect x="4.5" y="4" width="3" height="7" rx="1" fill="#F3F5F3"/><rect x="9" y="2" width="3" height="9" rx="1" fill="#F3F5F3"/><rect x="13.5" y="0" width="3" height="11" rx="1" fill="#F3F5F3" opacity="0.35"/></svg>
        <svg width="16" height="11" viewBox="0 0 16 11"><path d="M8 9.5a1.3 1.3 0 100 .01zM5.2 7.3a4 4 0 015.6 0l-1.2 1.2a2.3 2.3 0 00-3.2 0zM2.4 4.9a8 8 0 0111.2 0l-1.2 1.2a6.3 6.3 0 00-8.8 0z" fill="#F3F5F3"/></svg>
        <svg width="25" height="12" viewBox="0 0 25 12"><rect x="0.5" y="0.5" width="21" height="11" rx="3.5" fill="none" stroke="#F3F5F3" opacity="0.5"/><rect x="2" y="2" width="15" height="8" rx="2" fill="#F3F5F3"/><path d="M23 4v4a2.2 2.2 0 000-4z" fill="#F3F5F3" opacity="0.5"/></svg>
      </span></div>`;
  }

  function phoneFrame(inner, opts) {
    opts = opts || {};
    return `<div class="stage"><div class="frame-scaler" data-fit="402,900">
      <div class="phone">
        <div class="phone-screen">${inner}</div>
        <div class="island"></div>
        ${opts.noStatus ? '' : statusbar()}
        <div class="homebar"></div>
      </div>
    </div></div>`;
  }

  /* ---------- studio chrome ---------- */
  const STUDIO_NAV = [
    { id: 'overview', label: 'Overview' },
    { id: 'inbox', label: 'Inbox', badge: s => s.inbox.filter(q => q.status === 'draft').length + s.inboxExtra },
    { id: 'content', label: 'Content' },
    { id: 'voice', label: 'Voice Studio' },
    { id: 'audience', label: 'Audience' },
    { id: 'earnings', label: 'Earnings' },
  ];

  function sidebar(active) {
    const s = Store.get();
    return `<div class="sidebar">
      <div class="logo"><span class="word">STRIVE</span><span class="sq"></span><span class="tag">STUDIO</span></div>
      <nav>${STUDIO_NAV.map(n => `
        <button class="${active === n.id ? 'on' : ''}" data-action="nav" data-arg="${arg('#/studio/' + n.id)}">
          <span class="lbl">${n.label}</span>
          ${n.badge ? `<span class="badge">${n.badge(s)}</span>` : ''}
        </button>`).join('')}</nav>
      <div class="who">${UI.ava(Data.IMG.head, 32)}
        <div><div style="font-size:12.5px;font-weight:700">Angela Ruggiero</div>
        <div style="font-size:10.5px;color:var(--faint)">View public profile</div></div></div>
    </div>`;
  }

  function browserFrame(inner, url, active) {
    return `<div class="stage"><div class="frame-scaler" data-fit="1280,880">
      <div class="browser">
        <div class="b-top">
          <div class="lights"><span style="background:#FF5F57"></span><span style="background:#FEBC2E"></span><span style="background:#28C840"></span></div>
          <div class="b-tab"><span class="fav"></span>Strive Studio</div>
        </div>
        <div class="b-url"><div class="field">
          <svg width="10" height="12" viewBox="0 0 10 12"><rect x="1" y="5" width="8" height="6" rx="1.5" fill="none" stroke="#5C635D" stroke-width="1.4"/><path d="M3 5V3.5a2 2 0 014 0V5" fill="none" stroke="#5C635D" stroke-width="1.4"/></svg>
          studio.strive.app/${esc(url)}</div></div>
        <div class="b-content">${sidebar(active)}<div class="studio-main scroll">${inner}</div></div>
      </div>
    </div></div>`;
  }

  /* ---------- landing ---------- */
  function landing() {
    return `<div class="landing">
      <div class="wordmark fadeup"><span class="word">STRIVE</span><span class="sq"></span></div>
      <div class="tagline fadeup" style="animation-delay:0.08s">Train with the greatest. Talk with them, too.</div>
      <div class="blurb fadeup" style="animation-delay:0.16s">A membership platform where fans train with elite athletes —
        masterclass-grade lessons, daily audio drops, and questions answered back in the athlete's real voice,
        generated from words the athlete wrote or approved. Pilot athlete: Angela Ruggiero — 4× Olympian,
        gold medalist, Hockey Hall of Fame.</div>
      <div class="doors">
        <button class="door fadeup" style="animation-delay:0.24s" data-action="nav" data-arg="${arg('#/fan/home')}">
          <span class="k">FAN EXPERIENCE · iOS</span>
          <span class="t">The membership app</span>
          <span class="d">Fans train, listen, and ask. Every reply comes back in Angela's voice — not a chatbot, her approved answers, spoken.</span>
          <span class="go btn btn-mint">Open the fan app</span>
        </button>
        <div class="door fadeup" style="animation-delay:0.32s;width:340px;cursor:default">
          <span class="k" style="color:var(--lav)">ATHLETE STUDIO · YOU'RE IN CONTROL</span>
          <span class="t">Where Angela runs it</span>
          <span class="d">One studio, two ways in. Approve every reply before it ships, capture stories in your voice, tune the delivery — nothing goes out without you. One hour a week, content at scale.</span>
          <span style="display:flex;gap:10px;margin-top:10px">
            <button class="btn btn-mint" data-action="nav" data-arg="${arg('#/athlete/home')}">App experience</button>
            <button class="btn btn-mint-line" data-action="nav" data-arg="${arg('#/studio/overview')}">Desktop experience</button>
          </span>
        </div>
      </div>
      <div style="display:flex;gap:12px;align-items:center;margin-top:38px" class="fadeup">
        <span class="pill" style="border:1px solid var(--chip-line);color:var(--mint);padding:8px 16px;font-size:11px;letter-spacing:0.12em;font-weight:800">
          <span style="width:7px;height:7px;border-radius:50%;background:var(--mint)"></span>AI VOICE POWERED BY WELLSAID</span>
        <span style="font-size:12px;color:var(--dim)">All stats and content illustrative.</span>
      </div>
      <div style="font-size:11px;color:#3E443F;margin-top:16px">Tip: ask a question in the fan app, then swipe to approve it in the athlete app — the loop is live.</div>
      ${window.__installPrompt ? `<button class="btn btn-mint-line fadeup" style="margin-top:18px" data-action="installApp">⤓ Install STRIVE as an app</button>` : ''}
    </div>`;
  }

  /* ---------- live API settings modal ---------- */
  function settingsModal(s) {
    const api = window.Api;
    const workerState = !api || !api.enabled ? ['off', 'NOT CONFIGURED']
      : api.workerOk === null ? ['', 'CHECKING…']
      : api.workerOk ? ['on', 'ONLINE'] : ['off', 'UNREACHABLE'];
    const hasKey = !!(api && api.byokKey);
    return `<div class="modal-back" data-action="settingsToggle">
      <div class="modal" data-action="noop">
        <h3>Live demo intelligence</h3>

        <div style="display:flex;flex-direction:column;gap:8px">
          <div class="row" style="justify-content:space-between">
            <div>
              <div style="font-size:13px;font-weight:700">Backend API <span style="color:var(--faint);font-weight:600">· Cloudflare Worker</span></div>
              <div style="font-size:11.5px;color:var(--sub);margin-top:2px">Claude drafts new replies · WellSaid renders new voice lines. Keys stay server-side.</div>
            </div>
            <span class="status-chip ${workerState[0]}">${workerState[1]}</span>
          </div>
        </div>

        <div style="border-top:1px solid var(--line);padding-top:14px;display:flex;flex-direction:column;gap:10px">
          <div>
            <div style="font-size:13px;font-weight:700">Backup: your own Anthropic key <span style="color:var(--faint);font-weight:600">· browser-only</span></div>
            <div style="font-size:11.5px;color:var(--sub);margin-top:2px;line-height:1.5">Used for drafts when the backend can't. Stored only in <b>this browser's</b> localStorage and sent only to api.anthropic.com — use your own key on your own machine.</div>
          </div>
          <div class="row">
            <input type="password" class="field-rect" style="flex:1;min-width:0" id="byok-input" data-keep="byok-input"
              data-enter-action="byokSave" placeholder="${hasKey ? '•••••••••••• key saved' : 'sk-ant-…'}" autocomplete="off">
            <button class="btn btn-mint" style="padding:10px 14px;flex-shrink:0" data-action="byokSave">Save</button>
            ${hasKey ? `<button class="btn btn-ghost" style="padding:10px 12px;flex-shrink:0" data-action="byokClear">Clear</button>` : ''}
          </div>
          <div style="font-size:11px;color:var(--faint);line-height:1.5">Drafts use Claude Opus 4.8. Voice for brand-new lines still needs the backend; without it they play in on-device speech. Pre-recorded WellSaid audio always works.</div>
        </div>

        <div style="border-top:1px solid var(--line);padding-top:12px;display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:11px;color:var(--dim)">No live path? The demo falls back to canned drafts — nothing breaks.</span>
          <button class="btn btn-ghost" style="padding:9px 16px" data-action="settingsToggle">Close</button>
        </div>
      </div>
    </div>`;
  }

  /* ---------- render ---------- */
  const App = {
    render() {
      const r = route();
      const rootEl = document.getElementById('app');
      const s = Store.get();

      // preserve focus/caret across re-render
      const ae = document.activeElement;
      const keep = ae && ae.dataset && ae.dataset.keep ? { id: ae.dataset.keep, value: ae.value, pos: ae.selectionStart } : null;

      let inner = '';
      if (r.view === 'landing') inner = landing();
      else {
        const screen = window.Screens[r.key];
        if (!screen) inner = `<div class="landing"><div style="color:var(--sub)">Screen not found: ${esc(r.key)}</div></div>`;
        else if (r.view === 'fan') {
          const body = screen.render(s, r.params);
          const chrome = screen.noTabbar ? body : body + miniPlayer(r.key) + tabbar(screen.tab || '');
          inner = phoneFrame(`<div class="p-body">${chrome}</div>`, screen);
        } else if (r.view === 'athlete') {
          const body = screen.render(s, r.params);
          const chrome = screen.noTabbar ? body : body + miniPlayer(r.key) + athleteTabbar(screen.tab || '');
          inner = phoneFrame(`<div class="p-body">${chrome}</div>`, screen);
        } else {
          const sub = r.key.split('/')[1];
          const active = sub === 'scan' ? 'voice' : sub;   // scan is reached from Voice Studio
          inner = browserFrame(screen.render(s, r.params), screen.url || sub, active);
        }
      }

      rootEl.innerHTML = `
        <div class="topbar">
          <div class="brand" data-action="nav" data-arg="${arg('#/')}"><span class="word">STRIVE</span><span class="sq"></span></div>
          <div class="views">
            <button class="${r.view === 'landing' ? 'on' : ''}" data-action="nav" data-arg="${arg('#/')}">Concept</button>
            <button class="${r.view === 'fan' ? 'on' : ''}" data-action="nav" data-arg="${arg('#/fan/home')}">Fan app</button>
            <button class="${r.view === 'athlete' ? 'on' : ''}" data-action="nav" data-arg="${arg('#/athlete/home')}">Athlete</button>
            <button class="${r.view === 'studio' ? 'on' : ''}" data-action="nav" data-arg="${arg('#/studio/overview')}">Studio</button>
          </div>
          <div class="spacer"></div>
          <span class="note">Voice by WellSaid Studio · drafts by Claude</span>
          <button class="reset" data-action="settingsToggle">Live API</button>
          <button class="reset" data-action="resetDemo">Reset demo</button>
        </div>
        ${inner}
        ${s.settingsOpen ? settingsModal(s) : ''}`;

      if (keep) {
        const el = rootEl.querySelector(`[data-keep="${keep.id}"]`);
        if (el) { el.value = keep.value; el.focus(); try { el.setSelectionRange(keep.pos, keep.pos); } catch (e) {} }
      }

      App.fit();
      const screen = window.Screens[r.key];
      if (screen && screen.after) screen.after(s, r.params);
    },

    /* scale fixed-size frames to the viewport, collapsing the layout box to the scaled size */
    fit() {
      document.querySelectorAll('.frame-scaler').forEach(el => {
        const [w, h] = el.dataset.fit.split(',').map(Number);
        const stage = el.parentElement;
        const avail = window.innerHeight - stage.getBoundingClientRect().top - 20;
        const availW = stage.clientWidth - 8;
        const sc = Math.min(1, avail / h, availW / w);
        el.style.width = w + 'px';
        el.style.height = h + 'px';
        el.style.transformOrigin = 'top center';
        el.style.transform = `scale(${sc})`;
        // transform:scale doesn't shrink the layout box — pull the reserved space back in
        el.style.marginBottom = `${-h * (1 - sc)}px`;
        el.style.marginLeft = `${-w * (1 - sc) / 2}px`;
        el.style.marginRight = `${-w * (1 - sc) / 2}px`;
      });
    },

    /* transient bottom toast (used by stub buttons so nothing is a silent dead-end) */
    toast(msg) {
      let t = document.getElementById('toast');
      if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
      t.textContent = msg;
      t.classList.add('show');
      clearTimeout(t.__h);
      t.__h = setTimeout(() => t.classList.remove('show'), 1900);
    },
  };
  window.App = App;

  window.Actions.toast = function (a) { App.toast((a && a.msg) || 'Not wired in this demo'); };
  window.Actions.noop = function (a, el, ev) { if (ev) ev.stopPropagation(); };
  window.Actions.stopPlayback = function () { if (window.Player) Player.stop(); };
  window.Actions.installApp = function () {
    const p = window.__installPrompt;
    if (!p) { App.toast('Use your browser menu → Install app / Add to Home Screen.'); return; }
    p.prompt();
    p.userChoice.then(() => { window.__installPrompt = null; App.render(); });
  };

  /* ---------- live API settings ---------- */
  window.Actions.settingsToggle = function () {
    Store.set(s => { s.settingsOpen = !s.settingsOpen; });
    if (Store.get().settingsOpen && window.Api) Api.checkWorker();
  };
  window.Actions.byokSave = function (value, el) {
    const input = el && el.tagName === 'INPUT' ? el : document.getElementById('byok-input');
    const key = String((input && input.value) || value || '').trim();
    if (!key) { App.toast('Paste an Anthropic API key first.'); return; }
    if (!/^sk-ant-/.test(key)) { App.toast('That doesn’t look like an Anthropic key (sk-ant-…).'); return; }
    Api.setByokKey(key);
    if (input) input.value = '';
    App.toast('Key saved to this browser — live drafts enabled ✓');
    App.render();
  };
  window.Actions.byokClear = function () {
    Api.setByokKey('');
    App.toast('Key removed from this browser.');
    App.render();
  };

  /* ---------- events ---------- */
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const name = el.dataset.action;
    const fn = window.Actions[name];
    if (!fn) { console.warn('No action:', name); return; }
    let a = null;
    if (el.dataset.arg !== undefined) { try { a = JSON.parse(el.dataset.arg); } catch (err) { a = el.dataset.arg; } }
    fn(a, el, e);
  });

  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const el = e.target.closest('[data-enter-action]');
    if (!el || (el.tagName === 'TEXTAREA' && !e.metaKey)) return;
    const fn = window.Actions[el.dataset.enterAction];
    if (fn) { e.preventDefault(); fn(el.value, el); }
  });

  document.addEventListener('input', e => {
    const el = e.target.closest('[data-input-action]');
    if (!el) return;
    const fn = window.Actions[el.dataset.inputAction];
    if (fn) fn(el.value, el);
  });

  // sliders (voice studio delivery)
  document.addEventListener('pointerdown', e => {
    const sl = e.target.closest('[data-slider]');
    if (!sl) return;
    const actName = sl.dataset.actionSlide;
    const a = JSON.parse(sl.dataset.arg || '{}');
    const move = ev => {
      const r = sl.getBoundingClientRect();
      const pct = Math.max(0, Math.min(100, ((ev.clientX - r.left) / r.width) * 100));
      sl.querySelector('.fill').style.width = pct + '%';
      sl.querySelector('.knob').style.left = pct + '%';
      const lbl = document.querySelector(`[data-slider-val="${a.k}"]`);
      if (lbl) lbl.textContent = Math.round(pct);
      sl.dataset.pct = pct;
    };
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      if (window.Actions[actName]) Actions[actName]({ ...a, v: parseFloat(sl.dataset.pct || '0') });
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    move(e);
  });

  window.addEventListener('hashchange', () => {
    // opening the ask screen clears the unread badge
    if (location.hash.startsWith('#/fan/ask') || location.hash.startsWith('#/fan/reply')) Actions.clearUnread();
    App.render();
  });
  window.addEventListener('resize', () => App.fit());

  document.addEventListener('DOMContentLoaded', () => {
    Store.get();
    App.render();
  });
})();
