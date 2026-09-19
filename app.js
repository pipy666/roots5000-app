(() => {
  'use strict';

  const WORDS = Array.isArray(window.ROOTS_WORDS) ? window.ROOTS_WORDS : [];
  const META = window.ROOTS_META || { count: WORDS.length, core: 0, reading: 0 };
  const BY_ID = Object.fromEntries(WORDS.map(w => [w.id, w]));
  const STATE_KEY = 'ielts_roots5000_app_v1';
  const APP_VERSION = '0.3';
  const MAX_DAILY_REVIEWS = 60;
  const INTERVALS = [
    60 * 1000,          // unknown: 1 minute (same-session retry is also inserted)
    10 * 60 * 1000,     // fuzzy: 10 minutes
    24 * 3600 * 1000,   // 1 day
    3 * 24 * 3600 * 1000,
    7 * 24 * 3600 * 1000,
    14 * 24 * 3600 * 1000,
    30 * 24 * 3600 * 1000,
    60 * 24 * 3600 * 1000
  ];

  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const esc = (s='') => String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const clamp = (n,a,b) => Math.min(Math.max(n,a),b);
  const CONFUSABLES = {
    absent:['absence'], absence:['absent'],
    adapt:['adopt'], adopt:['adapt'],
    accept:['except'], except:['accept'],
    access:['assess'], assess:['access'],
    affect:['effect'], effect:['affect'],
    complement:['compliment'], compliment:['complement'],
    principal:['principle'], principle:['principal'],
    economic:['economical'], economical:['economic'],
    historic:['historical'], historical:['historic'],
    sensible:['sensitive'], sensitive:['sensible'],
    rise:['raise'], raise:['rise'],
    borrow:['lend'], lend:['borrow']
  };
  function byWordText(word){
    const q=String(word||'').toLowerCase();
    return WORDS.find(w=>w.word.toLowerCase()===q);
  }

  function todayKey(d = new Date()) {
    return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
  }
  function dayDiff(a,b) {
    if (!a || !b) return 0;
    return Math.round((new Date(b+'T00:00:00') - new Date(a+'T00:00:00')) / 86400000);
  }
  function defaultState() {
    return {
      settings: { goal: 50, autoSpeak: true, sfx: true, accent: 'en-GB', phase: 'Core', theme: 'strawberry', rate: 0.95 },
      progress: {},
      wrongBook: {},
      streak: 0,
      lastStudyDate: '',
      totalQuiz: 0,
      totalQuizRight: 0,
      backupRemindAt: 0,
      today: null
    };
  }
  function loadState() {
    try {
      const raw = JSON.parse(localStorage.getItem(STATE_KEY));
      if (raw && typeof raw === 'object') {
        const d = defaultState();
        return {
          ...d,
          ...raw,
          settings: {...d.settings, ...(raw.settings || {})},
          progress: raw.progress || {},
          wrongBook: raw.wrongBook || {}
        };
      }
    } catch (_) {}
    return defaultState();
  }
  let S = loadState();
  function save() { try { localStorage.setItem(STATE_KEY, JSON.stringify(S)); } catch (_) {} }

  // ---------- themes（6 皮肤 + 动态背景装饰） ----------
  const THEMES = ['strawberry','cloud','cream','matcha','night','candy'];
  const THEME_META = {
    strawberry:'#ffeef7', cloud:'#eaf5ff', cream:'#fff5e6',
    matcha:'#eef7e6', night:'#1c1638', candy:'#fff8fc'
  };
  const THEME_DECOR = { strawberry:'🌸', cloud:'🫧', cream:'✨', matcha:'🍃', night:'⭐', candy:'🍬' };
  function applyTheme(t) {
    if (!THEMES.includes(t)) t = 'strawberry';
    document.body.setAttribute('data-theme', t);
    S.settings.theme = t; save();
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_META[t] || '#ffeef7');
    buildThemeDecor(t);
    $$('[data-theme-opt]').forEach(b => b.classList.toggle('on', b.dataset.themeOpt === t));
  }
  function buildThemeDecor(t) {
    const bg = $('#bg');
    if (!bg) return;
    bg.querySelectorAll('.bg-deco').forEach(el => el.remove());
    const emoji = THEME_DECOR[t] || '🌸';
    const n = lowPerfNow() ? 3 : (t === 'night' ? 14 : 10);
    for (let i = 0; i < n; i++) {
      const s = document.createElement('span');
      s.className = 'bg-deco' + (t === 'night' ? ' twinkle' : '');
      s.textContent = emoji;
      if (t === 'night') {
        s.style.left = (Math.random() * 94) + '%';
        s.style.top = (Math.random() * 55) + '%';
        s.style.fontSize = (10 + Math.random() * 10) + 'px';
        s.style.animationDuration = (2.2 + Math.random() * 2.6) + 's';
      } else {
        s.style.left = (Math.random() * 94) + '%';
        s.style.fontSize = (11 + Math.random() * 10) + 'px';
        s.style.animationDuration = (9 + Math.random() * 9) + 's';
        s.style.animationDelay = (-Math.random() * 14) + 's';
      }
      bg.appendChild(s);
    }
  }
  // ---------- 低性能模式（自动检测 + 手动强制） ----------
  let perfState = 'auto';
  try { perfState = localStorage.getItem('roots_perf') || 'auto'; } catch (_) {}
  function detectLowPerf() {
    try {
      const mem = navigator.deviceMemory || 99;
      const cores = navigator.hardwareConcurrency || 99;
      return mem <= 2 || cores <= 4;
    } catch (_) { return false; }
  }
  function lowPerfNow() {
    return perfState === 'on' ? true : perfState === 'off' ? false : detectLowPerf();
  }
  function applyLowPerf() { document.body.classList.toggle('low-perf', lowPerfNow()); }
  function syncPerfBtn() {
    const labels = { auto: '自动', on: '开', off: '关' };
    if ($('#perfBtn')) $('#perfBtn').textContent = labels[perfState] || '自动';
  }

  // ---------- speech ----------
  let voices = [];
  // ---------- cute interface sound effects (Web Audio, no external files) ----------
  const SFX = (() => {
    let ctx=null, master=null;
    function enabled(){ return S.settings.sfx !== false; }
    function ensure(){
      if (!enabled()) return false;
      try {
        if (!ctx) {
          const AC=window.AudioContext || window.webkitAudioContext;
          if (!AC) return false;
          ctx=new AC(); master=ctx.createGain(); master.gain.value=.49; master.connect(ctx.destination); // 整体音量：用户要求 +45%
        }
        if (ctx.state==='suspended') ctx.resume();
        return true;
      } catch(e){ return false; }
    }
    function tone(freq,delay,dur,opt={}){
      if(!ensure()) return;
      try{
        const t0=ctx.currentTime+delay, osc=ctx.createOscillator(), g=ctx.createGain();
        osc.type=opt.type||'sine'; osc.frequency.setValueAtTime(freq,t0);
        if(opt.slide) osc.frequency.exponentialRampToValueAtTime(opt.slide,t0+dur);
        g.gain.setValueAtTime(.0001,t0); g.gain.exponentialRampToValueAtTime(opt.vol??.11,t0+.012); g.gain.exponentialRampToValueAtTime(.0001,t0+dur);
        osc.connect(g); g.connect(master); osc.start(t0); osc.stop(t0+dur+.04);
      }catch(e){}
    }
    function noise(delay=.0,dur=.1,vol=.035){
      if(!ensure()) return;
      try{
        const t0=ctx.currentTime+delay, len=Math.max(1,Math.floor(ctx.sampleRate*dur));
        const buf=ctx.createBuffer(1,len,ctx.sampleRate), data=buf.getChannelData(0);
        for(let i=0;i<len;i++) data[i]=(Math.random()*2-1)*(1-i/len);
        const src=ctx.createBufferSource(), bp=ctx.createBiquadFilter(), g=ctx.createGain();
        src.buffer=buf; bp.type='bandpass'; bp.frequency.value=2100; bp.Q.value=.9;
        g.gain.setValueAtTime(vol,t0); g.gain.exponentialRampToValueAtTime(.0001,t0+dur);
        src.connect(bp); bp.connect(g); g.connect(master); src.start(t0); src.stop(t0+dur);
      }catch(e){}
    }
    const sounds={
      tap(){ tone(920,0,.055,{vol:.075,slide:1280}); },
      pop(){ tone(1180,0,.06,{vol:.085,slide:1720}); },
      flip(){ noise(0,.07,.028); noise(.07,.09,.02); tone(620,0,.09,{type:'triangle',vol:.07,slide:980}); },
      reveal(){ tone(659,0,.1,{vol:.10}); tone(988,.06,.18,{vol:.09}); tone(1319,.11,.22,{vol:.05}); },
      known(){ [523,587,659,784,880,1047].forEach((n,i)=>tone(n,i*.07,.22,{vol:.12})); tone(1568,.45,.34,{vol:.06}); tone(2093,.5,.3,{vol:.03}); },
      fuzzy(){ tone(587,0,.11,{vol:.09}); tone(784,.065,.16,{vol:.075}); },
      unknown(){ tone(415,0,.15,{vol:.085,slide:330}); tone(294,.1,.25,{vol:.07,slide:225}); },
      combo(n){ const notes=[523,659,784,988,1175,1319,1568]; const base=clamp((n||2)-2,0,5); for(let i=0;i<3;i++){ tone(notes[Math.min(base+i*2,notes.length-1)],i*.07,.18,{vol:.11}); } },
      whoosh(){ noise(0,.16,.03); tone(340,0,.16,{vol:.055,slide:780}); },
      whooshOpen(){ tone(320,0,.18,{vol:.055,slide:760}); },
      whooshClose(){ tone(760,0,.18,{vol:.055,slide:320}); },
      complete(){ [523,587,659,784,880,1047].forEach((n,i)=>tone(n,i*.07,.28,{vol:.085})); tone(1568,.48,.62,{vol:.05}); },
      toggleOn(){ tone(659,0,.09,{vol:.09}); tone(988,.055,.16,{vol:.075}); },
      toggleOff(){ tone(520,0,.1,{vol:.065,slide:360}); },
      theme(){ [1046.5,1318.51,1567.98,2093].forEach((n,i)=>tone(n,i*.055,.35-i*.05,{vol:.09-i*.015})); tone(261.63,0,.5,{vol:.05}); }
    };
    function play(name){ if(!enabled()) return; (sounds[name]||sounds.tap)?.(); }
    return {ensure,play};
  })();

  let audioUnlocked = false;
  let lastAutoSpokenToken = ''; // prevent replay when merely returning to the same card
  let lastSpeakStart = 0; // guard against overlapping utterances garbling each other
  function loadVoices() { if ('speechSynthesis' in window) voices = speechSynthesis.getVoices() || []; }
  if ('speechSynthesis' in window) {
    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;
  }
  function unlockAudio() {
    audioUnlocked = true;
    if (!('speechSynthesis' in window)) return;
    try {
      const u = new SpeechSynthesisUtterance('');
      u.volume = 0;
      speechSynthesis.speak(u);
    } catch (_) {}
  }
  function speak(text, btn) {
    if (!text || !('speechSynthesis' in window)) return;
    try {
      lastSpeakStart = Date.now();
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = S.settings.accent || 'en-GB';
      u.rate = Number(S.settings.rate || 0.95);
      u.pitch = 1.0;
      // 优先选 Google TTS 音色（国产浏览器自带引擎音质差、易变声）；找不到再退回同口音任意音色
      const wanted = u.lang.toLowerCase();
      const exact = voices.filter(v => (v.lang || '').toLowerCase() === wanted);
      const prefix = voices.filter(v => (v.lang || '').toLowerCase().startsWith(wanted.slice(0,2)));
      const anyEn = voices.filter(v => /^en/i.test(v.lang || ''));
      const best = list => list.find(v => /google/i.test(v.name || '')) || list.find(v => !/xiaoxiao|xiaoyi|huihui|kangkang/i.test(v.name || '')) || list[0];
      const voice = best(exact) || best(prefix) || best(anyEn);
      if (voice) u.voice = voice;
      if (btn) {
        btn.classList.add('speaking');
        const clear = () => btn.classList.remove('speaking');
        u.onend = clear; u.onerror = clear; setTimeout(clear, 2800);
      }
      speechSynthesis.speak(u);
    } catch (_) {}
  }

  // ---------- daily queue ----------
  function freshPool(phase) {
    return WORDS.filter(w => w.tier === phase && !S.progress[w.id]);
  }
  function duePool() {
    const now = Date.now();
    return WORDS.filter(w => {
      const p = S.progress[w.id];
      return p && Number(p.due || 0) <= now;
    }).sort((a,b) => (S.progress[a.id].due || 0) - (S.progress[b.id].due || 0));
  }
  function interleave(reviewItems, newItems) {
    const out=[]; let r=0,n=0;
    while (r < reviewItems.length || n < newItems.length) {
      // Three new cards, then one review. If one side is empty, consume the other.
      for (let i=0;i<3 && n<newItems.length;i++) out.push(newItems[n++]);
      if (r<reviewItems.length) out.push(reviewItems[r++]);
      if (n>=newItems.length && r<reviewItems.length) out.push(reviewItems[r++]);
    }
    return out;
  }
  function makeToday() {
    const date = todayKey();
    const due = duePool().slice(0, MAX_DAILY_REVIEWS);
    const fresh = freshPool(S.settings.phase).slice(0, S.settings.goal);
    const reviews = due.map(w => ({id:w.id, kind:'review', original:true}));
    const newCards = fresh.map(w => ({id:w.id, kind:'new', original:true}));
    return {
      date,
      queue: interleave(reviews,newCards),
      cursor: 0,
      targets: { new: newCards.length, review: reviews.length },
      done: { new:0, review:0 },
      retryCount: {},
      grades: { known:0, fuzzy:0, unknown:0 },
      wrongIds: [],
      extraNew: 0,
      startedAt: Date.now()
    };
  }
  function ensureToday() {
    if (!S.today || S.today.date !== todayKey() || !Array.isArray(S.today.queue)) {
      S.today = makeToday();
      save();
    }
    // Remove entries whose data no longer exists after a lexicon update.
    S.today.queue = S.today.queue.filter(x => BY_ID[x.id]);
    S.today.retryCount ||= {};
    S.today.grades ||= {known:0,fuzzy:0,unknown:0};
    S.today.wrongIds ||= [];
    S.today.startedAt ||= Date.now();
  }
  function updateStreakOnStudy() {
    const t=todayKey();
    if (S.lastStudyDate === t) return;
    if (!S.lastStudyDate) S.streak = 1;
    else S.streak = dayDiff(S.lastStudyDate,t) === 1 ? (S.streak || 0)+1 : 1;
    S.lastStudyDate=t;
  }
  function appendRetry(item, grade) {
    const id=item.id;
    const count=S.today.retryCount[id] || 0;
    const limit=grade==='unknown' ? 2 : 1;
    if (count >= limit) return;
    S.today.retryCount[id]=count+1;
    const retry={id,kind:'retry',original:false};
    // Put it several cards later, not immediately; finite max retries prevents an endless session.
    const insertAt=Math.min(S.today.cursor + 5, S.today.queue.length);
    S.today.queue.splice(insertAt,0,retry);
  }
  function gradeCurrent(kind, opts={}) {
    ensureToday();
    const item=S.today.queue[S.today.cursor];
    if (!item) return;
    const w=BY_ID[item.id];
    const p=S.progress[w.id] || (S.progress[w.id]={box:0,due:0,right:0,wrong:0,seen:0});
    updateStreakOnStudy();

    if (kind==='known') {
      p.box=clamp((p.box || 1)+1,2,INTERVALS.length-1);
      p.right=(p.right||0)+1;
      p.due=Date.now()+INTERVALS[p.box];
    } else if (kind==='fuzzy') {
      p.box=1;
      p.right=(p.right||0)+1;
      p.due=Date.now()+INTERVALS[1];
      appendRetry(item,kind);
    } else {
      p.box=0;
      p.wrong=(p.wrong||0)+1;
      p.due=Date.now()+INTERVALS[0];
      S.wrongBook[w.id]=(S.wrongBook[w.id]||0)+1;
      if (!S.today.wrongIds.includes(w.id)) S.today.wrongIds.push(w.id);
      appendRetry(item,kind);
    }
    p.seen=(p.seen||0)+1;
    p.lastGrade=kind;
    p.lastSeen=Date.now();
    S.today.grades[kind]=(S.today.grades[kind]||0)+1;
    if (item.original && (item.kind==='new' || item.kind==='review')) S.today.done[item.kind]++;
    S.today.cursor++;
    save();
    if(opts.sound!==false) SFX.play(kind==='known'?'known':kind==='fuzzy'?'fuzzy':'unknown');
    animateOutThenRender(kind, opts.delay);
  }
  function appendExtraNew(count=10) {
    const queued=new Set(S.today.queue.map(x=>x.id));
    const fresh=freshPool(S.settings.phase).filter(w=>!queued.has(w.id)).slice(0,count);
    fresh.forEach(w=>S.today.queue.push({id:w.id,kind:'new',original:true}));
    S.today.targets.new += fresh.length;
    S.today.extraNew += fresh.length;
    save(); renderLearn();
  }

  // ---------- views ----------
  let currentView='learn';
  function switchView(view) {
    currentView=view;
    $$('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${view}`));
    $$('.tab').forEach(t=>t.classList.toggle('active',t.dataset.view===view));
    if (view==='learn') renderLearn();
    if (view==='lexicon') { renderLexicon(); renderStructureMap(); }
    if (view==='quiz') renderQuiz();
    if (view==='me') renderMe();
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function brief(s='') {
    return String(s).replace(/`/g,'').split(/[；。]/)[0].trim();
  }
  function piece(label, meaning, cls) {
    if (!label) return '';
    return `<span class="piece ${cls}">${esc(label)}<small>${esc(brief(meaning) || (cls==='root'?'核心':'结构线索'))}</small></span>`;
  }
  function decompHtml(w) {
    const parts=[];
    if (w.prefix) parts.push(piece(w.prefix,w.prefixMeaning,'pre'));
    if (w.root) parts.push(piece(w.root,w.rootMeaning,'root'));
    if (w.suffix) parts.push(piece(w.suffix,w.suffixMeaning,'suf'));
    if (!parts.length) return piece('WHOLE', '整体记忆 · 不强拆', 'root');
    return parts.join('<span class="plus">＋</span>');
  }
  function derivation(w) {
    const bits=[];
    if (w.prefix) bits.push(`${w.prefix}${w.prefixMeaning ? `（${brief(w.prefixMeaning)}）` : ''}`);
    if (w.root) bits.push(`${w.root}${w.rootMeaning ? `（${brief(w.rootMeaning)}）` : ''}`);
    if (w.suffix) bits.push(`${w.suffix}${w.suffixMeaning ? `（${brief(w.suffixMeaning)}）` : ''}`);
    if (!bits.length) return `这个词不适合为了记忆而硬拆。先把整体词义与具体语境绑定：${w.meaning}。`;
    return `${bits.join(' + ')} → ${w.meaning}`;
  }

  function relatedWords(w) {
    const score=x=>{
      let n=0;
      if (w.root && x.root===w.root) n+=5;
      if (w.prefix && x.prefix===w.prefix) n+=2;
      if (w.suffix && x.suffix===w.suffix) n+=1;
      if (x.tier==='Core') n+=.25;
      return n;
    };
    return WORDS.filter(x=>x.id!==w.id && score(x)>0)
      .sort((a,b)=>score(b)-score(a) || a.word.localeCompare(b.word))
      .slice(0,6);
  }
  function confusingWords(w) {
    return (CONFUSABLES[w.word.toLowerCase()] || []).map(byWordText).filter(Boolean);
  }

  // ---------- v0.5 · 阅读辅助 / 假搭配过滤 / 生词点查 / 特效 ----------
  const JUNK_COLLOC = [
    /\bin academic research$/i,
    /\bpattern or effect$/i,
    /\bdifferent$/i,
    /^academic use of\b/i,
    /\bevidence or data$/i,
    /\bunder conditions$/i
  ];
  function collocOk(c) {
    return !!c && !JUNK_COLLOC.some(re => re.test(c));
  }
  function boldFirst(s) {
    const m = String(s).match(/[A-Za-z]/);
    if (!m) return esc(s);
    const i = s.indexOf(m[0]);
    return esc(s.slice(0, i)) + `<b class="first-letter">${esc(m[0])}</b>` + esc(s.slice(i + 1));
  }
  /* 按 前缀/词根/后缀 边界给单词分色；顺序必须为 前缀→词根→剩余→后缀 */
  function wordHtml(w) {
    const word = w.word;
    const lower = word.toLowerCase();
    const parts = [];
    let rest = word;
    let restLower = lower;
    let sufTxt = null;
    if (w.suffix) {
      const s = w.suffix.replace(/^[-–]\s*/, '');
      if (s && restLower.length > s.length && restLower.slice(-s.length) === s.toLowerCase()) {
        sufTxt = rest.slice(-s.length);
        rest = rest.slice(0, rest.length - s.length);
        restLower = restLower.slice(0, restLower.length - s.length);
      }
    }
    if (w.prefix) {
      const p = w.prefix.replace(/\s*[-–]$/, '');
      if (p && restLower.length > p.length && restLower.slice(0, p.length) === p.toLowerCase()) {
        parts.push({ txt: rest.slice(0, p.length), cls: 'pre' });
        rest = rest.slice(p.length);
        restLower = restLower.slice(p.length);
      }
    }
    if (w.root && rest) {
      const r = w.root.replace(/^[-–]\s*/, '').replace(/\s*[-–].*$/, '');
      if (r) {
        const idx = restLower.indexOf(r.toLowerCase());
        if (idx >= 0 && r.length > 0 && idx + r.length <= rest.length) {
          if (idx > 0) parts.push({ txt: rest.slice(0, idx), cls: '' });
          parts.push({ txt: rest.slice(idx, idx + r.length), cls: 'root' });
          rest = rest.slice(idx + r.length);
        }
      }
    }
    if (rest) parts.push({ txt: rest, cls: '' });
    if (sufTxt) parts.push({ txt: sufTxt, cls: 'suf' });
    const hasColor = parts.some(x => x.cls);
    if (!hasColor) return esc(word);
    return parts.map(x => x.cls ? `<span class="syl-${x.cls}">${esc(x.txt)}</span>` : `<span>${esc(x.txt)}</span>`).join('');
  }
  /* 正面提示：裁掉“→ 中文义”结尾，避免剧透答案 */
  function frontMnemonic(w) {
    const m = w.mnemonic || '';
    const segs = w.meaning.split(/[；;，,]/).map(s => s.trim()).filter(s => s.length >= 2);
    const idx = m.lastIndexOf('→');
    if (idx > 0) {
      const tail = m.slice(idx + 1).replace(/[\s；;，,。．.!！?？]/g, '');
      if (segs.some(seg => tail.indexOf(seg) !== -1)) {
        return m.slice(0, idx).replace(/[\s→]*$/, '') + '…';
      }
    }
    return m;
  }
  /* 例句：逐词可点 + 句首字母加粗 */
  function exampleHtml(example) {
    const toks = String(example).match(/\S+\s*/g) || [String(example)];
    return toks.map((tok, i) => {
      const m = tok.match(/[A-Za-z][A-Za-z'’-]*/);
      const w = m ? m[0].toLowerCase() : '';
      const inner = i === 0 ? boldFirst(tok) : esc(tok);
      return `<span class="w-tap" data-w="${esc(w)}">${inner}</span>`;
    }).join('');
  }
  /* 粒子助手（低性能模式削减） */
  function spawnSparks() {
    if (lowPerfNow()) return;
    const stage = $('#stage');
    if (!stage) return;
    const emojis = ['✨','⭐','💫','🌟'];
    for (let i = 0; i < 7; i++) {
      const s = document.createElement('span');
      s.className = 'spark';
      s.textContent = emojis[i % emojis.length];
      s.style.left = (30 + Math.random() * 40) + '%';
      s.style.top = (20 + Math.random() * 50) + '%';
      s.style.setProperty('--dx', ((Math.random() - 0.5) * 140) + 'px');
      s.style.setProperty('--dy', ((Math.random() - 0.6) * 120) + 'px');
      s.style.setProperty('--rot', ((Math.random() - 0.5) * 220) + 'deg');
      stage.appendChild(s);
      s.addEventListener('animationend', () => s.remove());
    }
  }
  /* 答对强化：屏幕中央大 emoji + 彩带雨 */
  function spawnBigEmoji(emoji) {
    const el = document.createElement('div');
    el.className = 'big-emoji';
    el.textContent = emoji;
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }
  function spawnConfetti() {
    const n = lowPerfNow() ? 6 : 14;
    const colors = ['#ff8fba', '#b9a3ff', '#69d7bf', '#ffd66e', '#8bbcff'];
    for (let i = 0; i < n; i++) {
      const c = document.createElement('span');
      c.className = 'confetti';
      c.style.left = (Math.random() * 100) + '%';
      c.style.background = colors[i % colors.length];
      c.style.animationDelay = (Math.random() * 0.35) + 's';
      c.style.animationDuration = (1.1 + Math.random() * 0.7) + 's';
      document.body.appendChild(c);
      c.addEventListener('animationend', () => c.remove());
    }
  }
  function spawnBurst(x, y, emoji) {
    const n = lowPerfNow() ? 4 : 9;
    for (let i = 0; i < n; i++) {
      const b = document.createElement('span');
      b.className = 'burst';
      b.textContent = emoji;
      b.style.left = x + 'px';
      b.style.top = y + 'px';
      const ang = (Math.PI * 2 * i) / n + Math.random() * 0.6;
      const dist = 60 + Math.random() * 60;
      b.style.setProperty('--dx', (Math.cos(ang) * dist) + 'px');
      b.style.setProperty('--dy', (Math.sin(ang) * dist - 40) + 'px');
      b.style.setProperty('--rot', ((Math.random() - 0.5) * 260) + 'deg');
      document.body.appendChild(b);
      b.addEventListener('animationend', () => b.remove());
    }
  }
  /* 生词点查气泡：本地 5000 词库 → 联网英英词典 → 离线仅发音 */
  let wordPopEl = null;
  function closeWordPop() {
    if (wordPopEl) { wordPopEl.remove(); wordPopEl = null; }
  }
  function positionPop(el, span) {
    const rect = span.getBoundingClientRect();
    const w = el.offsetWidth, h = el.offsetHeight;
    const x = Math.min(Math.max(rect.left + rect.width / 2 - w / 2, 8), window.innerWidth - w - 8);
    const y = rect.top - h - 10 < 8 ? rect.bottom + 10 : rect.top - h - 10;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
  }
  function lookupWord(word, cb) {
    const local = WORDS.find(x => x.word.toLowerCase() === word);
    if (local) { cb({ pos: local.pos, def: local.meaning }); return; }
    try {
      fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(word))
        .then(r => r.ok ? r.json() : Promise.reject(r.status))
        .then(j => {
          const first = (j[0] && j[0].meanings && j[0].meanings[0]) || null;
          if (first && first.definitions && first.definitions[0]) {
            cb({ pos: first.partOfSpeech || '', def: '(英) ' + first.definitions[0].definition });
          } else {
            cb({ pos: '', def: '未找到释义' });
          }
        })
        .catch(() => cb({ pos: '', def: '离线：仅支持发音' }));
    } catch (_) { cb({ pos: '', def: '离线：仅支持发音' }); }
  }
  function showWordPop(word, span) {
    closeWordPop();
    const el = document.createElement('div');
    el.className = 'word-pop';
    el.innerHTML = `<div class="wp-head"><b>${esc(word)}</b><button type="button" data-pop-say>🔊</button><button type="button" class="wp-close" data-pop-close>✕</button></div><div class="wp-pos">查词中…</div><div class="wp-def"></div>`;
    document.body.appendChild(el);
    positionPop(el, span);
    el.querySelector('[data-pop-say]').addEventListener('click', ev => {
      ev.stopPropagation(); unlockAudio(); speak(word, ev.currentTarget);
    });
    el.querySelector('[data-pop-close]').addEventListener('click', ev => {
      ev.stopPropagation(); closeWordPop();
    });
    wordPopEl = el;
    lookupWord(word, res => {
      if (!wordPopEl) return;
      el.querySelector('.wp-pos').textContent = res.pos || '';
      el.querySelector('.wp-def').textContent = res.def || '';
      positionPop(el, span);
    });
  }
  document.addEventListener('pointerdown', e => {
    if (wordPopEl && !wordPopEl.contains(e.target)) closeWordPop();
  });
  window.addEventListener('scroll', closeWordPop);
  /* 连击系统 */
  let combo = 0;
  function setCombo(n) {
    combo = n;
    const badge = $('#comboBadge');
    if (!badge) return;
    if (combo >= 2) {
      badge.textContent = '🔥 x' + combo;
      badge.classList.remove('on'); void badge.offsetWidth;
      badge.classList.add('on');
      SFX.play('combo');
      if (combo >= 3) {
        const face = $('#cardInner')?.closest('.flashcard')?.querySelector('.card-front');
        if (face) {
          face.classList.add('combo-glow');
          setTimeout(() => face.classList.remove('combo-glow'), 1500);
        }
      }
    } else {
      badge.classList.remove('on');
    }
  }
  function syncComboBadge() {
    const badge = $('#comboBadge');
    if (!badge || combo < 2) return;
    badge.textContent = '🔥 x' + combo;
    badge.classList.add('on');
  }
  function renderRhythm() {
    const box=$('#rhythmStrip');
    if(!box || !S.today) return;
    const upcoming=S.today.queue.slice(S.today.cursor,S.today.cursor+8);
    if(!upcoming.length){box.innerHTML='';return;}
    box.innerHTML=`<span class="rhythm-label">接下来</span>${upcoming.map((x,i)=>`<span class="rhythm-dot ${x.kind}" title="${x.kind==='new'?'新词':x.kind==='review'?'复习':'重现'}">${i===0?'●':'•'}</span>`).join('')}<span class="rhythm-note">粉=新词 · 紫=复习 · 黄=重现</span>`;
  }

  function renderProgress() {
    ensureToday();
    const t=S.today;
    $('#daySub').textContent=`新词 ${t.done.new} / ${t.targets.new} · 复习 ${t.done.review} / ${t.targets.review}`;
    $('#goalBtn').textContent=`${S.settings.goal} 新词 ▾`;
    const total=t.targets.new+t.targets.review;
    const done=t.done.new+t.done.review;
    const pct=total ? Math.round(done/total*100) : 100;
    $('#progressFill').style.width=`${pct}%`;
    $('#progressPct').textContent=`${pct}%`;
    $('#streakNum').textContent=S.streak || 1;
    renderRhythm();
  }

  function renderLearn() {
    ensureToday(); renderProgress();
    const item=S.today.queue[S.today.cursor];
    if (!item) { renderDone(); return; }
    const w=BY_ID[item.id];
    renderCard(w,item);
    renderFamilySide(w);
  }

  function renderCard(w,item) {
    const stage=$('#stage');
    const related=relatedWords(w);
    const confusables=confusingWords(w);
    const frontHint = (w.prefix || w.root || w.suffix)
      ? `<strong>💭 先自己推：</strong><br>${esc(frontMnemonic(w))}`
      : `<strong>💭 整体记忆词：</strong>先回想与它绑定的场景，再翻面验证。`;
    const collocBlock = collocOk(w.collocation)
      ? `<div class="info-block"><div class="info-title">📎 常见搭配</div><p>${esc(w.collocation)}</p></div>`
      : '';
    const cnToggle = w.exampleZh
      ? `<div class="cn-toggle" data-cn-toggle>🀄 点按显示中文 · 点句中的词可查义</div><p class="b-cn2" hidden>🀄 ${esc(w.exampleZh)}</p>`
      : '';
    stage.innerHTML=`
      <article class="flashcard" id="flashcard" tabindex="0" aria-label="${esc(w.word)} 单词卡，点击翻面">
        <div class="card-inner" id="cardInner">
        <section class="card-face card-front">
          <div class="word-row"><h2 class="word">${wordHtml(w)}</h2><button class="speak-btn" data-speak-word aria-label="朗读 ${esc(w.word)}">🔊</button></div>
          <div class="ipa">${esc(w.ipa || 'IPA 待词库校订')} <span class="ipos">· ${esc(w.pos)}</span></div>
          <div class="decomp">${decompHtml(w)}</div>
          <div class="mnemonic" data-mn-toggle><span class="mn-clamp">${frontHint}</span><span class="mn-hint">▾ 点按展开</span></div>
          <div class="flip-hint">点卡片翻面 · 先猜，再验证</div>
        </section>
        <section class="card-face card-back">
          <div class="back-toolbar"><button class="back-to-front" id="backToFront" type="button">↩ 正面</button><span>慢慢看，确认后再评分</span></div>
          <div class="answer-head"><div class="word-small">${esc(w.word)} · ${esc(w.pos)}</div><div class="meaning">${esc(w.meaning)}</div></div>
          <div class="tier-badges">
            <span class="tier-badge ${w.tier==='Core'?'core':'reading'}">${w.tier==='Core'?'🎓 Core · 深度掌握':'📖 Reading · 阅读识别'}</span>
            <span class="tier-badge conf">${esc(w.confidence || '○ 整体记忆')}</span>
          </div>
          <div class="info-block"><div class="info-title">🧠 推导 / 结构</div><p>${esc(derivation(w))}</p></div>
          <div class="info-block example-block"><div class="info-title">📖 IELTS 阅读式例句</div><p class="example-en">${w.example ? exampleHtml(w.example) : '例句待词库精修'}</p>${cnToggle}<p class="example-key"><b>本词在句中：</b>${esc(w.word)} → ${esc(w.meaning)}</p><div class="example-actions"><button class="mini-speak" data-speak-example>🔊 读例句</button></div></div>
          ${collocBlock}
          <details class="details"><summary>展开更多</summary><div class="detail-body">
            <div class="detail-row"><span>学习目标</span><div>${w.tier==='Core'?'词源 + 构词 + 搭配 + 输出，深度掌握':'见词识义即可，不强制拆解'}</div></div>
            <div class="detail-row"><span>前缀</span><div>${esc(w.prefix ? `${w.prefix} · ${w.prefixMeaning || ''}` : '—')}</div></div>
            <div class="detail-row"><span>词根</span><div>${esc(w.root ? `${w.root} · ${w.rootMeaning || ''}` : (w.rootMeaning || '整体记忆'))}</div></div>
            <div class="detail-row"><span>后缀</span><div>${esc(w.suffix ? `${w.suffix} · ${w.suffixMeaning || ''}` : '—')}</div></div>
            ${related.length?`<div class="detail-stack"><span>词族联动 · 点词发音</span><div class="word-chip-row">${related.map(x=>`<button class="word-chip" data-related-speak="${x.id}" title="${esc(x.meaning)}"><b>${esc(x.word)}</b><i>${esc(brief(x.meaning))}</i></button>`).join('')}</div></div>`:''}
            ${confusables.length?`<div class="detail-stack warn"><span>易混提醒</span><div>${confusables.map(x=>`<b>${esc(x.word)}</b> · ${esc(x.meaning)}`).join('<br>')}</div></div>`:''}
          </div></details>
          <div class="flip-hint back-hint">轻点卡片返回正面 🔙 · 确认后再评分</div>
        </section>
        </div>
        <div class="combo" id="comboBadge">🔥</div>
        <div class="swipe-cue left" id="swipeLeft">🥲 不会</div>
        <div class="swipe-cue right" id="swipeRight">😊 会了</div>
      </article>`;

    $('#verdict').innerHTML=`<button class="flip-btn" id="flipBtn" data-sfx="reveal">👀 看看答案</button>`;
    const card=$('#flashcard');
    const cardInner=$('#cardInner');
    let flipped=false, revealReadyAt=0, gradingLocked=false;
    const setFlip=(value,{fromReveal=false}={}) => {
      if(gradingLocked || flipped===value) return;
      closeWordPop();
      flipped=value;
      card.classList.toggle('is-flipped',flipped);
      cardInner?.classList.toggle('flipped',flipped);
      spawnSparks();
      if(flipped){
        revealReadyAt=Date.now()+850; // let the card settle before swipe / accidental gestures
        SFX.play(fromReveal?'reveal':'flip');
      } else {
        SFX.play('flip');
      }
      renderVerdict(flipped, {delayed:flipped});
    };
    // 正面点击翻面；背面点击空白翻回（按钮/展开区/点词区不误触）
    card.addEventListener('click',e=>{
      if(gradingLocked) return;
      if(dragMoved){ dragMoved=false; return; } // 滑动后的残余 click 不算点击，避免误翻面
      if(e.target.closest('button,summary,details,.w-tap,.cn-toggle,.mnemonic')) return;
      setFlip(!flipped,{fromReveal:false});
    });
    card.addEventListener('keydown',e=>{
      if((e.key==='Enter'||e.key===' ') && !gradingLocked){e.preventDefault();setFlip(!flipped,{fromReveal:false});}
    });
    // 3D 微动效：鼠标在卡片上移动时轻微倾斜（触屏跳过，避免抢滚动）
    const tiltCard=$('#stage');
    tiltCard.addEventListener('pointermove',e=>{
      if(e.pointerType!=='mouse' || flipped || gradingLocked) return;
      const r=tiltCard.getBoundingClientRect();
      const rx=(e.clientX-r.left)/r.width-.5;
      const ry=(e.clientY-r.top)/r.height-.5;
      card.style.transform=`translateZ(0) rotateY(${(rx*4).toFixed(2)}deg) rotateX(${(-ry*4).toFixed(2)}deg)`;
    });
    tiltCard.addEventListener('pointerleave',()=>{ card.style.transform='translateZ(0)'; });
    $('[data-speak-word]').addEventListener('click',e=>{e.stopPropagation();SFX.play('pop');unlockAudio();speak(w.word,e.currentTarget)});
    $('[data-speak-example]').addEventListener('click',e=>{e.stopPropagation();SFX.play('pop');unlockAudio();speak(w.example,e.currentTarget)});
    $$('[data-related-speak]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();SFX.play('pop');unlockAudio();const x=BY_ID[b.dataset.relatedSpeak];if(x)speak(x.word,b)}));
    // 例句中文点按显示/隐藏
    $('[data-cn-toggle]')?.addEventListener('click',function(e){
      e.stopPropagation();
      SFX.play('tap');
      const cn=$('.b-cn2');
      if(!cn) return;
      const show=cn.hidden;
      cn.hidden=!show;
      this.textContent=show?'🀄 点按隐藏中文':'🀄 点按显示中文 · 点句中的词可查义';
    });
    // 正面提示框：默认两行，点按展开/收起
    $('[data-mn-toggle]')?.addEventListener('click',function(e){
      e.stopPropagation();
      SFX.play('tap');
      const expanded = this.classList.toggle('expanded');
      const hint = this.querySelector('.mn-hint');
      if (hint) hint.textContent = expanded ? '▴ 收起' : '▾ 点按展开';
    });
    // 例句生词点查：点任意词 → 发音 + 词义气泡
    $('.example-en')?.addEventListener('click',e=>{
      const t=e.target.closest('.w-tap');
      if(!t || !t.dataset.w) return;
      e.stopPropagation();
      SFX.play('pop');
      unlockAudio();
      speak(t.dataset.w);
      showWordPop(t.dataset.w, t);
    });
    $('#flipBtn').addEventListener('click',e=>{e.stopPropagation();setFlip(true,{fromReveal:true});});
    $('#backToFront')?.addEventListener('click',e=>{e.stopPropagation();setFlip(false);});

    // Horizontal swipe is available only after the answer has visibly settled.
    let dragStartX=0, dragStartY=0, dragging=false, dragMoved=false;
    card.addEventListener('pointerdown',e=>{
      if(!flipped || gradingLocked || Date.now()<revealReadyAt || e.target.closest('button,summary,details')) return;
      dragging=true; dragMoved=false; dragStartX=e.clientX; dragStartY=e.clientY; card.setPointerCapture?.(e.pointerId);
    });
    card.addEventListener('pointermove',e=>{
      if(!dragging || !flipped || gradingLocked) return;
      const dx=e.clientX-dragStartX, dy=e.clientY-dragStartY;
      if(Math.abs(dx)<Math.abs(dy) || Math.abs(dx)<6) return;
      dragMoved = dragMoved || Math.abs(dx)>12;
      const limited=clamp(dx,-105,105);
      card.style.setProperty('--drag-x',`${limited}px`); card.style.setProperty('--drag-rot',`${limited/22}deg`); card.classList.add('is-dragging');
      $('#swipeLeft')?.classList.toggle('show',dx<-34); $('#swipeRight')?.classList.toggle('show',dx>34);
    });
    const finishSwipe=e=>{
      if(!dragging) return; dragging=false;
      const dx=e.clientX-dragStartX, dy=e.clientY-dragStartY;
      card.classList.remove('is-dragging'); card.style.removeProperty('--drag-x'); card.style.removeProperty('--drag-rot');
      $('#swipeLeft')?.classList.remove('show'); $('#swipeRight')?.classList.remove('show');
      if(flipped && !gradingLocked && Date.now()>=revealReadyAt && Math.abs(dx)>72 && Math.abs(dx)>Math.abs(dy)*1.3){
        gradeWithFeedback(dx>0?'known':'unknown', w.word);
      }
    };
    card.addEventListener('pointerup',finishSwipe);
    card.addEventListener('pointercancel',()=>{dragging=false;card.classList.remove('is-dragging');card.style.removeProperty('--drag-x');card.style.removeProperty('--drag-rot')});

    function gradeWithFeedback(kind, wordText){
      if(gradingLocked) return;
      gradingLocked=true;
      closeWordPop();
      if(kind==='known') setCombo(combo+1);
      else if(kind==='unknown') setCombo(0);
      if(kind==='known'){
        // 答对强化：中央大 emoji + 彩带雨 + 卡面主题色光晕
        spawnBigEmoji('😎');
        spawnConfetti();
        const frontFace = card.querySelector('.card-front');
        if(frontFace){
          frontFace.classList.add('grade-glow');
          setTimeout(() => frontFace.classList.remove('grade-glow'), 1500);
        }
      }
      SFX.play(kind==='known'?'known':kind==='fuzzy'?'fuzzy':'unknown');
      const labels={known:'😊 已记下：会了',fuzzy:'🤔 已记下：模糊',unknown:'🥲 已记下：不会'};
      const box=$('#verdict');
      const btn=box.querySelector(`[data-grade="${kind}"]`);
      const rect=btn?btn.getBoundingClientRect():card.getBoundingClientRect();
      spawnBurst(rect.left+rect.width/2, rect.top+rect.height/2, kind==='known'?'😎':kind==='fuzzy'?'🤔':'💧');
      box.innerHTML=`<div class="grade-confirm ${kind}"><b>${labels[kind]}</b><small>${esc(wordText)} · 下一张马上来</small></div>`;
      card.classList.add(`grade-${kind}`);
      setTimeout(()=>gradeCurrent(kind,{sound:false,delay:210}),560);
    }
    card._gradeWithFeedback=gradeWithFeedback;
    syncComboBadge();
    const autoToken = `${S.today?.date || ''}:${S.today?.cursor || 0}:${item.id}:${item.kind}`;
    const recentSpeech = Date.now() - lastSpeakStart < 600; // 刚播过音就别抢，避免重叠变声
    if (audioUnlocked && S.settings.autoSpeak && autoToken !== lastAutoSpokenToken && !recentSpeech) {
      lastAutoSpokenToken = autoToken;
      setTimeout(()=>speak(w.word,$('[data-speak-word]')),240);
    }
  }

  function renderVerdict(flipped, opts={}) {
    const box=$('#verdict');
    box.classList.toggle('grading',!!flipped);
    if (!flipped) {
      box.innerHTML=`<button class="flip-btn" id="flipBtn" data-sfx="reveal">👀 看看答案</button>`;
      $('#flipBtn').addEventListener('click',e=>{ e.stopPropagation(); const card=$('#flashcard'); if(card) card.click(); });
      return;
    }
    // Let the 3D turn finish first, then softly bring in the decisions. They remain until the learner chooses.
    box.innerHTML=`<div class="answer-pause"><span>✨</span> 先看答案，不着急判断</div>`;
    const show=()=>{
      if(!$('#flashcard')?.classList.contains('is-flipped')) return;
      box.innerHTML=`<div class="verdict-row verdict-enter">
        <button class="grade unknown" data-grade="unknown" data-sfx="unknown">🥲 不会<small>本轮再出现</small></button>
        <button class="grade fuzzy" data-grade="fuzzy" data-sfx="fuzzy">🤔 模糊<small>稍后再来</small></button>
        <button class="grade known" data-grade="known" data-sfx="known">😊 我会了<small>拉长间隔</small></button>
      </div>`;
      $$('.grade').forEach(b=>b.addEventListener('click',()=>$('#flashcard')?._gradeWithFeedback?.(b.dataset.grade, BY_ID[S.today.queue[S.today.cursor]?.id]?.word || '')));
    };
    opts.delayed===false ? show() : setTimeout(show,650);
  }

  function animateOutThenRender(kind, delay=190) {
    const card=$('#flashcard');
    const x=kind==='known'?70:kind==='unknown'?-70:28;
    if (card && card.animate) card.animate([{opacity:1,transform:'translateX(0) scale(1)'},{opacity:0,transform:`translateX(${x}px) scale(.96)`}],{duration:220,easing:'ease-in'});
    setTimeout(renderLearn,delay);
  }

  function renderDone() {
    const t=S.today;
    const doneSoundKey=`${t.date}:${t.targets.new}:${t.targets.review}:done`;
    if(sessionStorage.getItem('roots_done_sfx')!==doneSoundKey){ SFX.play('complete'); sessionStorage.setItem('roots_done_sfx',doneSoundKey); }
    const totalGrades=t.grades.known+t.grades.fuzzy+t.grades.unknown;
    const accuracy=totalGrades ? Math.round(t.grades.known/totalGrades*100) : 100;
    const weakMap=new Map();
    (t.wrongIds||[]).forEach(id=>{
      const w=BY_ID[id]; if(!w)return;
      const key=w.root?`词根 ${w.root}`:w.prefix?`前缀 ${w.prefix}`:w.suffix?`后缀 ${w.suffix}`:'';
      if(key) weakMap.set(key,(weakMap.get(key)||0)+1);
    });
    const weak=Array.from(weakMap.entries()).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k])=>k);
    const weakHtml=weak.length?`<div class="done-weak"><span>今天需要再看：</span>${weak.map(k=>`<b>${esc(k)}</b>`).join('')}</div>`:'';
    const durationMin=Math.max(1,Math.round((Date.now()-(t.startedAt||Date.now()))/60000));
    // 未来 7 天到期复习预报（只显示数量，不施压）
    const now=Date.now();
    const dayBuckets=[0,0,0,0,0,0,0];
    Object.values(S.progress).forEach(p=>{
      const d=Number(p.due||0);
      if(d<=now) return;
      const days=Math.floor((d-now)/86400000);
      if(days>=0 && days<7) dayBuckets[days]++;
    });
    const forecast=dayBuckets.map((n,i)=>`D+${i+1} ${n}`).join(' · ');
    // 每周备份提醒（7 天一次，导出后重置）
    const backupDue = Date.now() - (S.backupRemindAt || 0) > 7 * 86400000;
    const backupLine = backupDue
      ? `<div class="done-weak" style="margin:4px 0 10px"><span>💾 学满一周啦，记得导出备份：</span><button class="secondary tiny" id="doneExportBtn">导出 JSON</button></div>`
      : '';
    $('#stage').innerHTML=`<div class="done-card"><span class="em">🌸</span><h3>今日任务完成</h3><p>新词和到期复习都已经收口。不会自动继续喂第 ${t.targets.new+1} 个新词。</p><div class="done-stats"><div class="done-stat"><b>${t.done.new}/${t.targets.new}</b><span>新词</span></div><div class="done-stat"><b>${t.done.review}/${t.targets.review}</b><span>复习</span></div><div class="done-stat"><b>${accuracy}%</b><span>本轮稳定度</span></div><div class="done-stat"><b>${durationMin}m</b><span>学习时长</span></div></div><div class="grade-summary"><span>😊 ${t.grades.known}</span><span>🤔 ${t.grades.fuzzy}</span><span>🥲 ${t.grades.unknown}</span></div><p class="muted" style="margin:2px 0 8px">⏰ 未来 7 天到期复习：${forecast}</p>${weakHtml}${backupLine}<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center"><button class="primary" id="extraBtn">＋额外学习 10 词</button><button class="secondary" data-view-go="quiz">做一轮 20 题</button></div></div>`;
    $('#doneExportBtn')?.addEventListener('click', () => { exportBackup(); renderDone(); });
    $('#verdict').innerHTML='';
    $('#familySide').innerHTML='';
    $('#extraBtn').addEventListener('click',()=>appendExtraNew(10));
    $('[data-view-go="quiz"]').addEventListener('click',()=>switchView('quiz'));
  }

  // ---------- family side / lexicon / structure maps ----------
  function familyCandidates(w) {
    let all=[]; let label=''; let meaning='';
    if (w.root) {
      all=WORDS.filter(x=>x.root===w.root); label=w.root; meaning=w.rootMeaning || '同词根家族';
    } else if (w.prefix) {
      all=WORDS.filter(x=>x.prefix===w.prefix); label=w.prefix; meaning=w.prefixMeaning || '同前缀家族';
    } else if (w.suffix) {
      all=WORDS.filter(x=>x.suffix===w.suffix); label=w.suffix; meaning=w.suffixMeaning || '同后缀家族';
    }
    if (!all.length) return {list:[],label:'',meaning:''};
    // Always keep the current word visible, even when the family is large.
    const current=all.find(x=>x.id===w.id);
    const others=all.filter(x=>x.id!==w.id).slice(0,7);
    return {list: current ? [current,...others] : all.slice(0,8), label, meaning};
  }
  function renderFamilySide(w) {
    const side=$('#familySide');
    const f=familyCandidates(w);
    if (!f.list.length) {
      side.innerHTML=`<div class="side-card"><div class="eyebrow">CURRENT WORD</div><h3>${esc(w.word)}</h3><p>这个词更适合整体记忆，不为了凑家族而强拆。</p></div>`;
      return;
    }
    side.innerHTML=`<div class="side-card"><div class="eyebrow">CURRENT FAMILY</div><h3>${esc(f.label)}</h3><p>${esc(f.meaning)}</p><div class="family-list">${f.list.map(x=>`<div class="family-word ${x.id===w.id?'current':''}"><span>${esc(x.word)}</span><span>${esc(x.meaning)}</span></div>`).join('')}</div></div>`;
  }

  let lexiconLetter='A';
  let lexiconTier='All';
  let browseMode='words';
  let structureMode='root';
  let structureGroupsCache={};
  const ALPHABET='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  function initAlphabetBar() {
    const box=$('#alphabetBar');
    if (!box || box.children.length) return;
    box.innerHTML=[`<button data-letter="ALL">全</button>`,...ALPHABET.map(l=>`<button data-letter="${l}">${l}</button>`)].join('');
    box.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{
      lexiconLetter=b.dataset.letter;
      renderLexicon();
    }));
  }
  function renderLexicon() {
    initAlphabetBar();
    const search=($('#lexiconSearch')?.value || '').trim().toLowerCase();
    let items=WORDS.filter(w=>{
      const tierOk=lexiconTier==='All' || w.tier===lexiconTier;
      const letterOk=search ? true : (lexiconLetter==='ALL' || w.letter===lexiconLetter);
      const searchOk=!search || w.word.toLowerCase().includes(search) || w.meaning.toLowerCase().includes(search);
      return tierOk && letterOk && searchOk;
    });
    $('#alphabetBar')?.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.letter===lexiconLetter));
    $$('[data-tier-filter]').forEach(b=>b.classList.toggle('active',b.dataset.tierFilter===lexiconTier));
    $('#lexiconCount').textContent=items.length;
    const shown=items.slice(0,260);
    $('#lexiconList').innerHTML=shown.map(w=>`<article class="lex-row" data-word-id="${w.id}">
      <div class="lex-main"><div class="lex-word">${esc(w.word)}</div><div class="lex-meta">${esc(w.pos)} · ${esc(w.ipa || 'IPA 待校订')} · ${esc(w.tier)}</div></div>
      <div class="lex-meaning">${esc(w.meaning)}</div>
      <div class="lex-structure">${esc([w.prefix,w.root,w.suffix].filter(Boolean).join(' + ') || 'WHOLE')}</div>
      <button class="lex-speak" data-lex-speak="${w.id}" aria-label="朗读 ${esc(w.word)}">🔊</button>
    </article>`).join('') + (items.length>shown.length?`<div class="list-note">当前显示前 ${shown.length} 条；可用字母或搜索继续缩小范围。</div>`:'');
    $$('[data-lex-speak]').forEach(b=>b.addEventListener('click',()=>{unlockAudio();const w=BY_ID[b.dataset.lexSpeak];if(w)speak(w.word,b)}));
  }

  function groupByField(field) {
    const map=new Map();
    WORDS.forEach(w=>{
      const key=w[field]; if (!key) return;
      if (!map.has(key)) map.set(key,[]);
      map.get(key).push(w);
    });
    return Array.from(map.entries()).map(([key,items])=>({key,items})).sort((a,b)=>b.items.length-a.items.length || a.key.localeCompare(b.key));
  }
  function mapCard(group, field) {
    const meaningField=field==='prefix'?'prefixMeaning':field==='root'?'rootMeaning':'suffixMeaning';
    const fallback=field==='prefix'?'同前缀家族':field==='root'?'同词根家族':'同后缀家族';
    const info=group.items.find(x=>x[meaningField])?.[meaningField] || fallback;
    const first=group.items.slice(0,5);
    const rest=group.items.slice(5,20);
    return `<article class="map-card"><h3>${esc(group.key)}</h3><div class="meta">${esc(info)} · ${group.items.length} 词</div><div class="sample">${first.map(x=>`${esc(x.word)} · ${esc(x.meaning)}`).join('<br>')}</div>${rest.length?`<button class="map-more">展开更多</button><div class="more">${rest.map(x=>`${esc(x.word)} · ${esc(x.meaning)}`).join('<br>')}</div>`:''}</article>`;
  }
  function bindMapCards(container) {
    container.querySelectorAll('.map-more').forEach(b=>b.addEventListener('click',()=>{
      const c=b.closest('.map-card'); const willOpen=!c.classList.contains('open'); c.classList.toggle('open'); b.textContent=c.classList.contains('open')?'收起':'展开更多'; SFX.play(willOpen?'whooshOpen':'whooshClose');
    }));
  }
  function renderStructureMap() {
    const field=structureMode;
    structureGroupsCache[field] ||= groupByField(field);
    const query=($('#structureSearch')?.value || '').trim().toLowerCase();
    const groups=structureGroupsCache[field].filter(g=>!query || g.key.toLowerCase().includes(query) || g.items.some(w=>w.word.toLowerCase().includes(query) || w.meaning.toLowerCase().includes(query))).slice(0,query?150:90);
    $$('[data-structure-mode]').forEach(b=>b.classList.toggle('active',b.dataset.structureMode===structureMode));
    $('#structureMap').innerHTML=groups.map(g=>mapCard(g,field)).join('') || '<p class="muted">没有匹配结果。</p>';
    bindMapCards($('#structureMap'));
  }

  // ---------- quiz ----------
  let quizMode='mix';
  let Q=null;
  function quizPool() {
    if (quizMode==='wrong') {
      const wrongIds=Object.entries(S.wrongBook).sort((a,b)=>b[1]-a[1]).map(([id])=>id);
      const wrongWords=wrongIds.map(id=>BY_ID[id]).filter(Boolean);
      if (wrongWords.length) return wrongWords;
    }
    const learned=WORDS.filter(w=>S.progress[w.id]?.seen>0);
    if (learned.length>=8) return learned;
    ensureToday();
    const todayWords=Array.from(new Set(S.today.queue.map(x=>x.id))).map(id=>BY_ID[id]).filter(Boolean);
    return todayWords.length>=8 ? todayWords : WORDS.filter(w=>w.tier==='Core').slice(0,80);
  }
  function shuffled(a) { const b=a.slice(); for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];} return b; }
  function startQuiz() { Q={index:0,right:0,total:20,locked:false}; renderQuiz(); }
  function quizType() {
    if (quizMode==='wrong') return ['meaning','structure','spell'][Q.index%3];
    if (quizMode!=='mix') return quizMode;
    return ['meaning','structure','spell'][Q.index%3];
  }
  function renderQuiz() {
    if (!Q) Q={index:0,right:0,total:20,locked:false};
    if (quizMode==='wrong' && !Object.keys(S.wrongBook).length) {
      $('#quizArea').innerHTML=`<div class="done-card"><span class="em">🌱</span><h3>错词本还是空的</h3><p>先去学习；答错的词会自动回流到这里。</p><button class="primary" data-view-go="learn">去学习</button></div>`;
      $('[data-view-go="learn"]')?.addEventListener('click',()=>switchView('learn'));
      return;
    }
    if (Q.index>=Q.total) {
      $('#quizArea').innerHTML=`<div class="done-card"><span class="em">✍️</span><h3>本轮测验完成</h3><p>正确 ${Q.right} / ${Q.total}。这一轮到这里结束。</p><button class="primary" id="quizAgain">再来 20 题</button></div>`;
      $('#quizAgain').addEventListener('click',startQuiz); return;
    }
    Q.locked=false;
    const pool=quizPool();
    const w=pool[Math.floor(Math.random()*pool.length)];
    const type=quizType();
    if (type==='spell') return drawSpell(w);
    drawChoice(w,type,pool);
  }
  function drawChoice(w,type,pool) {
    let distractors=shuffled(pool.filter(x=>x.id!==w.id && x.meaning!==w.meaning)).slice(0,3);
    if (distractors.length<3) {
      const used=new Set([w.id,...distractors.map(x=>x.id)]);
      distractors=distractors.concat(shuffled(WORDS.filter(x=>x.tier==='Core' && !used.has(x.id) && x.meaning!==w.meaning)).slice(0,3-distractors.length));
    }
    const opts=shuffled([w,...distractors]);
    const prompt=type==='structure'?'根据构词线索选择词义':'选择最合适的中文义';
    const big=type==='structure' ? [w.prefix,w.root,w.suffix].filter(Boolean).join(' + ') || w.word : w.word;
    const sub=type==='structure' ? `${w.confidence}` : `${w.ipa || ''} · ${w.pos}`;
    $('#quizArea').innerHTML=`<div class="quiz-card"><div class="quiz-top"><span>第 ${Q.index+1} / ${Q.total} 题</span><span>✓ ${Q.right}</span></div><div class="quiz-prompt">${prompt}</div><div class="quiz-big">${esc(big)}</div><div class="quiz-sub">${esc(sub)}</div><div class="options">${opts.map(o=>`<button class="option" data-id="${o.id}">${esc(o.meaning)}</button>`).join('')}</div><div id="feedback"></div></div>`;
    $$('.option').forEach(b=>b.addEventListener('click',()=>checkChoice(b,w,opts)));
  }
  function checkChoice(btn,w) {
    if (Q.locked) return; Q.locked=true;
    const ok=btn.dataset.id===w.id;
    $$('.option').forEach(b=>{ if(b.dataset.id===w.id)b.classList.add('correct'); });
    if(!ok) btn.classList.add('wrong');
    recordQuiz(ok,w); SFX.play(ok?'known':'unknown');
    $('#feedback').innerHTML=`<div class="feedback ${ok?'good':'bad'}">${ok?'✓ 正确':'答案：'+esc(w.word)+' · '+esc(w.meaning)}</div>`;
    setTimeout(()=>{Q.index++;renderQuiz()},800);
  }
  function drawSpell(w) {
    $('#quizArea').innerHTML=`<div class="quiz-card"><div class="quiz-top"><span>第 ${Q.index+1} / ${Q.total} 题</span><span>✓ ${Q.right}</span></div><div class="quiz-prompt">根据中文义拼出英文</div><div class="quiz-big">${esc(w.meaning)}</div><div class="quiz-sub">${esc(w.pos)} · 首字母 ${esc(w.word[0]||'')}</div><input class="spell-input" id="spellInput" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="输入英文"><div class="quiz-actions"><button class="primary" id="checkSpell">检查</button></div><div id="feedback"></div></div>`;
    const input=$('#spellInput'); input.focus();
    const check=()=>{ if(Q.locked)return;Q.locked=true;const ok=input.value.trim().toLowerCase()===w.word.toLowerCase();input.disabled=true;recordQuiz(ok,w);SFX.play(ok?'known':'unknown');$('#feedback').innerHTML=`<div class="feedback ${ok?'good':'bad'}">${ok?'✓ 正确':'答案：'+esc(w.word)}</div>`;if(ok)speak(w.word);setTimeout(()=>{Q.index++;renderQuiz()},850); };
    $('#checkSpell').addEventListener('click',check); input.addEventListener('keydown',e=>{if(e.key==='Enter')check()});
  }
  function recordQuiz(ok,w) {
    S.totalQuiz++; if(ok){S.totalQuizRight++;Q.right++;} else {S.wrongBook[w.id]=(S.wrongBook[w.id]||0)+1;}
    save();
  }

  // ---------- stats/settings ----------
  function renderMe() {
    const progressEntries=Object.entries(S.progress);
    const learned=progressEntries.filter(([,x])=>(x.seen||0)>0).length;
    const mastered=progressEntries.filter(([,x])=>(x.box||0)>=5).length;
    const wrongEntries=Object.entries(S.wrongBook).sort((a,b)=>b[1]-a[1]);
    const wrong=wrongEntries.length;
    const acc=S.totalQuiz?Math.round(S.totalQuizRight/S.totalQuiz*100):0;
    $('#statsGrid').innerHTML=`<div class="stat"><b>${S.streak||0}</b><span>🔥 连续学习天数</span></div><div class="stat"><b>${learned}</b><span>📚 已学词</span></div><div class="stat"><b>${mastered}</b><span>😊 稳定掌握</span></div><div class="stat"><b>${wrong}</b><span>🥲 错词</span></div><div class="stat"><b>${acc}%</b><span>🎯 测验正确率</span></div><div class="stat"><b>${S.totalQuiz||0}</b><span>✍️ 累计答题</span></div>`;

    const tierStats=tier=>{
      const all=WORDS.filter(w=>w.tier===tier);
      const learnedCount=all.filter(w=>(S.progress[w.id]?.seen||0)>0).length;
      return {total:all.length, learned:learnedCount, pct:all.length?Math.round(learnedCount/all.length*100):0};
    };
    const core=tierStats('Core'), reading=tierStats('Reading');
    $('#coreProgressText').textContent=`${core.learned} / ${core.total}`;
    $('#readingProgressText').textContent=`${reading.learned} / ${reading.total}`;
    $('#coreProgressFill').style.width=`${core.pct}%`;
    $('#readingProgressFill').style.width=`${reading.pct}%`;

    const structureScores=new Map();
    wrongEntries.forEach(([id,count])=>{
      const w=BY_ID[id]; if(!w)return;
      const key=w.root?`词根 ${w.root}`:w.prefix?`前缀 ${w.prefix}`:w.suffix?`后缀 ${w.suffix}`:'';
      if(!key)return;
      structureScores.set(key,(structureScores.get(key)||0)+count);
    });
    const weak=Array.from(structureScores.entries()).sort((a,b)=>b[1]-a[1]).slice(0,6);
    $('#weakStructures').innerHTML=weak.length?weak.map(([k,n],i)=>`<div class="weak-item"><span class="weak-rank">${i+1}</span><b>${esc(k)}</b><span>${n} 次错误</span></div>`).join(''):'<p class="muted">目前还没有足够错题数据。开始学习后这里会自动出现薄弱前缀 / 词根 / 后缀。</p>';

    const wrongTop=wrongEntries.slice(0,20).map(([id,count])=>({w:BY_ID[id],count})).filter(x=>x.w);
    $('#wrongWords').innerHTML=wrongTop.length?wrongTop.map(({w,count})=>`<div class="wrong-item"><div><b>${esc(w.word)}</b><span>${esc(w.meaning)}</span></div><em>${count}×</em></div>`).join(''):'<p class="muted">错词本还是空的。</p>';
    $('#wrongReviewBtn').disabled=!wrongTop.length;

    $('#coreCount').textContent=META.core||WORDS.filter(w=>w.tier==='Core').length;
    $('#readingCount').textContent=META.reading||WORDS.filter(w=>w.tier==='Reading').length;
  }
  function syncSettingsUI() {
    $('#autoSpeakToggle').checked=!!S.settings.autoSpeak;
    if($('#sfxToggle')) $('#sfxToggle').checked=S.settings.sfx!==false;
    $('#startAutoSpeak').checked=!!S.settings.autoSpeak;
    $('#accentSelect').value=S.settings.accent;
    $$('[data-rate]').forEach(b=>b.classList.toggle('on',Number(b.dataset.rate)===Number(S.settings.rate||0.95)));
    $$('[data-goal]').forEach(b=>b.classList.toggle('on',Number(b.dataset.goal)===Number(S.settings.goal)));
    $$('[data-phase]').forEach(b=>b.classList.toggle('on',b.dataset.phase===S.settings.phase));
    $$('[data-theme-opt]').forEach(b=>b.classList.toggle('on',b.dataset.themeOpt===S.settings.theme));
    syncPerfBtn();
  }
  function openSettings(){syncSettingsUI();$('#settingsMask').classList.remove('hidden')}
  function closeSettings(){ $('#settingsMask').classList.add('hidden') }
  // ---------- 数据备份：导出 / 导入 ----------
  function exportBackup() {
    try {
      const data = JSON.stringify({ app: 'roots5000', version: 2, exportedAt: new Date().toISOString(), state: S }, null, 1);
      const blob = new Blob([data], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `roots5000_backup_${todayKey()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      S.backupRemindAt = Date.now();
      save();
      SFX.play('complete');
    } catch (_) { alert('导出失败：浏览器不支持下载'); }
  }
  function importBackup(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const st = parsed && (parsed.state || parsed);
        if (!st || typeof st !== 'object' || !st.settings || !st.progress) throw new Error('bad shape');
        S = {
          ...defaultState(),
          ...st,
          settings: { ...defaultState().settings, ...(st.settings || {}) },
          progress: st.progress || {},
          wrongBook: st.wrongBook || {}
        };
        save();
        applyTheme(S.settings.theme);
        applyLowPerf();
        rebuildToday();
        syncSettingsUI();
        renderMe();
        if (currentView === 'learn') renderLearn();
        alert('导入成功：学习进度已恢复');
      } catch (_) { alert('导入失败：文件格式不正确'); }
    };
    reader.readAsText(file);
  }
  function rebuildToday() { S.today=makeToday(); save(); if(currentView==='learn')renderLearn(); }

  // ---------- event wiring ----------
  $$('.tab').forEach(b=>b.addEventListener('click',()=>{SFX.play('whoosh');switchView(b.dataset.view)}));
  $('#settingsBtn').addEventListener('click',openSettings);
  $('#goalBtn').addEventListener('click',openSettings);
  $('#closeSettings').addEventListener('click',closeSettings);
  $('#settingsMask').addEventListener('click',e=>{if(e.target.id==='settingsMask')closeSettings()});
  // 设置面板左滑关闭（手机逃生通道：面板太高时不用找 ✕）
  (()=>{
    const sheet=$('#settingsMask .sheet');
    if(!sheet) return;
    let sx=0, sy=0;
    sheet.addEventListener('pointerdown',e=>{sx=e.clientX;sy=e.clientY;});
    sheet.addEventListener('pointerup',e=>{
      const dx=e.clientX-sx, dy=e.clientY-sy;
      if(dx<-70 && Math.abs(dx)>Math.abs(dy)*1.4) closeSettings();
    });
  })();
  $('#autoSpeakToggle').addEventListener('change',e=>{S.settings.autoSpeak=e.target.checked;save();SFX.play('tap');syncSettingsUI()});
  $('#sfxToggle')?.addEventListener('change',e=>{
    if(e.target.checked){ S.settings.sfx=true; save(); SFX.ensure(); SFX.play('toggleOn'); }
    else { SFX.play('toggleOff'); S.settings.sfx=false; save(); }
    syncSettingsUI();
  });
  $('#accentSelect').addEventListener('change',e=>{S.settings.accent=e.target.value;save()});
  $$('[data-rate]').forEach(b=>b.addEventListener('click',()=>{S.settings.rate=Number(b.dataset.rate);save();syncSettingsUI()}));
  $$('[data-goal]').forEach(b=>b.addEventListener('click',()=>{S.settings.goal=Number(b.dataset.goal);rebuildToday();syncSettingsUI()}));
  $$('[data-phase]').forEach(b=>b.addEventListener('click',()=>{S.settings.phase=b.dataset.phase;rebuildToday();syncSettingsUI()}));
  $$('[data-theme-opt]').forEach(b=>b.addEventListener('click',()=>{SFX.play('theme');applyTheme(b.dataset.themeOpt)}));
  $('#perfBtn')?.addEventListener('click',()=>{
    SFX.play('tap');
    perfState = perfState === 'auto' ? 'on' : perfState === 'on' ? 'off' : 'auto';
    try { localStorage.setItem('roots_perf', perfState); } catch (_) {}
    syncPerfBtn();
    applyLowPerf();
    buildThemeDecor(S.settings.theme);
  });
  $('#resetBtn').addEventListener('click',()=>{if(confirm('确定清空本机所有学习记录吗？')){S=defaultState();save();syncSettingsUI();rebuildToday();renderMe();closeSettings()}});
  $('#exportBtn').addEventListener('click',exportBackup);
  $('#importBtn').addEventListener('click',()=>$('#importInput').click());
  $('#importInput').addEventListener('change',e=>{
    const f=e.target.files && e.target.files[0];
    if(f) importBackup(f);
    e.target.value='';
  });
  $('#lexiconSearch').addEventListener('input',()=>renderLexicon());
  $$('[data-tier-filter]').forEach(b=>b.addEventListener('click',()=>{lexiconTier=b.dataset.tierFilter;renderLexicon()}));
  $('#structureSearch').addEventListener('input',()=>renderStructureMap());
  $$('[data-structure-mode]').forEach(b=>b.addEventListener('click',()=>{structureMode=b.dataset.structureMode;renderStructureMap()}));
  $$('[data-browse]').forEach(b=>b.addEventListener('click',()=>{
    browseMode=b.dataset.browse;
    $$('[data-browse]').forEach(x=>x.classList.toggle('active',x===b));
    $('#browseWords').hidden=browseMode!=='words';
    $('#browseStructures').hidden=browseMode!=='structures';
    if(browseMode==='structures') renderStructureMap(); else renderLexicon();
  }));
  $('#wrongReviewBtn').addEventListener('click',()=>{
    quizMode='wrong';
    $$('.seg[data-quiz-mode]').forEach(x=>x.classList.toggle('active',x.dataset.quizMode==='wrong'));
    switchView('quiz');
    startQuiz();
  });
  $$('[data-quiz-mode]').forEach(b=>b.addEventListener('click',()=>{quizMode=b.dataset.quizMode;$$('[data-quiz-mode]').forEach(x=>x.classList.toggle('active',x===b));startQuiz()}));
  $('#startAutoSpeak').addEventListener('change',e=>{S.settings.autoSpeak=e.target.checked;save()});
  $('#startBtn').addEventListener('click',()=>{unlockAudio();S.settings.autoSpeak=$('#startAutoSpeak').checked;save();$('#startMask').classList.add('hidden');sessionStorage.setItem('roots_audio_started','1');renderLearn()});

  // Default cute click cue for ordinary buttons; learning actions with richer sounds are excluded here.
  document.addEventListener('click',e=>{
    const b=e.target.closest('button');
    if(!b || S.settings.sfx===false) return;
    if(b.matches('.grade,#flipBtn,.back-to-front,[data-speak-word],[data-speak-example],[data-related-speak],.map-more,.option,#checkSpell')) return;
    SFX.play(b.dataset.sfx || 'tap');
  },true);

  // ---------- start ----------
  applyLowPerf();
  applyTheme(S.settings.theme);
  ensureToday(); syncSettingsUI(); renderLearn();
  if (sessionStorage.getItem('roots_audio_started')==='1') {
    // We still wait for a user gesture before speaking after a hard reload on iOS.
    $('#startMask').classList.remove('hidden');
  }
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
  }
})();
