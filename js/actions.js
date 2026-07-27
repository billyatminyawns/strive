/* STRIVE — all state transitions. Screens render state and call these by name via data-action. */
(function () {
  'use strict';

  const S = () => Store.get();

  // playables registry: resolves an id to speakable text at click time
  function textFor(id) {
    const s = S();
    if (id.startsWith('drop-')) { const d = s.drops.find(d => d.id === id); return d && d.script; }
    if (id.startsWith('sch-')) { const d = s.scheduled.find(x => x.id === id); return d && (d.title + '. ' + d.sub); }
    if (id === 'sample') return s.sample.text;
    if (id.startsWith('draft:')) { const q = s.inbox.find(q => q.id === id.slice(6)); return q && q.draft; }
    const msg = s.chat.find(m => m.id === id);
    if (msg) return msg.text;
    return null;
  }

  function log(text) {
    Store.silent(s => {
      s.activity.unshift({ t: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), text });
      s.activity = s.activity.slice(0, 20);
    });
  }

  let seq = 100;
  const uid = p => p + '-' + (++seq) + '-' + Math.random().toString(36).slice(2, 6);

  // bumped on reset so deferred chat callbacks armed before a reset become no-ops
  let epoch = 0;

  window.Actions = {

    /* ---------- navigation ---------- */
    nav(hash) { location.hash = hash.startsWith('#') ? hash : '#' + hash; },
    // history-aware back: return to wherever the user came from, with a fallback for deep links
    back(a) {
      const fallback = (a && a.to) || '#/fan/home';
      if (window.history.length > 1 && document.referrer !== location.href) window.history.back();
      else location.hash = fallback;
    },
    resetDemo() {
      epoch++;                       // invalidate any in-flight deferred chat callbacks
      if (window.Player) Player.stop();
      Store.reset();
    },
    unlock() {
      Store.set(s => { s.unlocked = true; });
      location.hash = '#/fan/home';
    },

    /* ---------- playback ---------- */
    togglePlay(a) {
      const text = textFor(a.id);
      if (!text) return;
      Player.toggle({
        id: a.id, text,
        onEnd: (id) => {
          if (id && id.startsWith('drop-')) Store.silent(s => { s.fan.listenedDrops[id] = true; });
        },
      });
    },
    seek(a) { Player.seek(a.delta); },

    /* ---------- fan: ask Angela ---------- */
    askChip(a) {
      const kb = Data.KB.find(k => k.id === a.id);
      if (!kb) return;
      Store.set(s => { s.chips = s.chips.filter(c => c !== a.id); });
      Actions._ask(kb.q);
    },
    askSubmit(value, el) {
      const q = String(value || '').trim();
      if (!q) return;
      if (el) el.value = '';
      Actions._ask(q);
    },
    _ask(q) {
      const s = S();
      // 1. sensitive → polite pass (if guardrail on), else flagged into inbox
      if (Data.isSensitive(q)) {
        if (s.guards.decline) {
          Store.set(st => {
            st.chat.push({ kind: 'q', text: q });
            st.chat.push({ kind: 'typing' });
          });
          const gen1 = epoch;
          setTimeout(() => { if (gen1 !== epoch) return; Store.set(st => {
            st.chat = st.chat.filter(m => m.kind !== 'typing');
            st.chat.push({ kind: 'voice', id: uid('c'), text: Data.DECLINE_TEXT, q, when: 'Just now', decline: true });
          }); }, 1400);
          log('Auto-declined a sensitive ask (guardrail)');
          return;
        }
        Store.set(st => {
          st.chat.push({ kind: 'q', text: q });
          st.chat.push({ kind: 'sys', text: 'Sent to Angela for review — flagged as sensitive.' });
          st.inbox.unshift({
            id: uid('q'), from: s.fan.name + ' (you)', tier: s.fan.tier, avatar: s.fan.mono, color: s.fan.color,
            text: q, ago: 'Just now', meta: 'That’s you', status: 'draft', flagged: true, similar: 0,
            draft: Data.draftFor(q, st.inbox.length), fromFan: true,
          });
        });
        return;
      }
      // 2. knowledge base hit → the twin answers instantly (approved words)
      const kb = Data.findKb(s, q);
      if (kb) {
        Store.set(st => {
          st.chat.push({ kind: 'q', text: q });
          st.chat.push({ kind: 'typing' });
          st.chips = st.chips.filter(c => c !== kb.id);
        });
        const gen2 = epoch;
        setTimeout(() => {
          if (gen2 !== epoch) return;
          Store.set(st => {
            st.chat = st.chat.filter(m => m.kind !== 'typing');
            st.chat.push({ kind: 'voice', id: uid('c'), text: kb.a, q, when: 'Just now' });
          });
        }, 1600);
        return;
      }
      // 3. new question → Studio inbox, Angela approves, fan gets the reply
      Store.set(st => {
        st.chat.push({ kind: 'q', text: q });
        st.chat.push({ kind: 'sys', text: 'Sent to Angela — new questions get her real voice, usually within a day. (In this demo: approve it in the Studio inbox.)' });
        const id = uid('q');
        st.inbox.unshift({
          id, from: st.fan.name + ' (you)', tier: st.fan.tier, avatar: st.fan.mono, color: st.fan.color,
          text: q, ago: 'Just now', meta: 'That’s you', status: 'draft', similar: 0,
          draft: Data.draftFor(q, st.inbox.length), fromFan: true,
        });
        st.inboxSelected = id;
        st.pendingAsks.push(id);
      });
      log('New fan question arrived in the inbox');
    },

    saveReply(a) {
      Store.set(s => {
        if (!s.fan.savedReplies.includes(a.id)) s.fan.savedReplies.push(a.id);
      });
    },
    openReply(a) { location.hash = '#/fan/reply/' + a.id; },
    clearUnread() { Store.silent(s => { s.fan.unread = 0; }); },

    /* ---------- fan: misc ---------- */
    toggleFollow(a) { Store.set(s => { s.fan.follows[a.id] = !s.fan.follows[a.id]; }); },
    setBilling(a) { Store.set(s => { s.billingAnnual = a.annual; }); },
    startTrial(a) {
      Store.set(s => { s.trialTier = a.tier; s.fan.tier = a.tier; });
    },
    toggleInterest(a) {
      Store.set(s => {
        const i = s.fan.interests.indexOf(a.tag);
        if (i >= 0) s.fan.interests.splice(i, 1); else s.fan.interests.push(a.tag);
      });
    },
    surpriseMe() {
      const pool = ['Recovery', 'Film study', 'Off-ice strength', 'Team culture', 'Nagano stories'];
      Store.set(s => {
        const fresh = pool.filter(p => !s.fan.interests.includes(p));
        if (fresh.length) s.fan.interests.push(fresh[Math.floor(Math.random() * fresh.length)]);
      });
    },
    openLesson(a) {
      Store.set(s => { s.currentLesson = a.id; });
      location.hash = '#/fan/lesson/' + a.id;
    },
    completeChapter(a) {
      Store.set(s => {
        const course = Data.COURSE.lessons.find(l => l.id === a.lesson);
        if (!course) return;
        s.chaptersDone = s.chaptersDone || {};
        const done = new Set(s.chaptersDone[a.lesson] || []);
        if (Number.isInteger(a.i)) done.add(a.i);
        s.chaptersDone[a.lesson] = [...done];
        // derive from visited chapters; all visited → exactly 100. Never regress a pre-seeded %.
        const derived = done.size >= course.chapters.length ? 100 : Math.round(done.size / course.chapters.length * 100);
        s.lessonProgress[a.lesson] = Math.max(s.lessonProgress[a.lesson] || 0, derived);
      });
    },

    /* ---------- studio: inbox ---------- */
    selectInbox(a) { Store.set(s => { s.inboxSelected = a.id; }); },
    setInboxFilter(a) { Store.set(s => { s.inboxFilter = a.f; }); },
    editDraft(value, el) {
      const id = el.dataset.qid;
      Store.silent(s => { const q = s.inbox.find(q => q.id === id); if (q) q.draft = value; });
    },
    toggleEditDraft(a) {
      Store.set(s => { const q = s.inbox.find(q => q.id === a.id); if (q) q.editing = !q.editing; });
    },
    approve(a) {
      const s = S();
      const q = s.inbox.find(q => q.id === a.id);
      if (!q || q.status !== 'draft') return;   // can't approve an already-sent or declined item
      Store.set(st => {
        const qq = st.inbox.find(x => x.id === a.id);
        qq.status = 'sent'; qq.editing = false;
        // the twin learns this answer for everyone who asks next
        st.learnedKb.push({ id: 'learned-' + qq.id, keys: qq.kbKeys || Data.norm(qq.text).trim().split(' ').filter(w => w.length > 4), q: qq.text, a: qq.draft });
        // if this question came from the fan in this demo, deliver the voice reply to their chat
        if (qq.fromFan) {
          const cid = 'c-' + qq.id;
          st.chat.push({ kind: 'voice', id: cid, text: qq.draft, q: qq.text, when: 'Just now' });
          st.pendingAsks = st.pendingAsks.filter(p => p !== qq.id);
          st.fan.unread += 1;
          // real browser notification if the fan enabled voice-reply alerts (You → Notifications)
          if (st.fan.settings && st.fan.settings.replyAlerts &&
              typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            try {
              new Notification('STRIVE — Angela answered you', {
                body: '"' + qq.text.slice(0, 60) + (qq.text.length > 60 ? '…' : '') + '" — tap the Ask tab to hear it.',
              });
            } catch (e) {}
          }
        }
      });
      log(`Approved reply to ${q.from} — sent in your voice`);
    },
    decline(a) {
      Store.set(st => {
        const q = st.inbox.find(x => x.id === a.id);
        if (!q || q.status !== 'draft') return;
        q.status = 'declined';
        if (q.fromFan) {
          st.chat.push({ kind: 'sys', text: 'Angela passed on this one — outside her approved topics.' });
          st.pendingAsks = st.pendingAsks.filter(p => p !== q.id);
        }
        // move selection off the now-hidden item so the detail pane never shows a declined row
        if (st.inboxSelected === q.id) {
          const next = st.inbox.find(x => x.status !== 'declined');
          st.inboxSelected = next ? next.id : null;
        }
      });
    },
    sendToAll(a) {
      Store.set(st => {
        const q = st.inbox.find(x => x.id === a.id);
        if (!q) return;
        q.sentToAll = true;
      });
      const q = S().inbox.find(x => x.id === a.id);
      if (q) log(`Sent "${q.text.slice(0, 40)}…" answer to ${q.similar} similar askers`);
    },

    /* ---------- studio: voice ---------- */
    toggleGuard(a) {
      Store.set(s => { s.guards[a.k] = !s.guards[a.k]; });
      const s = S();
      log(`Guardrail "${a.k}" turned ${s.guards[a.k] ? 'on' : 'off'}`);
    },
    setDelivery(a) { Store.set(s => { s.delivery[a.k] = Math.round(a.v); }); },
    sampleText(value) { Store.silent(s => { s.sample.text = value; }); },
    genSample() {
      Store.set(s => { s.sample.ready = true; });
      // auto-play the generated sample
      setTimeout(() => Actions.togglePlay({ id: 'sample' }), 60);
    },

    /* ---------- studio: content ---------- */
    scheduleDrop(a, el) {
      const root = el.closest('[data-composer]');
      if (!root) return;
      const title = root.querySelector('[data-f="title"]').value.trim();
      const script = root.querySelector('[data-f="script"]').value.trim();
      const slot = root.querySelector('[data-f="slot"]').value;
      if (!title || !script) return;
      Store.set(s => {
        if (slot === 'now') {
          s.drops.unshift({ id: 'drop-' + Date.now(), title, script, when: 'Just now', listens: 0, completion: 0 });
          s.composerOpen = false;
        } else {
          s.scheduled.unshift({ id: 'sch-' + Date.now(), slot, title, sub: 'Script approved · voice generated ✓', dur: UI.fmt(Player.estimate(script, 1)) });
          s.composerOpen = false;
        }
      });
      log(slot === 'now' ? `Published drop "${title}"` : `Scheduled drop "${title}" (${slot})`);
    },
    toggleComposer() { Store.set(s => { s.composerOpen = !s.composerOpen; }); },
  };
})();
