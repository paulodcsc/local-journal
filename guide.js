// Guided voice check-in: one question at a time, read aloud, answered with a word or two.
// Every answer can also be tapped, so it still works where speech recognition doesn't.
// Uses the app's globals from index.html (entries, setValue, behaviors, …) and VoiceParse.answer.
// Wrapped in its own scope so its helper names (show, render, …) can't clash with the page's.
(() => {

const SOUND_KEY = 'lj.guideSound.v1', TIP_KEY = 'lj.guideTip.v1';
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
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
  let behDone = false;
  for (const q of visible()) {
    if (!behDone && QUESTIONS.indexOf(q) >= HABITS_START) { addBehaviors(); behDone = true; }
    const spoken = q.label.replace(' / ', ' or ').replace('?', '');
    if (q.ui === 'slider') steps.push({ f: q, type: 'slider', kind: q.good === 'low' ? 'amount' : 'quality', title: q.label,
      say: `${spoken}. ${q.opts[0]}, ${q.opts[2]}, or ${q.opts[4]}?` });
    else if (q.type === 'hours') steps.push({ f: q, type: 'hours', title: q.label, say: 'How many hours did you sleep?' });
    else if (q.id === 'instagram') steps.push({ f: q, type: 'minutes', title: q.label, say: 'How much Instagram or social media today?' });
    else if (q.type === 'scale') steps.push({ f: q, type: 'three', title: q.label, say: spoken + '?' });
    else if (q.type === 'yesno') steps.push({ f: q, type: 'yesno', title: q.label, say: spoken + '?' });
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
const isMissing = (s, e) => e[s.f.id] === undefined && !isUnsure(e, s.f.id);
const shouldAsk = (s, e) => applies(s, e) && (!G.onlyMissing || isMissing(s, e));
const step = () => G.steps[G.i];
const yesterdayOf = id => entries[addDays(current, -1)]?.[id];
function labelsFor(s) {
  if (s.type === 'yesno') return ['No', 'Yes'];
  if (s.type === 'multi') return TRIGGERS;
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
  speak(step().say, () => { if (G && t === G.token) listen(); });
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
  G.last = { id, prev: before[id], prevUnsure: isUnsure(before, id), wasAnswered: G.answered.includes(id), filled: null };
  if (unsure) setUnsure(id, true);
  else if (s.type === 'multi') setValue(id, value.length ? value : undefined);
  else if (s.type === 'note') { const old = entry().note; setValue(id, old && !old.includes(value) ? `${old} ${value}` : value); }
  else setValue(id, value);
  // No urge means you didn't act on it: fill that in and skip the question.
  if (s.kind === 'urge' && value === 0 && !unsure && entry()[s.f.beh.id + '_did'] === undefined) {
    setValue(s.f.beh.id + '_did', 0); G.last.filled = s.f.beh.id + '_did';
  }
  if (!G.answered.includes(id)) G.answered.push(id);
  if (s.type === 'hours' || s.type === 'multi') G.pending = value; // show what was said, not the old draft
  G.picked = id; buzz(); render();
  setMic('Saved'); $('gUndo').hidden = false; // a moment to undo before moving on
  const t = G.token;
  setTimeout(() => { if (G && t === G.token) goNext(); }, calm() ? Math.min(delay, 600) : delay);
}
function hideUndo() { $('gUndo').hidden = true; }
function undoLast() {
  const L = G && G.last; if (!L) return;
  G.token++; hideUndo();
  setUnsure(L.id, false);
  if (L.prevUnsure) setUnsure(L.id, true); else setValue(L.id, L.prev);
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
  const s = step(), ctx = { type: s.type, kind: s.kind, labels: labelsFor(s), prev: yesterdayOf(s.f.id) };
  let res = null, heard = alts[0];
  for (const a of alts) { res = VoiceParse.answer(a, ctx); if (res) { heard = a; break; } }
  if (!res) {
    G.retries++;
    showHeard(`“${heard}”`, 'bad'); nudgeOptions();
    if (G.retries >= 3) { G.paused = true; setMic('Didn’t catch that. Tap an answer, or the mic to try again.'); return; }
    setMic('Didn’t catch that. Try one of the options.'); return listen(true);
  }
  showHeard(`“${heard}”`, res.noPrev ? 'bad' : 'ok');
  if (res.cmd === 'skip') return goNext();
  if (res.cmd === 'back') return goBack();
  if (res.cmd === 'repeat') return ask();
  if (res.cmd === 'stop') return finish();
  if (res.noPrev) { setMic('Nothing from yesterday to compare to. Say a level instead.'); return listen(true); }
  if (res.unsure) return commitAnswer(undefined, { unsure: true });
  commitAnswer(res.value);
}

// ---------- Speech in / out ----------
function listen(keepMsg) {
  if (!G || !G.voice || G.paused) return setMic();
  stopListening();
  const r = new SR();
  r.lang = 'en-US'; r.continuous = false; r.interimResults = true; r.maxAlternatives = 3;
  const t = G.token; let alts = null;
  r.onresult = ev => {
    const res = ev.results[ev.results.length - 1];
    if (!res.isFinal) heard(`“${res[0].transcript}”`, 'live');
    if (res.isFinal) alts = [...res].map(a => a.transcript).filter(Boolean);
  };
  r.onerror = ev => {
    if (['not-allowed', 'service-not-allowed', 'audio-capture', 'network', 'language-not-supported'].includes(ev.error)) {
      G.voice = false;
      G.voiceMsg = ev.error === 'not-allowed' ? 'Microphone permission was denied. Tap your answer.'
        : ev.error === 'network' ? 'Voice needs an internet connection here. Tap your answer.' : 'Voice isn’t available here. Tap your answer.';
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
    u.lang = 'en-US'; u.rate = 1.05; u.onend = done; u.onerror = done;
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
  txt.textContent = G.i < 0 ? '' : !G.voice ? (G.voiceMsg || 'Voice isn’t available in this browser. Tap your answer.')
    : micMsg || (G.speaking ? 'Reading the question… tap the mic to answer now' : G.listening ? 'Listening…' : 'Paused. Tap the mic to answer by voice.');
}
function render() {
  const body = $('gBody'), s = step(), e = entry();
  $('gNav').hidden = false; $('gAlt').hidden = false;
  const inSec = G.steps.filter(x => x.sec === s.sec && applies(x, e));
  $('gCount').innerHTML = `<b>${esc(s.sec)}</b> · ${inSec.indexOf(s) + 1} of ${inSec.length}`;
  $('gBar').style.width = (completion(current) * 100) + '%';
  const v = e[s.f.id], unsure = isUnsure(e, s.f.id), y = yesterdayOf(s.f.id);
  let html = G.showTip ? `<div class="g-tip" id="gTip"><span>Answer with a word or two, like <b>“high”</b> or <b>“a bit”</b>. You can also say <b>“skip”</b>, <b>“back”</b> or <b>“stop”</b>.</span><button id="gTipOk">Got it</button></div>` : '';
  html += `<div class="g-title">${esc(s.title)}</div>`;
  if (s.sub) html += `<div class="g-sub">${esc(s.sub)}</div>`;
  if (y !== undefined && s.type !== 'note') html += `<div class="g-y">Yesterday: ${esc(String(optLabel(s, y)).toLowerCase())}</div>`;
  const pop = G.picked === s.f.id; G.picked = null;
  let n = 0;
  const opt = (val, label, extra = '', cls = '') => {
    const on = v === val && !unsure;
    return `<button class="g-opt ${cls} ${on ? 'on' : ''} ${on && pop ? 'picked' : ''}" data-v="${val}" style="--i:${n++}">${esc(label)}${extra}${on ? icon('check', 'g-ck') : ''}</button>`;
  };
  const ytag = val => y === val ? ' <span class="g-tag">yesterday</span>' : '';
  let hint = '';
  switch (s.type) {
    case 'slider': {
      const o = labelsFor(s);
      html += `<div class="g-opts">` + [0, 1, 2, 3, 4].map(i => i % 2 === 0
        ? opt(i, o[i], `<small>${esc(s.f.means[i / 2])}${ytag(i)}</small>`)
        : opt(i, o[i], `<small>in between${ytag(i)}</small>`, 'mid')).join('') + `</div>`;
      if (unsure) html += `<div class="g-y">Marked as not sure.</div>`;
      hint = `Say “${o[0].toLowerCase()}”, “${o[2].toLowerCase()}” or “${o[4].toLowerCase()}”, or in between like “${o[1].toLowerCase()}”.`;
      break;
    }
    case 'hours': {
      if (G.pending === null) G.pending = v ?? lastSleep();
      html += `<div class="g-hours"><button data-h="-0.5" aria-label="Less">−</button><div class="g-hval">${G.pending}h</div><button data-h="0.5" aria-label="More">+</button></div>
        <button class="g-opt g-confirm ${v === G.pending ? 'on' : ''} ${pop ? 'picked' : ''}" data-ok="1">${v === G.pending ? 'Saved' : 'That’s right'}</button>`;
      hint = 'Say a number, like “seven and a half”.';
      break;
    }
    case 'multi': {
      if (G.pending === null) G.pending = [...(v || [])];
      html += `<div class="chips wrap g-chips">` + TRIGGERS.map(t =>
        `<button class="chip ${G.pending.includes(t) ? 'on' : ''}" data-t="${esc(t)}" style="--i:${n++}">${esc(t)}</button>`).join('') + `</div>
        <button class="g-opt g-confirm ${pop ? 'on picked' : ''}" data-ok="1">${pop ? 'Saved' : G.pending.length ? 'Done' : 'Nothing in particular'}</button>`;
      hint = 'Say any that fit, like “lonely and bored”, or “nothing”.';
      break;
    }
    case 'note': {
      html += `<textarea class="g-note" placeholder="Optional">${esc(v || '')}</textarea><button class="g-opt g-confirm ${pop ? 'on picked' : ''}" data-ok="1">${pop ? 'Saved' : 'Save note'}</button>`;
      hint = 'Say what happened, or “skip”.';
      break;
    }
    default: {
      const o = labelsFor(s);
      const row = s.type === 'yesno' || s.type === 'three';
      html += `<div class="${row ? 'g-row' : 'g-opts'}">` + o.map((l, i) => opt(i, l, ytag(i))).join('') + `</div>`;
      hint = s.type === 'yesno' ? 'Say “yes” or “no”.' : s.type === 'minutes' ? 'Say “none”, “twenty minutes”, “two hours”…'
        : `Say ${o.map(l => `“${l.toLowerCase()}”`).join(', ')}.`;
    }
  }
  if (G.voice) html += `<div class="g-hint">${esc(hint)}<br><span>You can also say “skip”, “back”, “not sure”, “same as yesterday” or “stop”.</span></div>`;
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
    const f = field(id); const val = isUnsure(e, id) ? 'not sure' : e[id] === undefined ? '—' : display(f, e[id]);
    return `<li style="--i:${i}"><b>${esc(f.label)}:</b> ${esc(val)}</li>`;
  }).join('');
  const gaps = counted().filter(q => e[q.id] === undefined && !isUnsure(e, q.id)).length;
  $('gCount').textContent = 'Done'; $('gBar').style.width = (completion(current) * 100) + '%';
  $('gBody').innerHTML = `<div class="g-done-ck" aria-hidden="true"><svg viewBox="0 0 56 56"><circle cx="28" cy="28" r="26"/><path d="M17 29l7.5 7.5L40 21"/></svg></div>
    <div class="g-title">${gaps ? 'Saved' : 'All done'}</div>
    <div class="g-sub">${G.answered.length ? 'Here’s what you answered:' : 'Nothing was changed.'}</div>
    ${items ? `<ul class="g-sum">${items}</ul>` : ''}
    ${gaps ? `<div class="g-y">${gaps} question${gaps > 1 ? 's' : ''} still open. You can answer ${gaps > 1 ? 'them' : 'it'} on the check-in page.</div>` : ''}
    <button class="g-opt g-confirm on" id="gDone">Done</button>
    ${G.answered.length ? '<button class="g-opt g-confirm" id="gUndoAll">Undo all of these</button>' : ''}`;
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
