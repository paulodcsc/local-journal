// Guided voice check-in: one question at a time, read aloud, answered with a word or two.
// Every answer can also be tapped, so it still works where speech recognition doesn't.
// Uses the app's globals from index.html (entries, setValue, behaviors, …) and VoiceParse.answer.
// Wrapped in its own scope so its helper names (show, render, …) can't clash with the page's.
(() => {

const SOUND_KEY = 'lj.guideSound.v1', TIP_KEY = 'lj.guideTip.v1';
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- Portuguese (pt-BR) wording for the guided screen. Answers are still saved the same way. ----------
const isPt = () => !!G && G.lang === 'pt';
const T = (en, pt) => isPt() ? pt : en;
const PT_SEC = { Sleep: 'Sono', Feelings: 'Sentimentos', Behaviours: 'Comportamentos', 'Your day': 'Seu dia' };
const PT_LEVEL = {
  amount: ['Baixo', 'Leve', 'Médio', 'Meio alto', 'Alto'],
  quality: ['Ruim', 'Não muito bom', 'Ok', 'Bom', 'Ótimo'],
  urge: ['Nenhuma', 'Leve', 'Moderada', 'Forte', 'Incontrolável'],
};
const PT_DID = ['Não', 'Uma vez', 'Algumas', 'Muitas'];
const PT_TRIG = { Bored: 'Tédio', Lonely: 'Solidão', Anxious: 'Ansiedade', 'Felt rejected': 'Rejeição', Scrolling: 'Rolando o feed',
  Tired: 'Cansaço', Drinking: 'Bebida', 'After a fight': 'Depois de uma briga', Other: 'Outro' };
const PT_HAB = { 'Moved / exercised': 'Me mexi / exercício', 'Went outside': 'Saí / luz do dia', 'Real talk': 'Conversa de verdade',
  'Caffeine after 2pm': 'Café depois das 14h', Alcohol: 'Álcool', 'Took meds': 'Tomei remédio' };
const PT_URGE_MEANS = ['Nenhuma vontade', 'Percebi, mas deu pra ignorar', 'Difícil de resistir'];
const PT_Q = {
  sleep: { title: 'Horas de sono' },
  rested: { title: 'Como está seu descanso?', means: ['Difícil de funcionar', 'Ok, com cansaço às vezes', 'Cabeça leve, descanso em dia'] },
  mood: { title: 'Humor', means: ['Um dia pesado e difícil', 'Neutro, com altos e baixos', 'Leve, aproveitei as coisas'] },
  stress: { title: 'Estresse', means: ['Mal percebi', 'Na cabeça, mas funcionei', 'Mudou o que eu fiz hoje'] },
  anxiety: { title: 'Ansiedade', means: ['Calma', 'Preocupação às vezes, mas sob controle', 'Difícil de largar, senti no corpo'] },
  irritable: { title: 'Irritação', means: ['Paciência', 'Impaciência às vezes', 'Pavio curto quase o dia todo'] },
  insecure: { title: 'Insegurança', means: ['Me senti bem comigo', 'Algumas dúvidas ou autocrítica', 'Me senti insuficiente quase o dia todo'] },
  energy: { title: 'Energia', means: ['Sem bateria', 'Deu pra levar', 'Fiz as coisas com facilidade'] },
  productive: { title: 'Produtividade', means: ['Não consegui começar nada', 'Fiz algumas coisas', 'Fiz o que queria, inclusive pra mim'] },
  instagram: { title: 'Instagram / redes sociais', means: ['Quase nada, ou nada', 'Um pouco, sob controle', 'Bem mais do que eu queria'] },
  ate: { title: 'Você se alimentou bem?', opts: ['Quase nada', 'Algumas refeições', 'Sim'] },
  water: { title: 'Bebeu água suficiente?', opts: ['Não', 'Um pouco', 'Sim'] },
};
function titleOf(s) {
  if (!isPt() || s.f.beh) return s.title;
  if (s.type === 'habits') return 'O que aconteceu hoje?';
  if (s.type === 'note') return 'Algo pra anotar sobre hoje?';
  return (PT_Q[s.f.id] || {}).title || s.title;
}
function subOf(s) {
  if (!isPt()) return s.sub;
  if (s.kind === 'urge') return 'Quão forte foi a vontade?';
  return { freq: 'Você agiu?', multi: 'O que despertou isso?', habits: 'Diga ou toque no que você fez' }[s.type];
}
function dispLabels(s) { // what you see; labelsFor() keeps the saved (English) values
  const L = labelsFor(s); if (!isPt()) return L;
  if (s.type === 'slider') return PT_LEVEL[s.kind];
  if (s.type === 'freq') return PT_DID;
  if (s.type === 'three') return (PT_Q[s.f.id] || {}).opts || L;
  if (s.type === 'yesno') return ['Não', 'Sim'];
  if (s.type === 'multi' || s.type === 'habits') return L.map(x => PT_TRIG[x] || PT_HAB[x] || x);
  return L;
}
const meansOf = s => !isPt() ? s.f.means : s.kind === 'urge' ? PT_URGE_MEANS : (PT_Q[s.f.id] || {}).means || s.f.means;
function sayOf(s) {
  if (!isPt()) return s.say;
  const L = dispLabels(s);
  const t = titleOf(s), lead = /\?$/.test(t) ? t : t + '.';
  if (s.type === 'slider') return s.kind === 'urge' ? `${s.f.beh.name}. Quão forte foi a vontade? ${L[0]}, ${L[2]} ou ${L[4]}?` : `${lead} ${L[0]}, ${L[2]} ou ${L[4]}?`;
  return { hours: 'Quantas horas você dormiu?', freq: 'Você agiu?', multi: 'O que despertou isso?',
    habits: 'O que aconteceu hoje? Diga o que você fez, ou nada.', note: 'Algo pra anotar sobre hoje? Ou diga pular.' }[s.type] || titleOf(s);
}
const speechLang = () => isPt() ? 'pt-BR' : 'en-US';
let gSound = load(SOUND_KEY, true);
let G = null; // { steps, i, day, snapshot, onlyMissing, answered, token, rec, listening, speaking, paused, voice, retries, silent, pending }

// ---------- Steps (same order as the check-in page) ----------
function guideSteps() {
  const steps = [];
  const addBehaviors = () => behaviors.forEach(b => {
    const [fu, fd, fw] = behaviorFields(b);
    steps.push({ f: fu, type: 'slider', kind: 'urge', sec: 'Behaviours', title: b.name, sub: 'How strong was the urge?',
      say: `${b.name}. How strong was the urge? None, moderate, or overwhelming?` });
    steps.push({ f: fd, type: 'freq', sec: 'Behaviours', title: b.name, sub: 'Did you act on it?', say: 'Did you act on it?',
      when: e => e[fu.id] !== 0 });
    steps.push({ f: fw, type: 'multi', sec: 'Behaviours', title: b.name, sub: 'What set it off?', say: 'What set it off?',
      when: e => e[fu.id] > 0 || e[fd.id] > 0 });
  });
  let behDone = false, habitsDone = false;
  for (const q of visible()) {
    if (!behDone && QUESTIONS.indexOf(q) >= HABITS_START) { addBehaviors(); behDone = true; }
    const spoken = q.label.replace(' / ', ' or ').replace('?', '');
    if (q.ui === 'slider') steps.push({ f: q, type: 'slider', kind: q.good === 'low' ? 'amount' : 'quality', title: q.label,
      say: `${spoken}. ${q.opts[0]}, ${q.opts[2]}, or ${q.opts[4]}?` });
    else if (q.type === 'hours') steps.push({ f: q, type: 'hours', title: q.label, say: 'How many hours did you sleep?' });
    else if (q.id === 'instagram') steps.push({ f: q, type: 'minutes', title: q.label, say: 'How much Instagram or social media today?' });
    else if (q.type === 'scale') steps.push({ f: q, type: 'three', title: q.label, say: spoken + '?' });
    else if (q.type === 'yesno') { // one question for all habits: say the ones you did
      if (!habitsDone) steps.push({ f: { id: 'habits' }, type: 'habits', title: 'What happened today?', sub: 'Say or tap the ones you did',
        say: 'What happened today? Say the ones you did, or none.' });
      habitsDone = true;
    }
    else if (q.type === 'note') steps.push({ f: q, type: 'note', title: 'Anything to note about today?', say: 'Anything to note about today? Or say skip.' });
  }
  if (!behDone) addBehaviors();
  for (const st of steps) if (!st.sec) {
    const q = st.f;
    st.sec = (SECTIONS.find(x => x.ids && (x.ids.includes(q.id) || (q.type === 'yesno' && x.ids.includes('habits')))) || {}).title || '';
  }
  return steps;
}
const applies = (s, e) => !s.when || s.when(e);
const isMissing = (s, e) => s.type === 'habits' ? habitQs().every(q => e[q.id] === undefined) : e[s.f.id] === undefined && !isUnsure(e, s.f.id);
const shouldAsk = (s, e) => applies(s, e) && (!G.onlyMissing || isMissing(s, e));
const step = () => G.steps[G.i];
const yesterdayOf = id => entries[addDays(current, -1)]?.[id];
function labelsFor(s) {
  if (s.type === 'yesno') return ['No', 'Yes'];
  if (s.type === 'multi') return TRIGGERS;
  if (s.type === 'habits') return habitQs().map(q => q.tile);
  return s.f.opts;
}
const optLabel = (s, v) => s.type === 'hours' ? `${v}h` : s.type === 'multi' ? v.join(', ') : labelsFor(s)[v];

// ---------- Open / navigate / close ----------
function openGuide() {
  if (G) return;
  const steps = guideSteps();
  G = { steps, i: -1, day: current, snapshot: { ...entry() }, onlyMissing: false, answered: [], token: 0,
    rec: null, listening: false, speaking: false, paused: false, voice: !!SR, retries: 0, silent: 0, pending: null };
  // Only ask what's still open; if everything is answered, go through it all.
  G.onlyMissing = steps.some(s => applies(s, entry()) && isMissing(s, entry()));
  G.showTip = G.voice && !load(TIP_KEY, false);
  G.lang = voiceLang();
  $('gBack').textContent = T('‹ Back', '‹ Voltar'); $('gUnsure').textContent = T('Not sure', 'Não sei');
  $('gSkip').textContent = T('Skip ›', 'Pular ›'); $('gAlt').textContent = T('Say everything at once instead', 'Dizer tudo de uma vez');
  $('gUndo').textContent = T('Undo', 'Desfazer');
  $('guide').hidden = false; document.body.classList.add('noscroll');
  $('gSound').innerHTML = icon(gSound ? 'sound' : 'mute');
  goNext();
  $('gSound').hidden = !G?.voice;
}
function closeGuide() {
  if (!G) return;
  G.token++; stopListening(); stopSpeaking();
  G = null; $('guide').hidden = true; document.body.classList.remove('noscroll');
  refresh(); maybeCelebrate();
}
function goNext() {
  for (let j = G.i + 1; j < G.steps.length; j++) if (shouldAsk(G.steps[j], entry())) return slideTo(j, 'fwd');
  slideTo(-1, 'fwd');
}
function goBack() {
  // Back goes to the previous question even if it's answered, so you can fix it.
  for (let j = (G.i < 0 ? G.steps.length : G.i) - 1; j >= 0; j--) if (applies(G.steps[j], entry())) return slideTo(j, 'back');
  ask(); // already at the first question
}
// Slide the current question out, then the next one in (j = -1 means the summary).
function slideTo(j, dir) {
  const body = $('gBody');
  G.token++; stopListening(); stopSpeaking(); hideUndo();
  const enter = () => (j < 0 ? finish() : show(j), animateIn(dir));
  if (G.i < 0 || calm()) return enter();
  body.classList.remove('enter-fwd', 'enter-back'); body.classList.add('leave-' + dir);
  const t = G.token;
  setTimeout(() => { if (!G || t !== G.token) return; body.classList.remove('leave-fwd', 'leave-back'); enter(); }, 150);
}
function animateIn(dir) {
  const body = $('gBody');
  body.classList.remove('leave-fwd', 'leave-back', 'enter-fwd', 'enter-back', 'fresh');
  void body.offsetWidth; // restart the animation
  body.classList.add('enter-' + dir, 'fresh');
  clearTimeout(animateIn.t); animateIn.t = setTimeout(() => body.classList.remove('enter-fwd', 'enter-back', 'fresh'), 700);
}
function show(j) {
  G.i = j; G.retries = 0; G.silent = 0; G.pending = null; micMsg = '';
  render(); ask();
}
function ask() {
  const t = ++G.token;
  stopListening(); heard(null);
  if (!G.voice) return setMic();
  speak(sayOf(step()), () => { if (G && t === G.token) listen(); });
}
// What the app is hearing, shown under the mic: live text, a confirmed answer, a miss, or sound bars.
function heard(text, kind = '') {
  const el = $('gHeard');
  if (text === null) el.innerHTML = '';
  else if (text === 'listening' || text === 'speaking') el.innerHTML = `<span class="eq ${text === 'speaking' ? 'slow' : ''}" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>`;
  else el.innerHTML = `<span class="bubble ${kind}">${esc(text)}</span>`;
}

// ---------- Answering ----------
function commitAnswer(value, { unsure = false, delay = 1000 } = {}) {
  const s = step(); if (!s) return;
  G.token++; stopListening(); stopSpeaking();
  const id = s.f.id, before = entry();
  G.last = { id, prev: before[id], prevUnsure: isUnsure(before, id), wasAnswered: G.answered.includes(id), filled: null,
    habits: s.type === 'habits' ? Object.fromEntries(habitQs().map(q => [q.id, before[q.id]])) : null };
  if (s.type === 'habits') habitQs().forEach(q => setValue(q.id, value.includes(q.tile) ? 1 : 0));
  else if (unsure) setUnsure(id, true);
  else if (s.type === 'multi') setValue(id, value.length ? value : undefined);
  else if (s.type === 'note') { const old = entry().note; setValue(id, old && !old.includes(value) ? `${old} ${value}` : value); }
  else setValue(id, value);
  // No urge means you didn't act on it: fill that in and skip the question.
  if (s.kind === 'urge' && value === 0 && !unsure && entry()[s.f.beh.id + '_did'] === undefined) {
    setValue(s.f.beh.id + '_did', 0); G.last.filled = s.f.beh.id + '_did';
  }
  if (!G.answered.includes(id)) G.answered.push(id);
  if (s.type === 'hours' || s.type === 'multi' || s.type === 'habits') G.pending = value; // show what was said, not the old draft
  G.picked = id; buzz(); render();
  setMic(T('Saved', 'Salvo')); $('gUndo').hidden = false; // a moment to undo before moving on
  const t = G.token;
  setTimeout(() => { if (G && t === G.token) goNext(); }, calm() ? Math.min(delay, 600) : delay);
}
function hideUndo() { $('gUndo').hidden = true; }
function undoLast() {
  const L = G && G.last; if (!L) return;
  G.token++; hideUndo();
  if (L.habits) Object.entries(L.habits).forEach(([id, v]) => setValue(id, v));
  else { setUnsure(L.id, false); if (L.prevUnsure) setUnsure(L.id, true); else setValue(L.id, L.prev); }
  if (L.filled) setValue(L.filled, undefined);
  if (!L.wasAnswered) G.answered = G.answered.filter(x => x !== L.id);
  G.last = null; G.pending = null; G.paused = false; G.retries = 0; G.silent = 0;
  render(); heard(null); setMic('');
  if (G.voice) listen();
}
function showHeard(text, kind) { heard(text, kind); }
function nudgeOptions() {
  const o = document.querySelector('#gBody .g-opts, #gBody .g-row, #gBody .g-chips'); if (!o) return;
  o.classList.remove('nudge'); void o.offsetWidth; o.classList.add('nudge');
}
function handleSpeech(alts) {
  const s = step(), ctx = { type: s.type === 'habits' ? 'multi' : s.type, kind: s.kind, labels: labelsFor(s), prev: yesterdayOf(s.f.id), minutes: s.f.id === 'instagram', lang: G.lang };
  let res = null, heard = alts[0];
  for (const a of alts) { res = VoiceParse.answer(a, ctx); if (res) { heard = a; break; } }
  if (!res) {
    G.retries++;
    showHeard(`“${heard}”`, 'bad'); nudgeOptions();
    if (G.retries >= 3) { G.paused = true; setMic(T('Didn’t catch that. Tap an answer, or the mic to try again.', 'Não entendi. Toque numa resposta, ou no microfone pra tentar de novo.')); return; }
    setMic(T('Didn’t catch that. Try one of the options.', 'Não entendi. Tente uma das opções.')); return listen(true);
  }
  // show what it understood, e.g. “hi” → High, so a mishearing is obvious right away
  const D = dispLabels(s);
  const picked = res.value === undefined ? '' : s.type === 'hours' ? `${res.value}h`
    : Array.isArray(res.value) ? (res.value.length ? res.value.map(x => D[labelsFor(s).indexOf(x)] || x).join(', ') : T('none', 'nada'))
    : s.type === 'note' ? '' : D[res.value];
  showHeard(`“${heard}”${picked && picked.toLowerCase() !== heard.toLowerCase().trim() ? ' → ' + picked : ''}`, res.noPrev ? 'bad' : 'ok');
  if (res.cmd === 'skip') return goNext();
  if (res.cmd === 'back') return goBack();
  if (res.cmd === 'repeat') return ask();
  if (res.cmd === 'stop') return finish();
  if (res.noPrev) { setMic(T('Nothing from yesterday to compare to. Say a level instead.', 'Não tem resposta de ontem pra comparar. Diga um nível.')); return listen(true); }
  if (res.unsure) return commitAnswer(undefined, { unsure: true });
  commitAnswer(res.value);
}

// ---------- Speech in / out ----------
function listen(keepMsg) {
  if (!G || !G.voice || G.paused) return setMic();
  stopListening();
  const r = new SR();
  r.lang = speechLang(); r.continuous = false; r.interimResults = true; r.maxAlternatives = 3;
  const t = G.token; let alts = null;
  r.onresult = ev => {
    const res = ev.results[ev.results.length - 1];
    if (!res.isFinal) heard(`“${res[0].transcript}”`, 'live');
    if (res.isFinal) alts = [...res].map(a => a.transcript).filter(Boolean);
  };
  r.onerror = ev => {
    if (['not-allowed', 'service-not-allowed', 'audio-capture', 'network', 'language-not-supported'].includes(ev.error)) {
      G.voice = false;
      G.voiceMsg = ev.error === 'not-allowed' ? T('Microphone permission was denied. Tap your answer.', 'O microfone foi bloqueado. Toque na sua resposta.')
        : ev.error === 'network' ? T('Voice needs an internet connection here. Tap your answer.', 'A voz precisa de internet aqui. Toque na sua resposta.')
        : ev.error === 'language-not-supported' ? T('Voice isn’t available in this language here. Tap your answer.', 'Voz em português não disponível aqui. Toque na sua resposta.')
        : T('Voice isn’t available here. Tap your answer.', 'Voz não disponível aqui. Toque na sua resposta.');
    }
  };
  r.onend = () => {
    if (!G || G.rec !== r) return;
    G.rec = null; G.listening = false;
    if (t !== G.token) return;
    if (alts && alts.length) return handleSpeech(alts);
    if (!G.voice) return setMic();
    if (++G.silent >= 3) { G.paused = true; return setMic(); } // stop after a few silent tries
    listen();
  };
  G.rec = r;
  try { r.start(); G.listening = true; setMic(keepMsg ? undefined : ''); if (!keepMsg) heard('listening'); else setTimeout(() => { if (G && G.listening && t === G.token && document.querySelector('#gHeard .bubble.bad')) heard('listening'); }, 1400); }
  catch { G.rec = null; G.voice = false; setMic(); }
}
function stopListening() {
  if (!G) return;
  const r = G.rec; G.rec = null; G.listening = false;
  if (r) try { r.abort(); } catch {}
}
function speak(text, then) {
  if (!gSound || !window.speechSynthesis) return then();
  const t = G.token;
  const done = () => { if (G && G.speaking && t === G.token) { G.speaking = false; setMic(); then(); } };
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = speechLang(); u.rate = isPt() ? 1.0 : 1.05; u.onend = done; u.onerror = done;
    const want = speechLang().toLowerCase(), voices = speechSynthesis.getVoices ? speechSynthesis.getVoices() : [];
    const v = voices.find(x => x.lang && x.lang.replace('_', '-').toLowerCase() === want) || voices.find(x => x.lang && x.lang.toLowerCase().startsWith(want.slice(0, 2)));
    if (v) u.voice = v;
    G.speaking = true; setMic(); heard('speaking');
    speechSynthesis.speak(u);
    setTimeout(done, 1500 + text.length * 85); // some browsers never fire onend
  } catch { G.speaking = false; then(); }
}
function stopSpeaking() { if (G) G.speaking = false; try { window.speechSynthesis?.cancel(); } catch {} }

// ---------- Rendering ----------
let micMsg = '';
function setMic(msg) {
  if (!G) return;
  if (msg !== undefined) micMsg = msg;
  const btn = $('gMic'), txt = $('gMicText');
  $('gSound').hidden = !G.voice;
  btn.hidden = !G.voice || G.i < 0;
  btn.className = 'g-micbtn' + (G.listening ? ' listening' : '') + (G.speaking ? ' speaking' : '') + (G.paused || (!G.listening && !G.speaking) ? ' paused' : '');
  btn.setAttribute('aria-label', G.listening ? 'Pause listening' : G.speaking ? 'Answer now' : 'Answer by voice');
  txt.textContent = G.i < 0 ? '' : !G.voice ? (G.voiceMsg || T('Voice isn’t available in this browser. Tap your answer.', 'Voz não disponível neste navegador. Toque na sua resposta.'))
    : micMsg || (G.speaking ? T('Reading the question… tap the mic to answer now', 'Lendo a pergunta… toque no microfone pra responder já')
      : G.listening ? T('Listening…', 'Ouvindo…') : T('Paused. Tap the mic to answer by voice.', 'Pausado. Toque no microfone pra responder por voz.'));
}
function render() {
  const body = $('gBody'), s = step(), e = entry();
  $('gNav').hidden = false; $('gAlt').hidden = false;
  const inSec = G.steps.filter(x => x.sec === s.sec && applies(x, e));
  $('gCount').innerHTML = `<b>${esc(isPt() ? PT_SEC[s.sec] || s.sec : s.sec)}</b> · ${inSec.indexOf(s) + 1} ${T('of', 'de')} ${inSec.length}`;
  $('gBar').style.width = (completion(current) * 100) + '%';
  const v = e[s.f.id], unsure = isUnsure(e, s.f.id), y = yesterdayOf(s.f.id);
  let html = G.showTip ? `<div class="g-tip" id="gTip"><span>${T('Answer with a word or two, like <b>“high”</b> or <b>“a bit”</b>. You can also say <b>“skip”</b>, <b>“back”</b> or <b>“stop”</b>.',
    'Responda com uma ou duas palavras, como <b>“alto”</b> ou <b>“um pouco”</b>. Você também pode dizer <b>“pular”</b>, <b>“voltar”</b> ou <b>“parar”</b>.')}</span><button id="gTipOk">${T('Got it', 'Entendi')}</button></div>` : '';
  html += `<div class="g-title">${esc(titleOf(s))}</div>`;
  const sub = subOf(s);
  if (sub) html += `<div class="g-sub">${esc(sub)}</div>`;
  const D = dispLabels(s);
  const shown = val => s.type === 'hours' ? `${val}h` : D[val];
  if (y !== undefined && s.type !== 'note' && shown(y) !== undefined) html += `<div class="g-y">${T('Yesterday', 'Ontem')}: ${esc(String(shown(y)).toLowerCase())}</div>`;
  const pop = G.picked === s.f.id; G.picked = null;
  let n = 0;
  const opt = (val, label, extra = '', cls = '') => {
    const on = v === val && !unsure;
    return `<button class="g-opt ${cls} ${on ? 'on' : ''} ${on && pop ? 'picked' : ''}" data-v="${val}" style="--i:${n++}">${esc(label)}${extra}${on ? icon('check', 'g-ck') : ''}</button>`;
  };
  const ytag = val => y === val ? ` <span class="g-tag">${T('yesterday', 'ontem')}</span>` : '';
  let hint = '';
  switch (s.type) {
    case 'slider': {
      const o = D, means = meansOf(s);
      html += `<div class="g-opts">` + [0, 1, 2, 3, 4].map(i => i % 2 === 0
        ? opt(i, o[i], `<small>${esc(means[i / 2])}${ytag(i)}</small>`)
        : opt(i, o[i], `<small>${T('in between', 'entre os dois')}${ytag(i)}</small>`, 'mid')).join('') + `</div>`;
      if (unsure) html += `<div class="g-y">${T('Marked as not sure.', 'Marcado como não sei.')}</div>`;
      hint = T(`Say “${o[0].toLowerCase()}”, “${o[2].toLowerCase()}” or “${o[4].toLowerCase()}”, or in between like “${o[1].toLowerCase()}”. Or a number from 1 to 5.`,
        `Diga “${o[0].toLowerCase()}”, “${o[2].toLowerCase()}” ou “${o[4].toLowerCase()}”, ou algo entre, como “${o[1].toLowerCase()}”. Ou um número de 1 a 5.`);
      break;
    }
    case 'hours': {
      if (G.pending === null) G.pending = v ?? lastSleep();
      html += `<div class="g-hours"><button data-h="-0.5" aria-label="Less">−</button><div class="g-hval">${G.pending}h</div><button data-h="0.5" aria-label="More">+</button></div>
        <button class="g-opt g-confirm ${v === G.pending ? 'on' : ''} ${pop ? 'picked' : ''}" data-ok="1">${v === G.pending ? T('Saved', 'Salvo') : T('That’s right', 'Isso mesmo')}</button>`;
      hint = T('Say a number, like “seven and a half”.', 'Diga um número, como “sete e meia”.');
      break;
    }
    case 'habits':
    case 'multi': {
      if (G.pending === null) G.pending = s.type === 'habits' ? habitQs().filter(q => e[q.id] === 1).map(q => q.tile) : [...(v || [])];
      html += `<div class="chips wrap g-chips">` + labelsFor(s).map((t, i) =>
        `<button class="chip ${G.pending.includes(t) ? 'on' : ''}" data-t="${esc(t)}" style="--i:${n++}">${esc(D[i])}</button>`).join('') + `</div>
        <button class="g-opt g-confirm ${pop ? 'on picked' : ''}" data-ok="1">${pop ? T('Saved', 'Salvo') : G.pending.length ? T('Done', 'Pronto') : s.type === 'habits' ? T('None of these', 'Nenhum') : T('Nothing in particular', 'Nada específico')}</button>`;
      hint = s.type === 'habits' ? T('Say the ones you did, like “moved and went outside”, or “none”.', 'Diga o que você fez, como “me mexi e saí”, ou “nada”.')
        : T('Say any that fit, like “lonely and bored”, or “nothing”.', 'Diga o que se encaixa, como “solidão e tédio”, ou “nada”.');
      break;
    }
    case 'note': {
      html += `<textarea class="g-note" placeholder="${T('Optional', 'Opcional')}">${esc(v || '')}</textarea><button class="g-opt g-confirm ${pop ? 'on picked' : ''}" data-ok="1">${pop ? T('Saved', 'Salvo') : T('Save note', 'Salvar nota')}</button>`;
      hint = T('Say what happened, or “skip”.', 'Diga o que aconteceu, ou “pular”.');
      break;
    }
    default: {
      const o = D;
      const row = s.type === 'yesno' || s.type === 'three';
      html += `<div class="${row ? 'g-row' : 'g-opts'}">` + o.map((l, i) => opt(i, l, ytag(i))).join('') + `</div>`;
      hint = s.type === 'yesno' ? T('Say “yes” or “no”.', 'Diga “sim” ou “não”.') : `${T('Say', 'Diga')} ${o.map(l => `“${l.toLowerCase()}”`).join(', ')}.`;
    }
  }
  if (G.voice) html += `<div class="g-hint">${esc(hint)}<br><span>${T('You can also say “skip”, “back”, “not sure”, “same as yesterday” or “stop”.', 'Você também pode dizer “pular”, “voltar”, “não sei”, “igual a ontem” ou “parar”.')}</span></div>`;
  body.innerHTML = html;
  if ($('gTipOk')) $('gTipOk').onclick = () => { save(TIP_KEY, true); G.showTip = false; $('gTip').remove(); };

  body.querySelectorAll('[data-v]').forEach(b => b.onclick = () => {
    const val = +b.dataset.v;
    if (v === val && !unsure) return goNext(); // tapping the saved answer again just moves on
    commitAnswer(val, { delay: 550 });
  });
  body.querySelectorAll('[data-h]').forEach(b => b.onclick = () => {
    G.pending = Math.max(0, Math.min(16, G.pending + +b.dataset.h)); render();
  });
  body.querySelectorAll('[data-t]').forEach(b => b.onclick = () => {
    const t = b.dataset.t; G.pending = G.pending.includes(t) ? G.pending.filter(x => x !== t) : [...G.pending, t]; render();
  });
  const ok = body.querySelector('[data-ok]');
  if (ok) ok.onclick = () => {
    if (s.type === 'note') { const txt = body.querySelector('textarea').value.trim(); return txt ? commitAnswer(txt, { delay: 550 }) : goNext(); }
    commitAnswer(G.pending, { delay: 550 });
  };
  $('gUnsure').hidden = s.type !== 'slider';
  $('gBack').disabled = !G.steps.slice(0, G.i).some(x => applies(x, e));
  setMic();
}
function finish() {
  G.token++; stopListening(); stopSpeaking(); hideUndo();
  G.i = -1; micMsg = ''; heard(null);
  const e = entry();
  const items = G.answered.map((id, i) => {
    if (id === 'habits') {
      const did = habitQs().filter(q => e[q.id] === 1).map(q => (isPt() ? PT_HAB[q.tile] || q.tile : q.tile).toLowerCase());
      return `<li style="--i:${i}"><b>${T('What happened today', 'O que aconteceu hoje')}:</b> ${esc(did.join(', ') || T('none of these', 'nada disso'))}</li>`;
    }
    const f = field(id), st = G.steps.find(x => x.f.id === id);
    let label = f.label, val = isUnsure(e, id) ? T('not sure', 'não sei') : e[id] === undefined ? '—' : display(f, e[id]);
    if (isPt() && st) {
      label = st.f.beh ? `${st.f.beh.name}: ${subOf(st).replace('?', '').toLowerCase()}` : titleOf(st).replace('?', '');
      const D = dispLabels(st), v = e[id];
      if (!isUnsure(e, id) && v !== undefined) val = st.type === 'hours' ? `${v}h` : st.type === 'note' ? `“${v}”` : st.type === 'multi' ? v.map(x => PT_TRIG[x] || x).join(', ') : D[v];
    }
    return `<li style="--i:${i}"><b>${esc(label)}:</b> ${esc(val)}</li>`;
  }).join('');
  const gaps = counted().filter(q => e[q.id] === undefined && !isUnsure(e, q.id)).length;
  $('gCount').textContent = T('Done', 'Pronto'); $('gBar').style.width = (completion(current) * 100) + '%';
  $('gBody').innerHTML = `<div class="g-done-ck" aria-hidden="true"><svg viewBox="0 0 56 56"><circle cx="28" cy="28" r="26"/><path d="M17 29l7.5 7.5L40 21"/></svg></div>
    <div class="g-title">${gaps ? T('Saved', 'Salvo') : T('All done', 'Tudo pronto')}</div>
    <div class="g-sub">${G.answered.length ? T('Here’s what you answered:', 'Suas respostas:') : T('Nothing was changed.', 'Nada foi alterado.')}</div>
    ${items ? `<ul class="g-sum">${items}</ul>` : ''}
    ${gaps ? `<div class="g-y">${T(`${gaps} question${gaps > 1 ? 's' : ''} still open. You can answer ${gaps > 1 ? 'them' : 'it'} on the check-in page.`,
      `${gaps} ${gaps > 1 ? 'perguntas ainda abertas' : 'pergunta ainda aberta'}. Você pode responder na página de check-in.`)}</div>` : ''}
    <button class="g-opt g-confirm on" id="gDone">${T('Done', 'Pronto')}</button>
    ${G.answered.length ? `<button class="g-opt g-confirm" id="gUndoAll">${T('Undo all of these', 'Desfazer tudo')}</button>` : ''}`;
  $('gNav').hidden = true; $('gAlt').hidden = true;
  setMic();
  $('gDone').onclick = closeGuide;
  if ($('gUndoAll')) $('gUndoAll').onclick = () => {
    const prev = G.snapshot;
    if (Object.keys(prev).length) entries[G.day] = prev; else delete entries[G.day];
    save(KEY, entries); closeGuide(); toast('Undone');
  };
}

// ---------- Wiring ----------
$('gClose').onclick = closeGuide;
$('gBack').onclick = () => { G.paused = false; goBack(); };
$('gSkip').onclick = () => { G.paused = false; goNext(); };
$('gUnsure').onclick = () => commitAnswer(undefined, { unsure: true, delay: 300 });
$('gMic').onclick = () => {
  if (G.speaking) { G.token++; stopSpeaking(); G.paused = false; G.silent = 0; listen(); return; } // skip the reading, answer now
  if (G.listening) { G.token++; stopListening(); G.paused = true; setMic(''); heard(null); return; }
  G.paused = false; G.silent = 0; G.retries = 0; G.token++; listen();
};
$('gUndo').onclick = undoLast;
$('gSound').onclick = () => {
  gSound = !gSound; save(SOUND_KEY, gSound); $('gSound').innerHTML = icon(gSound ? 'sound' : 'mute');
  if (!gSound) { stopSpeaking(); if (G && G.i >= 0 && !G.listening) { G.token++; listen(); } }
};
$('gAlt').onclick = () => { closeGuide(); openFreeform(); };
document.addEventListener('keydown', ev => { if (G && ev.key === 'Escape') closeGuide(); });
document.addEventListener('visibilitychange', () => {
  if (G && document.visibilityState === 'hidden') { G.token++; stopListening(); stopSpeaking(); G.paused = true; setMic(''); }
});

window.openGuide = openGuide;
})();
