/* STRIVE — all state transitions. Screens render state and call these by name via data-action. */
(function () {
  'use strict';

  const S = () => Store.get();

  // playables registry: resolves an id to speakable text + display title at click time
  function textFor(id) {
    const s = S();
    if (id.startsWith('drop-')) { const d = s.drops.find(d => d.id === id); return d && { text: d.script, title: d.title }; }
    if (id.startsWith('sch-')) { const d = s.scheduled.find(x => x.id === id); return d && { text: d.script || (d.title + '. ' + d.sub), title: d.title }; }
    if (id === 'sample') return { text: s.sample.text, title: 'Voice sample' };
    if (id === 'bio') return { text: Data.BIO, title: 'Angela — in her own voice' };
    if (id.startsWith('dd-')) { const d = (s.draftDrops || []).find(x => x.id === id); return d && { text: d.script, title: d.title }; }
    if (id.startsWith('draft:')) { const q = s.inbox.find(q => q.id === id.slice(6)); return q && { text: q.draft, title: 'Reply to ' + q.from.split(' ')[0] }; }
    const msg = s.chat.find(m => m.id === id);
    if (msg && msg.retracted) return null;
    if (msg) return { text: msg.text, title: msg.ai ? 'Coach Angela · AI reply' : 'Voice reply from Angela' };
    return null;
  }

  function log(text) {
    Store.silent(s => {
      s.activity.unshift({ t: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), text });
      s.activity = s.activity.slice(0, 20);
    });
  }

  // what the brain sees of the conversation: the last few fan/Angela turns (no retracted replies)
  function brainHistory(s) {
    return s.chat
      .filter(m => (m.kind === 'q' || (m.kind === 'voice' && !m.retracted)) && m.text)
      .slice(-7, -1)   // the newest q is the question itself
      .map(m => ({ role: m.kind === 'q' ? 'fan' : 'angela', text: m.text }));
  }
  // answers Angela approved in her studio — the brain's highest-trust grounding
  function brainApproved(s) {
    return (s.learnedKb || []).slice(-10).map(k => ({ q: k.q, a: k.a }));
  }

  let seq = 100;
  const uid = p => p + '-' + (++seq) + '-' + Math.random().toString(36).slice(2, 6);

  // drop a card in the fan's notification center (st = state inside a Store.set)
  function notify(st, text, sub, to) {
    st.fan.notifs = st.fan.notifs || [];
    st.fan.notifs.unshift({ id: uid('n'), text, sub, when: 'Just now', to: to || '#/fan/home', read: false });
    st.fan.notifs = st.fan.notifs.slice(0, 20);
  }

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
      (window.__resetHooks || []).forEach(fn => { try { fn(); } catch (e) {} });   // e.g. stop hot mics
      Store.reset();
    },
    unlock() {
      Store.set(s => { s.unlocked = true; });
      location.hash = '#/fan/home';
    },

    /* ---------- playback ---------- */
    togglePlay(a) {
      const p = textFor(a.id);
      if (!p) {
        // source item may be gone (e.g. a drafted drop approved mid-play) — still allow pause/resume
        if (window.Player && Player.state.id === a.id) Player.toggle({ id: a.id, text: Player.state.text || '', title: Player.state.title });
        return;
      }
      Player.toggle({
        id: a.id, text: p.text, title: p.title,
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
      // 2. knowledge base hit → the twin answers instantly (approved words). With the brain live,
      //    only answers Angela has confirmed qualify; unconfirmed demo copy goes to the brain instead.
      const brainLive = !!(window.Api && Api.brain && Api.brain.configured);
      const kb = Data.findKb(s, q, { verifiedOnly: brainLive });
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
      // 3. new question → Coach Angela's brain decides: answer now (grounded in her verified record,
      //    autopilot on), draft it into her inbox, or decline. Brain offline → straight to her inbox.
      if (window.Api && Api.enabled && Api.workerOk !== false && !(Api.brain && !Api.brain.configured)) {
        Store.set(st => {
          st.chat.push({ kind: 'q', text: q });
          st.chat.push({ kind: 'typing' });
        });
        const gen = epoch;
        const now = S();
        Api.ask(q, { history: brainHistory(now), approved: brainApproved(now), autopilot: !now.guards.review }).then(r => {
          if (gen !== epoch) return;
          Store.set(st => { st.chat = st.chat.filter(m => m.kind !== 'typing'); });
          if (!r) { Actions._queueForAngela(q, { chatPushed: true }); return; }
          if (r.route === 'crisis') {
            Store.set(st => { st.chat.push({ kind: 'sys', text: r.reply, crisis: true }); });
            log('Crisis language in a fan ask — safety message shown');
            return;
          }
          if (r.route === 'decline') {
            Store.set(st => { st.chat.push({ kind: 'voice', id: uid('c'), text: r.reply, q, when: 'Just now', decline: true, ai: true }); });
            Api.ensureVoice(r.reply);
            log('Coach Angela declined an off-limits ask');
            return;
          }
          if (r.route === 'answer' && r.auto && r.reply) {
            const cid = uid('c');
            Store.set(st => {
              st.chat.push({ kind: 'voice', id: cid, text: r.reply, q, when: 'Just now', ai: true, sources: r.sources || [] });
              st.autoLog = st.autoLog || [];
              st.autoLog.unshift({ id: uid('a'), chatId: cid, q, reply: r.reply, sources: r.sources || [], reason: r.reason || '', confidence: r.confidence, at: Date.now(), status: 'live' });
              st.autoLog = st.autoLog.slice(0, 40);
            });
            Api.ensureVoice(r.reply);
            log('Coach Angela answered a new question from your record');
            return;
          }
          Actions._queueForAngela(q, { chatPushed: true, draft: r.reply, brain: { reason: r.reason || '', sources: r.sources || [], confidence: r.confidence } });
        });
        return;
      }
      Actions._queueForAngela(q);
    },

    // New question Angela answers herself: lands in her inbox with the best draft available —
    // the brain's (grounded, with its reason), else a Claude /draft, else the offline template.
    _queueForAngela(q, opts) {
      const o = opts || {};
      const qid = uid('q');
      const liveDraft = !o.draft && window.Api && Api.active;   // worker or browser-local key
      Store.set(st => {
        if (!o.chatPushed) st.chat.push({ kind: 'q', text: q });
        st.chat.push({ kind: 'sys', text: "Sent to Angela — she reviews Coach Angela's draft and replies, usually within a day. (In this demo: approve it in the Studio inbox.)" });
        st.inbox.unshift({
          id: qid, from: st.fan.name + ' (you)', tier: st.fan.tier, avatar: st.fan.mono, color: st.fan.color,
          text: q, ago: 'Just now', meta: 'That’s you', status: 'draft', similar: 0,
          draft: o.draft || Data.draftFor(q, st.inbox.length), fromFan: true, drafting: liveDraft,
          aiDrafted: !!o.draft, brain: o.brain || null,
        });
        st.inboxSelected = qid;
        st.pendingAsks.push(qid);
      });
      log('New fan question arrived in the inbox');
      // Claude drafts the real reply; the template above is the offline fallback
      if (liveDraft) {
        const gen3 = epoch;
        Api.draft(q, S().guards).then(text => {
          if (gen3 !== epoch) return;
          Store.set(st => {
            const item = st.inbox.find(x => x.id === qid);
            if (!item) return;
            item.drafting = false;
            // don't stomp the draft while Angela has it open in the phone editor
            const editing = st.athEdit && st.athEdit.id === qid;
            if (text && item.status === 'draft' && !item.draftEdited && !editing) {
              item.draft = text;
              item.aiDrafted = true;
            }
          });
        });
      }
    },

    /* ---------- Coach Angela autopilot: Angela keeps or retracts what it sent on its own ---------- */
    coachKeep(a) {
      Store.set(st => {
        const e = (st.autoLog || []).find(x => x.id === a.id);
        if (!e || e.status !== 'live') return;
        e.status = 'kept';
        st.learnedKb.push({ id: 'learned-' + e.id, keys: Data.norm(e.q).trim().split(' ').filter(w => w.length > 4), q: e.q, a: e.reply });
      });
      log('Angela kept an autopilot reply — it’s now an approved answer');
    },
    coachRetract(a) {
      const e = (S().autoLog || []).find(x => x.id === a.id);
      if (!e || e.status !== 'live') return;
      if (window.Player && Player.state && Player.state.id === e.chatId) Player.stop();
      Store.set(st => {
        const ee = st.autoLog.find(x => x.id === a.id);
        ee.status = 'retracted';
        const m = st.chat.find(x => x.id === ee.chatId);
        if (m) m.retracted = true;
      });
      // she answers it herself instead: the question goes back into her inbox
      Actions._queueForAngela(e.q, { chatPushed: true, draft: e.reply, brain: { reason: 'You retracted the autopilot reply — rewrite or approve', sources: e.sources || [], confidence: e.confidence } });
      log('Angela retracted an autopilot reply and took the question herself');
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
      const pool = Data.INTEREST_POOL;
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
      Store.silent(s => { const q = s.inbox.find(q => q.id === id); if (q) { q.draft = value; q.draftEdited = true; } });
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
          notify(st, 'Angela answered you', '"' + qq.text.slice(0, 60) + (qq.text.length > 60 ? '…' : '') + '" — tap to listen.', '#/fan/ask');
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
      // novel text: render it with WellSaid in the background so the fan hears her real voice
      if (window.Api && Api.enabled && !Player.isReal(q.draft)) Api.ensureVoice(q.draft);
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
      const text = S().sample.text;
      // novel line + live API → render with WellSaid first, then play; else play immediately
      if (window.Api && Api.enabled && !Player.isReal(text)) {
        Actions.toast({ msg: 'Rendering with WellSaid…' });
        const gen = epoch;
        Api.ensureVoice(text).then(() => { if (gen === epoch) Actions.togglePlay({ id: 'sample' }); });
      } else {
        setTimeout(() => Actions.togglePlay({ id: 'sample' }), 60);
      }
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
          notify(s, 'New drop: ' + title, 'Fresh from Angela — tap to listen.', '#/fan/home');
        } else {
          s.scheduled.unshift({ id: 'sch-' + Date.now(), slot, title, sub: 'Script approved · voice generated ✓', dur: UI.fmt(Player.estimate(script, 1)) });
          s.composerOpen = false;
        }
      });
      // render the new drop's voice with WellSaid so the fan feed plays it for real
      if (window.Api && Api.enabled && !Player.isReal(script)) Api.ensureVoice(script);
      log(slot === 'now' ? `Published drop "${title}"` : `Scheduled drop "${title}" (${slot})`);
    },
    toggleComposer() { Store.set(s => { s.composerOpen = !s.composerOpen; }); },
  };
})();
