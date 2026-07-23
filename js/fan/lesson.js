/* Fan · Lesson player — (mockup 05) */
(function () {
  'use strict';
  const { esc, arg, fmt, icon } = UI;

  window.Screens = window.Screens || {};

  Screens['fan/lesson'] = {
    tab: 'home',
    noTabbar: true,
    render(s, params) {
      const id = (params && params[0]) || s.currentLesson;
      const l = Data.COURSE.lessons.find(x => x.id === id) || Data.COURSE.lessons[0];
      const prog = s.lessonProgress[l.id] || 0;
      const pid = 'lesson-' + l.id;
      const playing = Player.isPlaying(pid);
      const chIdx = Math.max(0, Math.min(
        Number.isInteger(s.lessonChapter) ? s.lessonChapter : 0,
        l.chapters.length - 1));

      return `<div style="flex:1;min-height:0;display:flex;flex-direction:column;position:relative">
        <div style="height:64px;flex-shrink:0"></div>

        <div style="position:relative;height:226px;flex-shrink:0;background:#141715">
          <img src="${Data.IMG.skate}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 28%">
          <button data-action="nav" data-arg="${arg('#/fan/home')}" aria-label="Back"
            style="position:absolute;top:12px;left:14px;z-index:5;width:32px;height:32px;border-radius:50%;border:none;background:rgba(11,12,11,0.55);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center">
            <svg width="9" height="16" viewBox="0 0 8 14"><path d="M7 1L1.5 7 7 13" stroke="#F3F5F3" stroke-width="1.8" fill="none"/></svg>
          </button>
          <button class="playbtn" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:54px;height:54px;box-shadow:0 8px 26px rgba(0,0,0,0.45)"
            data-action="playLesson" data-arg="${arg({ id: l.id })}" data-playbtn-for="${esc(pid)}" aria-label="Play lesson">
            ${playing ? icon.pause(16) : icon.play(18)}
          </button>
        </div>

        <div style="padding:16px 18px;display:flex;flex-direction:column;gap:14px;flex:1;overflow:hidden">
          <div>
            <div style="font-size:10.5px;letter-spacing:0.16em;font-weight:800;color:var(--mint)">${esc(Data.COURSE.title.toUpperCase())} · LESSON ${parseInt(l.n, 10)}</div>
            <div style="font-size:22px;font-weight:800;margin-top:5px">${esc(l.title)}</div>
            <div style="font-size:12px;color:var(--dim2);margin-top:3px">${l.min} min · Drill sheet included</div>
          </div>

          <div style="display:flex;align-items:center;gap:10px">
            <button style="width:38px;height:38px;border-radius:50%;background:var(--mint);border:none;display:flex;align-items:center;justify-content:center;flex-shrink:0"
              data-action="playLesson" data-arg="${arg({ id: l.id })}" data-playbtn-for="${esc(pid)}" aria-label="Play lesson">
              ${playing ? icon.pause(11) : icon.play(13)}
            </button>
            <div class="progress" style="flex:1"><div style="width:${prog}%"></div></div>
            <span style="font-size:11px;color:var(--dim2)">${fmt(l.min * 60 * prog / 100)}</span>
          </div>

          <div style="display:flex;flex-direction:column;gap:8px">
            <div style="font-size:12.5px;font-weight:800;color:#B9C0BA">Chapters</div>
            ${l.chapters.map((c, i) => {
              const on = i === chIdx;
              return `<button data-action="lessonChapter" data-arg="${arg({ i, lesson: l.id })}"
                style="display:flex;align-items:center;gap:12px;width:100%;text-align:left;color:var(--txt);
                  background:${on ? 'var(--chip-bg)' : 'var(--card)'};border:1px solid ${on ? 'var(--chip-line)' : 'var(--line)'};
                  border-radius:12px;padding:11px 13px">
                <span style="font-size:12px;font-weight:800;color:${on ? 'var(--mint)' : 'var(--dim)'}">0${i + 1}</span>
                <span style="flex:1;font-size:13px;font-weight:${on ? '700' : '600'};${on ? 'color:var(--mint)' : ''}">${esc(c.t)}</span>
                <span style="font-size:11px;color:var(--dim2)">${esc(c.dur)}</span>
              </button>`;
            }).join('')}
          </div>

          <div class="card2" style="margin-top:auto;margin-bottom:26px;border-radius:14px;padding:13px 15px;display:flex;align-items:center;gap:12px">
            <div style="flex:1">
              <div style="font-size:13px;font-weight:700">Questions about this lesson?</div>
              <div style="font-size:11.5px;color:var(--dim2);margin-top:2px">Angela answers in her voice, usually within a day.</div>
            </div>
            <button style="background:none;border:1px solid var(--chip-line);color:var(--mint);border-radius:10px;padding:9px 13px;font-size:12px;font-weight:800;flex-shrink:0"
              data-action="nav" data-arg="${arg('#/fan/ask')}">Ask Angela</button>
          </div>
        </div>
      </div>`;
    },
  };

  /* module actions */

  // Big/inline play: narrates a composed intro for this lesson. Player.toggle takes {id,text}
  // directly, so this id never needs to resolve in Actions.togglePlay's registry.
  window.Actions.playLesson = function (a) {
    const l = Data.COURSE.lessons.find(x => x.id === a.id);
    if (!l) return;
    const text = 'Lesson ' + parseInt(l.n, 10) + '. ' + l.title +
      '. First up — ' + l.chapters[0].t +
      '. Watch it once at full speed, then slow it down and steal one habit for your next skate.';
    Player.toggle({ id: 'lesson-' + l.id, text });
  };

  // Track which chapter row is highlighted.
  window.Actions.setChapter = function (a) { Store.set(s => { s.lessonChapter = a.i; }); };

  // Chapter row click: highlight it and mark progress on the lesson.
  window.Actions.lessonChapter = function (a) {
    Actions.setChapter({ i: a.i });
    Actions.completeChapter({ lesson: a.lesson, i: a.i });
  };
})();
