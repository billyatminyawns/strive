/* STRIVE — seed data, knowledge base, and reply drafting. All content illustrative (from concept mockups). */
(function () {
  'use strict';

  const IMG = {
    head: 'assets/angela1.webp',   // portrait
    skate: 'assets/angela2.webp',  // action still
    medals: 'assets/medals.jpg',   // medals / hero
    ciLogo: 'assets/ci-logo.png',  // Continuity Intelligence
  };

  // ---------- voice scripts (spoken by the demo voice; durations estimated at speak time) ----------
  const DROPS = [
    {
      id: 'drop-1', title: 'Morning skate mindset', when: 'Today', listens: 8204, completion: 92,
      script: "Morning. Quick thought before you hit the ice today. The morning skate isn't about proving anything — it's about telling your body the truth: we're playing tonight. So pick one thing. One. Maybe it's your first touch, maybe it's talking louder on switches. Do it at game speed for twenty minutes and get off. Poise beats panic, and poise is built in the morning. Go have a day.",
    },
    {
      id: 'drop-2', title: 'Road trip Q&A', when: 'Yesterday', listens: 6911, completion: 88,
      why: 'Fans keep asking about this one',
      script: "Road trip questions, rapid fire. Best road habit? Unpack fully, even for one night — chaos in the room becomes chaos on the ice. Roommates? Pick the one who sleeps. Food? Eat what you know, not what's exciting. And the big one — homesickness. It's not weakness, it's a signal you have something worth missing. Call home, then close the loop and be where your feet are.",
    },
    {
      id: 'drop-3', title: 'Gold medal morning', when: 'Feb 17', listens: 12388, completion: 95,
      why: 'Most replayed this month', pinned: true,
      script: "People ask what the morning of the gold medal game felt like. Honestly? Quiet. We'd done the loud part for four years. I remember tying my skates and thinking — nothing new today. Same tape job, same warm-up, same first shift plan. Big moments don't want more from you. They want exactly what you've already built, delivered on time.",
    },
  ];

  const SCHEDULED = [
    { id: 'sch-1', slot: 'FRI 7:00 AM', title: 'Friday drop: Power play reads', sub: 'Script approved · voice generated ✓', dur: '2:40' },
    { id: 'sch-2', slot: 'MON 7:00 AM', title: 'Lesson 6 teaser — "When to pinch"', sub: 'Clip selected · caption drafted', dur: '0:45' },
    { id: 'sch-3', slot: 'TUE 6:00 PM', title: 'Members Q&A batch — 12 voice replies', sub: 'Awaiting your approval · 11 of 12 drafted', dur: '~8:00' },
  ];

  // ---------- masterclass ----------
  const COURSE = {
    id: 'defense-decoded', title: 'Defense, Decoded', sub: 'Masterclass · 6 lessons',
    lessons: [
      { id: 'l1', n: '01', title: "The defender's mindset", min: 14, chapters: [
        { t: 'Why defense is a decision', dur: '3:05' }, { t: 'The three questions', dur: '5:40' }, { t: 'Film: my worst shift', dur: '5:15' }] },
      { id: 'l2', n: '02', title: 'Reading the rush', min: 11, chapters: [
        { t: 'The first three strides', dur: '2:10' }, { t: 'Angles over speed', dur: '4:32' }, { t: 'When to pinch', dur: '3:58' }] },
      { id: 'l3', n: '03', title: 'Leading from the blue line', min: 16, chapters: [
        { t: 'Talk is a skill', dur: '4:20' }, { t: 'Standards beat titles', dur: '6:05' }, { t: 'The bench shift', dur: '5:35' }] },
      { id: 'l4', n: '04', title: 'Gap control', min: 18, chapters: [
        { t: 'Honest feet', dur: '5:10' }, { t: 'Two-touch angling walls', dur: '6:48' }, { t: 'Timing off the second stride', dur: '6:02' }] },
      { id: 'l5', n: '05', title: 'Small-rink defending', min: 12, chapters: [
        { t: 'Less ice, more information', dur: '3:44' }, { t: 'Stick on puck side', dur: '4:16' }, { t: 'Live reps', dur: '4:00' }] },
      { id: 'l6', n: '06', title: 'When to pinch', min: 13, chapters: [
        { t: 'The risk ledger', dur: '4:02' }, { t: 'Reading the winger', dur: '4:58' }, { t: 'Film: Nagano reads', dur: '4:00' }] },
    ],
  };

  // ---------- knowledge base: approved answers the twin can speak instantly ----------
  // These five are DEMO COPY, not Angela's confirmed words (e.g. the 6 a.m. routine, the sleepless
  // night before Nagano). verified:false keeps them off the instant path once Coach Angela's brain
  // is live; set verified:true only after Angela confirms the answer is true to her.
  const KB = [
    {
      id: 'kb-reset', verified: false, keys: ['reset', 'bad shift', 'mistake', 'bounce back from a bad'],
      q: 'How did you reset after a bad shift in big games?',
      a: "Short memory, long habits. I gave myself one length of the bench to be frustrated — then eyes up, next play. The reset is a skill you train, not a mood you wait for.",
    },
    {
      id: 'kb-nerves', verified: false, keys: ['nerve', 'nervous', 'anxious', 'anxiety', 'scared', 'pre-game', 'pregame', 'pressure'],
      q: 'How do I handle pre-game nerves?',
      a: "Nerves mean it matters. The night before gold in Nagano I barely slept — so I stopped chasing calm and built a routine I could do scared: same warm-up, same first touch, one cue word. Borrow mine until you build yours.",
    },
    {
      id: 'kb-gap', verified: false, keys: ['gap control', 'small rink', 'drill', 'angling'],
      q: 'Best drills for gap control on a small rink?',
      a: "A small rink is a gift — less ice to defend if your feet are honest. Work two-touch angling walls, stick on the puck side, and time your gap off their second stride, not their first.",
    },
    {
      id: 'kb-routine', verified: false, keys: ['morning routine', 'daily routine', 'start your day', 'wake up'],
      q: "What's your morning routine?",
      a: "Boring and repeatable. Up at six, ten minutes of mobility before coffee, and I write the day's one hard thing on a sticky note. Champions aren't morning people — they're consistency people who happen to be awake.",
    },
    {
      // keys stay multi-word or unambiguous — findKb is substring-based, so bare 'ioc'/'boards' would hijack "mediocre"/"along the boards"
      id: 'kb-ioc', verified: false, keys: ['the ioc', 'olympic committee', 'after hockey', 'since hockey', 'retire', 'board member', 'boardroom', 'businesses', 'executive', 'career after', 'life after'],
      q: 'What have you done since hockey?',
      a: "Hockey was chapter one, not the whole book. I served on the IOC as an athlete rep, sat on boards, built companies, and kept collecting degrees along the way. Different rooms, same game: show up prepared, ask the honest question, do the boring work. The rink just taught me first.",
    },
  ];

  // interest picker pool — general-first (universal topics), sport jargon last
  const INTEREST_POOL = ['Mindset', 'Nutrition', 'Recovery', 'Training', 'Stories', 'Leadership', 'Culture', 'Hockey IQ'];

  // voice bio — "the Wikipedia in her own voice" on the athlete's public profile (pre-rendered clip)
  const BIO = "Hey, I'm Angela. Four Olympics, a gold medal from Nagano, and a seat in the Hockey Hall of Fame — but honestly, defense taught me more than the podiums did. These days I serve on boards, work across the Olympic movement, and geek out on mindset, nutrition, and leadership. Everything you hear in here, I wrote or approved. Come say hi.";

  // AI-drafted drops awaiting the athlete's approval — the "approve 20 in one sitting" model:
  // the platform drafts from everything she's said; she reviews, she never has to create.
  const DRAFT_DROPS = [
    {
      id: 'dd-1', title: 'Why I loved the 4 AM practices', source: 'Drafted from your 2019 podcast interview',
      script: "Everyone hates the 4 AM practice story until they need it. Empty rink, cold air, nobody watching — that's where you find out if you love the work or the applause. I learned to love the work. The applause got loud later on its own.",
    },
    {
      id: 'dd-2', title: 'Reading a locker room in 60 seconds', source: 'Drafted from your leadership keynote',
      script: "Walk in and count who's looking at the floor. A quiet room isn't a focused room — focused rooms hum. If the floor-lookers outnumber the hummers, your first job isn't tactics. It's getting one honest laugh before puck drop.",
    },
    {
      id: 'dd-3', title: "The gear superstition I'll admit to", source: "You mentioned this once — fans never heard the full story",
      script: "Left skate first, always. Not because it works — because deciding it works gave my brain one less thing to negotiate at six PM on game day. Superstitions aren't magic. They're pre-made decisions. Make yours boring, and keep them.",
    },
  ];

  // knowledge coverage by bucket — drives which capture prompts get pushed ("2% covered → ask about it")
  const COVERAGE = [
    { bucket: 'Training', pct: 95 }, { bucket: 'Mindset', pct: 85 }, { bucket: 'Nutrition', pct: 70 },
    { bucket: 'Leadership', pct: 60 }, { bucket: 'Recovery', pct: 25 }, { bucket: 'Culture', pct: 10 },
  ];

  // sensitive topics — auto-declined politely when the guardrail is on.
  // WORDS match on token boundaries (so "issue"/"pursue" don't trip "sue"); PREFIX matches morphological variants.
  const SENSITIVE_WORDS = ['bet', 'bets', 'betting', 'parlay', 'parlays', 'odds', 'gamble', 'gambling', 'wager', 'wagers',
    'doctor', 'medical', 'medicine', 'meds', 'concussion', 'concussions', 'surgery', 'injury', 'injuries',
    'legal', 'lawyer', 'lawsuit', 'sue', 'suing'];
  const SENSITIVE_PREFIX = ['injur', 'concuss', 'diagnos', 'medicat', 'prescri'];
  const DECLINE_TEXT = "That one's outside what I can responsibly answer here — medical, betting and legal asks get a polite pass from me. Bring me anything about training, mindset, leadership or the game itself, and I'm all yours.";

  // draft templates for questions the twin hasn't learned yet (used to draft in Studio inbox)
  const DRAFT_OPENERS = [
    "Good question — I got asked something like this in the locker room more than once. Here's my honest take: ",
    "I love this question, because I got it wrong early in my career. What I'd tell you now: ",
    "Straight answer, no fluff: ",
  ];
  const DRAFT_BODIES = [
    "start smaller than feels impressive. Pick the one controllable piece of this you can repeat every single day for two weeks, and protect it like ice time. The habit will answer the question better than I can.",
    "write down what 'good' looks like for you in one sentence, then work backwards to this week. Most people stall because the goal is a fog. Make it a target, and the next step usually gets obvious.",
    "talk to the person involved before you decide anything. Ninety percent of the situations I got asked about were solved by one honest, slightly uncomfortable conversation. The other ten percent — that's what habits are for.",
  ];

  // ---------- inbox seed (23 waiting; we show the 4 detailed ones) ----------
  const INBOX = [
    {
      id: 'q-marcus', from: 'Marcus T.', tier: 'Inner Circle', avatar: 'M', color: '#CBA9F7',
      text: "I'm 16 and just got cut from AAA. How do I come back from this?",
      ago: '2h ago', meta: 'Member 14 months', status: 'draft', similar: 14,
      similarLabel: '"Getting cut / not making the team"',
      draft: "Getting cut stings because you care — good. I didn't make every roster I tried out for either. Give yourself 48 hours to feel it, then get specific: ask the coach for the two things that kept you off the list, and build your summer around exactly those. The cut is feedback, not a verdict. Send me your plan in September — I mean it.",
      kbKeys: ['cut', 'roster', 'didn\'t make', 'not make the team', 'tryout didn'],
    },
    {
      id: 'q-priya', from: 'Priya N.', tier: 'All-Access', avatar: 'P', color: '#7EB3F7',
      text: 'What do you eat on game day?',
      ago: '4h ago', meta: 'Member 6 months', status: 'draft', similar: 9,
      similarLabel: '"Game-day nutrition"',
      draft: "Boring on purpose. Oatmeal at 8, pasta at noon, nothing new on game day — ever. The meal isn't the performance, the routine is. Save the adventurous eating for the off-season, and drink more water than you think you need.",
      kbKeys: ['eat', 'nutrition', 'food', 'game day', 'diet', 'meal'],
    },
    {
      id: 'q-dev', from: 'Dev K.', tier: 'Inner Circle', avatar: 'D', color: '#FCA46F',
      text: 'How do I captain teammates older than me?',
      ago: '6h ago', meta: 'Member 2 years', status: 'draft', similar: 6,
      similarLabel: '"Leading older teammates"',
      draft: "Titles don't lead, standards do. Be first on the ice and last to blame, and never ask for anything you don't visibly do yourself. Older teammates don't follow your letter — they follow your consistency. Give it three weeks before you judge whether it's working.",
      kbKeys: ['captain', 'older teammates', 'leadership', 'lead the team'],
    },
    {
      id: 'q-lena', from: 'Coach Lena', tier: 'Rookie', avatar: 'L', color: '#7CE2A5',
      text: "Advice for my daughter's first tryout?",
      ago: 'Yesterday', meta: 'Member 3 weeks', status: 'draft', similar: 4,
      similarLabel: '"First tryouts"',
      draft: "Tell her the tryout starts in the parking lot — how she carries her bag, how she greets the coach, how she listens in line. Skills get you noticed, but coachability gets you picked. And whatever happens: same dinner after, win or lose. That's how she learns the tryout doesn't define her.",
      kbKeys: ['first tryout', 'daughter', 'tryout advice'],
    },
  ];

  // ---------- capture: story prompts (from the CI onboarding gap report — "6 stories she's never told publicly") ----------
  const STORY_PROMPTS = [
    { id: 'sp-nagano', title: 'The night before Nagano', src: 'GAP REPORT · MINDSET', hint: 'From your gap report — fans have never heard how you actually slept (or didn’t).' },
    { id: 'sp-skates', title: 'Your first pair of skates', src: 'GAP REPORT · YOUR STORY', hint: 'Origin stories index 3× better than highlights. Where did they come from?' },
    { id: 'sp-cut', title: 'The hardest cut you survived', src: 'TRENDING · 14 FANS ASKED THIS WEEK', hint: 'You reference this in Q&As but the full story isn’t in the knowledge base yet.' },
    { id: 'sp-harvard', title: 'What Harvard taught you about hockey', src: 'TOP REQUEST · INNER CIRCLE', hint: 'Bridges your two worlds — top-requested topic among Inner Circle fans.' },
    { id: 'sp-mentor', title: 'The mentor who changed everything', src: 'GAP REPORT · CULTURE 10% COVERED', hint: 'Your Coach has no source material on your early coaches.' },
    { id: 'sp-ritual', title: 'Your weirdest pre-game ritual', src: 'NUGGET · YOU MENTIONED IT ONCE, IN 2010', hint: 'Light one — fans love these, and it humanizes the answers.' },
    { id: 'sp-class', title: 'Pitch your next masterclass', src: 'YOUR CALL', hint: 'The class you’ve always wanted to teach — name it and talk through lesson one. We build the outline.' },
    { id: 'sp-free', title: 'Anything on your mind', src: 'YOUR CALL', hint: 'No prompt, no agenda — killer game last night, a thought on the bus, whatever you want logged.' },
  ];

  // ---------- live AMA (monthly All-Access event) ----------
  const AMA = {
    title: 'All-Access AMA', when: 'Tonight · 7:00 PM', rsvps: 412,
    open: "Hey everyone — welcome to the All-Access AMA. I've got my tea, I've got your questions, and we've got the whole hour. No agenda, no media training tonight. Let's get into it.",
    answers: [
      {
        q: "What's the one drill you'd never skip?", from: 'Priya N.',
        a: "Two-touch angling walls, every single skate. It's boring, and that's the point — gap control is a habit, not a highlight. Five minutes of honest feet before practice bought me more ice time than any slapshot I ever worked on.",
      },
      {
        q: 'What was your welcome-to-the-Olympics moment?', from: 'Dev K.',
        a: "Walking into the village in Nagano and realizing the person in front of me in the food line was a legend I had taped to my bedroom wall. I was seventeen. I dropped my tray. She helped me pick it up — and that's when I learned champions are just people who kept showing up.",
      },
    ],
  };

  // ---------- discover ----------
  const ATHLETES = [
    { id: 'sana', name: 'Sana Ito', sport: 'Tennis', mono: 'SI', color: '#7EB3F7', line: 'Serve mechanics — Lesson 1 live now', topics: ['Training', 'Mindset'] },
    { id: 'okafor', name: 'Marcus Okafor', sport: 'Track', mono: 'MO', color: '#FCA46F', line: 'Ask-me-anything opens Friday', topics: ['Nutrition', 'Recovery'] },
    { id: 'pia', name: 'Pia Laurent', sport: 'Soccer', mono: 'PL', color: '#CBA9F7', line: 'Set pieces, decoded — trailer out', topics: ['Leadership', 'Culture', 'Stories'] },
  ];

  // ---------- seed state ----------
  function seed() {
    return {
      __v: 5,
      unlocked: false,              // invite gate passed?
      fan: {
        name: 'Marcus', mono: 'M', color: '#CBA9F7',
        tier: 'All-Access', billing: 'monthly', memberSince: 'May 2026',
        streak: 12,
        interests: ['Mindset', 'Nutrition', 'Recovery', 'Stories'],
        savedReplies: ['c1'],
        follows: { sana: false, okafor: false, pia: false },
        listenedDrops: { 'drop-2': true },   // drop-3 stays fresh so "Suggested" has a real pull
        unread: 0,                  // unread voice replies (badge on Ask tab)
        notifs: [
          { id: 'n-ama', text: 'Live tonight: All-Access AMA · 7:00 PM', sub: 'Live drops in Angela’s voice — only for the fans in the room. Tap to preview.', when: 'Today', to: '#/fan/live', read: false },
          { id: 'n-drop', text: 'New drop: Morning skate mindset', sub: '2 minutes of Angela before you hit the ice.', when: 'This morning', to: '#/fan/home', read: false },
          { id: 'n-welcome', text: 'Welcome to Strive 🎉', sub: 'You arrived through Angela’s invite. Ask her anything.', when: 'May 2026', to: '#/fan/ask', read: true },
        ],
      },
      lessonProgress: { l1: 100, l2: 100, l3: 100, l4: 62 },   // % per lesson id
      chaptersDone: {},                 // lessonId -> [visited chapter indices]
      currentLesson: 'l4',
      chat: [
        { kind: 'q', text: 'How did you reset after a bad shift in big games?' },
        { kind: 'voice', id: 'c1', text: KB[0].a, q: 'How did you reset after a bad shift in big games?', when: 'Tuesday' },
      ],
      chips: ['kb-nerves', 'kb-ioc'],   // suggested question chips still unasked — one hockey, one "didn't know to ask"
      pendingAsks: [],                  // fan question ids waiting on Angela
      inbox: INBOX.map(q => ({ ...q })),
      inboxSelected: 'q-marcus',
      inboxExtra: 19,                   // the "+19 more" beyond the detailed items
      inboxFilter: 'all',
      learnedKb: [],                    // KB entries added by approving replies (the twin "learning")
      drops: DROPS.map(d => ({ ...d })),
      scheduled: SCHEDULED.map(s => ({ ...s })),
      guards: { review: false, topics: true, decline: true },   // review off = Coach Angela autopilot (server still gates it)
      autoLog: [],                      // replies Coach Angela sent on its own, for Angela to keep or retract
      delivery: { warmth: 70, energy: 55, pace: 45 },
      sample: { text: 'Big game tonight — remember, poise beats panic.', ready: false },
      stats: {
        members: 12480, membersDelta: '+8.2% this month',
        revenue: '$38.2K', revenueDelta: '+12% this month',   // shown on You + Studio, never the front page
        answered: '94%', answeredNote: 'of fan questions',
        listen: '4:37', listenDelta: '+0:41 vs June',
        reply: '9h', replyNote: 'median wait for fans',
      },
      draftDrops: DRAFT_DROPS.map(d => ({ ...d })),   // AI-drafted, awaiting her approval
      passedPrompts: [],                              // capture prompts she said "don't ask" to
      activity: [],                     // studio activity feed: {t, text}
      billingAnnual: false,
      trialTier: null,                  // set when fan starts a trial from tiers screen
    };
  }

  // ---------- ask pipeline helpers ----------
  const norm = s => ' ' + String(s || '').toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim() + ' ';

  function isSensitive(q) {
    const toks = norm(q).trim().split(' ').filter(Boolean);
    return toks.some(t => SENSITIVE_WORDS.includes(t) || SENSITIVE_PREFIX.some(p => t.startsWith(p)));
  }

  // opts.verifiedOnly: skip seed answers Angela hasn't confirmed (her studio approvals always count)
  function findKb(state, q, opts) {
    const n = norm(q);
    const seeds = opts && opts.verifiedOnly ? KB.filter(e => e.verified) : KB;
    const all = seeds.concat(state.learnedKb || []);
    let best = null, bestScore = 0;
    for (const e of all) {
      let score = 0;
      for (const k of e.keys) if (n.includes(norm(k).trim())) score++;
      if (score > bestScore) { best = e; bestScore = score; }
    }
    return bestScore > 0 ? best : null;
  }

  function draftFor(q, i) {
    const opener = DRAFT_OPENERS[i % DRAFT_OPENERS.length];
    const body = DRAFT_BODIES[(i + 1) % DRAFT_BODIES.length];
    return opener + body;
  }

  window.Data = {
    IMG, DROPS, SCHEDULED, COURSE, KB, SENSITIVE_WORDS, SENSITIVE_PREFIX, DECLINE_TEXT, ATHLETES, STORY_PROMPTS, AMA, INTEREST_POOL, BIO, DRAFT_DROPS, COVERAGE,
    seed, isSensitive, findKb, draftFor, norm,
  };
})();
