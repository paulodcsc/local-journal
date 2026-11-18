// Turns a spoken (or typed) sentence into check-in answers.
// Example: "slept seven and a half hours, kind of stressed, mood same as yesterday, not sure about anxiety"
// Runs entirely in the browser: no network, no AI service.
//
// Feeling scales use 5 positions (0–4): three anchors (0, 2, 4) and two in-betweens (1, 3).
// Hedged speech lands in between: "a bit stressed" → 1, "stressed" → 2, "pretty stressed" → 3, "very stressed" → 4.
(function (root) {
  const NUMBERS = {
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
    ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, twenty: 20,
    thirty: 30, forty: 40, fifty: 50, sixty: 60, ninety: 90, an: 1, a: 1,
  };
  // Multi-word phrases collapsed into single tokens, applied in this order.
  const PHRASES = [
    // in-between positions (before "kind of" → little)
    ['kind of high', 'MEDHIGH'], ['medium high', 'MEDHIGH'], ['medium to high', 'MEDHIGH'], ['between medium | high', 'MEDHIGH'],
    ['moderately high', 'MEDHIGH'], ['quite high', 'MEDHIGH'], ['fairly high', 'MEDHIGH'], ['pretty high', 'MEDHIGH'],
    ['low medium', 'LOWMED'], ['medium low', 'LOWMED'], ['low to medium', 'LOWMED'], ['between low | medium', 'LOWMED'],
    ['pretty good', 'PRETTYGOOD'], ['quite good', 'PRETTYGOOD'], ['fairly good', 'PRETTYGOOD'],
    ['out of 10', 'OF10'], ['out of ten', 'OF10'], ['out of 5', ''], ['out of five', ''],
    // corrections ("stress high… no wait, medium")
    ['no wait', 'CORR'], ['scratch that', 'CORR'], ['i mean', 'CORR'], ['make that', 'CORR'], ['make it', 'CORR'],
    ['actually', 'CORR'], ['correction', 'CORR'], ['sorry', 'CORR'], ['wait', 'CORR'],
    // comparisons with yesterday
    ['compared to yesterday', ''], ['same as yesterday', 'SAME'], ['the same', 'SAME'], ['as yesterday', ''],
    ['than yesterday', ''], ['yesterday', ''], ['more or less', 'ok'],
    // durations & amounts
    ['half an hour', 'HALFHOUR'], ['half hour', 'HALFHOUR'], ['| a half', 'PLUSHALF'], ['| half', 'PLUSHALF'], ['hour | a half', 'hour PLUSHALF'],
    ['very very', 'very'], ['very high', 'VHIGH'], ['really high', 'VHIGH'], ['super high', 'VHIGH'], ['extremely', 'VHIGH'],
    ['through the roof', 'VHIGH'], ['very low', 'none'], ['very good', 'great'], ['really good', 'great'],
    ['super good', 'great'], ['not great', 'poor'], ['not good', 'poor'],
    ['not bad', 'ok'], ['so so', 'ok'], ['very bad', 'awful'], ['really bad', 'awful'], ['a lot', 'LOT'], ['lots', 'LOT'],
    ['too much', 'LOT'], ['a bit', 'little'], ['a little', 'little'], ['kind of', 'little'], ['sort of', 'little'],
    ['not at all', 'none'], ['not really', 'little'], ['social media', 'SOCIAL'], ['tik tok', 'tiktok'],
    ['self conscious', 'selfconscious'], ['got a lot done', 'productive great'], ['got LOT done', 'productive great'],
    ['got things done', 'productive good'], ['got some things done', 'productive ok'], ['got nothing done', 'productive bad'],
    ['unproductive', 'productive bad'], ['not productive', 'productive bad'], ['went out', 'outside'], ['got outside', 'outside'], ['worked out', 'workout'], ['work out', 'workout'],
    ['did not', 'not'], ["didn't", 'not'], ['did nt', 'not'], ["haven't", 'not'],
    ["don't", 'not'], ['do not', 'not'], ["wasn't", 'not'], ["isn't", 'not'], ["i'm", 'im'],
    // uncertainty (after the "don't" → "not" step)
    ['not sure', 'UNSURE'], ['not know', 'UNSURE'], ['no idea', 'UNSURE'], ['hard to say', 'UNSURE'],
    ['not certain', 'UNSURE'], ['unsure', 'UNSURE'], ['dunno', 'UNSURE'], ['skip', 'UNSURE'],
  ];

  const KEYWORDS = {
    sleep: ['slept', 'sleep', 'sleeping'],
    rested: ['rested', 'rest', 'restful'],
    mood: ['mood'],
    stress: ['stress', 'stressed', 'stressful'],
    anxiety: ['anxiety', 'anxious', 'nervous', 'worried'],
    irritable: ['irritable', 'irritability', 'irritated', 'annoyed', 'cranky', 'grumpy', 'angry'],
    insecure: ['insecure', 'insecurity', 'insecurities', 'selfconscious'],
    energy: ['energy', 'energetic'],
    productive: ['productive', 'productivity'],
    instagram: ['instagram', 'insta', 'SOCIAL', 'tiktok', 'scrolling', 'scrolled', 'phone'],
    ate: ['ate', 'eat', 'eaten', 'eating', 'food', 'meals', 'meal'],
    water: ['water', 'hydrated', 'hydration'],
    moved: ['exercise', 'exercised', 'workout', 'gym', 'walk', 'walked', 'run', 'ran', 'moved', 'yoga', 'sport', 'training', 'trained'],
    outside: ['outside', 'outdoors', 'daylight', 'sunlight', 'sun'],
    social: ['talked', 'talk', 'conversation', 'friend', 'friends', 'called', 'socialized'],
    caffeine: ['caffeine', 'coffee', 'espresso'],
    alcohol: ['alcohol', 'drinks', 'drinking', 'beer', 'beers', 'wine', 'booze', 'drunk'],
    meds: ['medication', 'meds', 'medicine', 'pills', 'pill'],
  };
  const KW = {};
  for (const [id, words] of Object.entries(KEYWORDS)) for (const w of words) KW[w] = id;

  // Value vocabularies (5 positions) ---------------------------------------
  // "Amount" scales (stress, anxiety, ...): 0 low · 1 mild · 2 medium · 3 quite high · 4 high
  const AMOUNT = { none: 0, no: 0, zero: 0, nothing: 0, not: 0, calm: 0, low: 0, relaxed: 0,
    little: 1, slightly: 1, mild: 1, mildly: 1, bit: 1, somewhat: 1, LOWMED: 1,
    some: 2, medium: 2, moderate: 2, moderately: 2, ok: 2, okay: 2, average: 2, normal: 2, mid: 2,
    MEDHIGH: 3, pretty: 3, quite: 3, fairly: 3,
    high: 4, very: 4, really: 4, so: 4, super: 4, LOT: 4, VHIGH: 4, max: 4, maximum: 4, insane: 4, crazy: 4 };
  // "Quality" scales (mood, rested, energy): 0 bad · 1 not great · 2 ok · 3 pretty good · 4 good
  const QUALITY = { awful: 0, terrible: 0, horrible: 0, shit: 0, worst: 0, exhausted: 0, dead: 0, bad: 0, drained: 0, none: 0, stuck: 0,
    poor: 1, low: 1, slow: 1, tired: 1, meh: 1, sluggish: 1, down: 1, sad: 1, little: 1, LOWMED: 1,
    ok: 2, okay: 2, fine: 2, alright: 2, average: 2, normal: 2, decent: 2, medium: 2, some: 2, neutral: 2,
    PRETTYGOOD: 3, MEDHIGH: 3, pretty: 3, fairly: 3, quite: 3, nice: 3,
    good: 4, well: 4, high: 4, great: 4, amazing: 4, excellent: 4, fantastic: 4, awesome: 4, VHIGH: 4, perfect: 4, very: 4, really: 4, happy: 4 };
  const INTENSIFIERS = new Set(['very', 'really', 'so', 'super', 'pretty', 'quite', 'fairly']);
  const YES = new Set(['yes', 'yeah', 'yep', 'yup', 'did', 'done', 'took', 'some', 'LOT', 'little']);
  const NO = new Set(['no', 'nope', 'not', 'none', 'zero', 'never', 'without', 'skipped', 'nothing', 'nah']);
  const THREE = { // ate / water: 0 barely, 1 some, 2 yes
    yes: 2, yeah: 2, enough: 2, drank: 2, drink: 2, hydrated: 2, yep: 2, well: 2, good: 2, great: 2, properly: 2, plenty: 2, LOT: 2, normal: 2, ok: 2, okay: 2, fine: 2, all: 2, healthy: 2,
    some: 1, little: 1, bit: 1, partly: 1, half: 1, kinda: 1, meh: 1, poorly: 1, bad: 1, junk: 1,
    no: 0, not: 0, barely: 0, nothing: 0, none: 0, skipped: 0, zero: 0, never: 0, hardly: 0, without: 0,
  };
  // How to read normalized tokens back to the person ("Heard: …")
  const PLAIN = { VHIGH: 'very high', LOT: 'a lot', MEDHIGH: 'medium-high', LOWMED: 'low-medium', CORR: 'actually', SAME: 'same as yesterday',
    UNSURE: 'not sure', HALFHOUR: 'half an hour', PLUSHALF: 'and a half', SOCIAL: 'social media', PRETTYGOOD: 'pretty good',
    OF10: 'out of 10', little: 'a bit', im: "I'm", selfconscious: 'self-conscious' };

  function normalize(text) {
    let t = ' ' + text.toLowerCase().replace(/[’`]/g, "'") + ' ';
    t = t.replace(/(\d)[.,](\d+)/g, '$1xdotx$2');                   // 6.5 / 6,5
    t = t.replace(/[.,;!?]+|\b(?:and|but|then|also|plus)\b/g, ' | '); // clause breaks
    t = t.replace(/([a-z])-([a-z])/g, '$1 $2');                       // medium-high → medium high
    t = t.replace(/[^a-z0-9'| -]+/g, ' ').replace(/\s+/g, ' ');
    for (const [from, to] of PHRASES) t = t.split(` ${from} `).join(` ${to} `).split(` ${from} `).join(` ${to} `);
    return t;
  }
  function tokens(text) {
    return normalize(text).split(/[\s-]+/).filter(Boolean).map(w => {
      if (w in NUMBERS && w !== 'a' && w !== 'an') return String(NUMBERS[w]);
      return w.replace(/^(\d+)xdotx(\d+)$/, '$1.$2');
    });
  }
  const num = w => (/^\d+(\.\d+)?$/.test(w) ? parseFloat(w) : null);
  const plain = seg => seg.filter(w => w !== '|').map(w => PLAIN[w] ?? w).join(' ');

  function sleepValue(seg) {
    for (let i = 0; i < seg.length; i++) {
      const n = num(seg[i]);
      if (n !== null && n <= 16) return seg[i + 1] === 'PLUSHALF' || seg[i + 1] === 'half' ? n + 0.5 : n;
    }
    return null;
  }
  function minutes(seg) {
    if (seg.some(w => NO.has(w))) return 0;
    if (seg.includes('HALFHOUR')) return 30;
    for (let i = 0; i < seg.length; i++) {
      let n = num(seg[i]);
      if (n === null && (seg[i] === 'an' || seg[i] === 'a') && /^(hour|hours|h|hr)$/.test(seg[i + 1] || '')) n = 1;
      if (n === null) continue;
      let unit = seg[i + 1] || '';
      let extra = 0;
      if (unit === 'PLUSHALF' || unit === 'half') { extra = 0.5; unit = seg[i + 2] || 'hours'; }
      if (/^(min|mins|minute|minutes)$/.test(unit)) return n;
      if (/^(hour|hours|h|hr|hrs)$/.test(unit)) return (n + extra) * 60;
      return n <= 6 ? (n + extra) * 60 : n; // bare number: small = hours, big = minutes
    }
    if (seg.includes('LOT')) return 120;
    if (seg.includes('little')) return 20;
    return null;
  }
  const minutesToIdx = m => (m <= 0 ? 0 : m < 30 ? 1 : m < 60 ? 2 : m < 120 ? 3 : 4);
  const clamp = v => Math.max(0, Math.min(4, v));

  // "same as yesterday", "more stressed", "better mood" → relative to yesterday's answer
  function compareValue(seg, kind, prev) {
    let dir = null;
    for (const w of seg) {
      if (w === 'SAME' || w === 'same') return prev ?? 'NOPREV';
      if (['more', 'higher', 'increased', 'up'].includes(w)) dir = 1;
      if (['less', 'lower', 'decreased', 'fewer'].includes(w)) dir = -1;
      if (w === 'better') dir = kind === 'quality' ? 1 : -1;
      if (w === 'worse') dir = kind === 'quality' ? -1 : 1;
    }
    if (dir === null) return null;
    if (prev === undefined || prev === null) return 'NOPREV'; // nothing to compare against: don't guess
    const big = seg.some(w => ['LOT', 'VHIGH', 'much', 'way'].includes(w));
    return clamp(prev + dir * (big ? 2 : 1));
  }
  function scaleValue(seg, kind, prev) {
    if (seg.includes('UNSURE')) return 'UNSURE';
    const rel = compareValue(seg, kind, prev);
    if (rel !== null) return rel;
    const vocab = kind === 'quality' ? QUALITY : AMOUNT;
    // "stress 4" (1–5) or "7 out of 10"
    const ten = seg.includes('OF10');
    for (const w of seg) {
      const n = num(w); if (n === null) continue;
      if (ten && n <= 10) return clamp(Math.round(n / 10 * 4));
      if (n >= 1 && n <= 5 && Number.isInteger(n)) return n - 1;
    }
    let fallback = null;
    for (let i = 0; i < seg.length; i++) {
      const w = seg[i];
      if (w === 'not' && kind === 'amount') { const nxt = seg[i + 1]; return nxt === 'very' || nxt === 'that' || nxt === 'too' || nxt === 'so' ? 1 : 0; }
      if (w === 'not' && kind === 'quality') { const nxt = seg[i + 1]; if (QUALITY[nxt] >= 3) return 1; if (QUALITY[nxt] <= 1) return 2; continue; }
      if (w in vocab) {
        if (INTENSIFIERS.has(w)) { if (fallback === null) fallback = vocab[w]; continue; } // "very" + a real word wins
        return vocab[w];
      }
    }
    return fallback;
  }
  function yesNoValue(seg, before) {
    for (const w of seg) { if (NO.has(w)) return 0; if (YES.has(w)) return 1; }
    if (before.some(w => NO.has(w))) return 0;
    return null;
  }
  function threeValue(seg, before) {
    for (const w of seg) if (w in THREE) return THREE[w];
    if (before.some(w => w === 'not' || w === 'no' || w === 'barely' || w === 'never' || w === 'hardly')) return 0;
    return null;
  }

  const KIND = { rested: 'quality', mood: 'quality', energy: 'quality', productive: 'quality', stress: 'amount', anxiety: 'amount', irritable: 'amount', insecure: 'amount' };
  // Words that themselves mean "present" when said without a value: "I was stressed", "felt anxious"
  const IMPLIES_SOME = new Set(['stressed', 'anxious', 'nervous', 'worried', 'irritated', 'annoyed', 'cranky', 'grumpy', 'angry', 'irritable', 'insecure', 'selfconscious', 'rested', 'energetic', 'productive']);
  const IMPLIED_DEFAULT = { rested: 3, energy: 3, productive: 3 };

  // Behaviours are named by the user ("Obsessive flirting"), so their keywords come from the name:
  // "flirting" → stem "flirt" matches flirted / flirty / flirt.
  const BEH_STOP = new Set('obsessive obsessively compulsive compulsively myself yourself others other people guys girls someone with about too much really very the and for from his her their when what'.split(' '));
  const stemsOf = name => name.toLowerCase().split(/[^a-z']+/)
    .filter(w => w.length > 3 && !BEH_STOP.has(w))
    .map(w => w.replace(/(ing|ed|es|s|e)$/, '')).filter(w => w.length >= 4);
  const URGE_W = new Set(['urge', 'urges', 'wanted', 'want', 'tempted', 'temptation', 'craving', 'itch', 'itching', 'impulse']);
  const RESIST_W = new Set(['not', 'no', 'never', 'resisted', 'resist', 'avoided', 'stopped', 'held', 'without', 'zero', 'none', 'nope']);
  const ACTED_W = new Set(['did', 'gave', 'caved', 'anyway', 'acted', 'still', 'yes', 'yeah']);
  function freq(seg) { // 0 no · 1 once · 2 a few times · 3 a lot
    for (const w of seg) {
      if (['once', '1', 'little', 'bit'].includes(w)) return 1;
      if (['twice', 'couple', 'few', 'several', 'some', '2', '3', '4', '5'].includes(w)) return 2;
      if (['LOT', 'VHIGH', 'many', 'constantly', 'obsessively', 'compulsively', 'nonstop', 'all', 'much', 'very', 'really'].includes(w)) return 3;
      const n = num(w); if (n !== null && n > 5) return 3;
    }
    return null;
  }
  function urgeLevel(seg) { // 0 none · 1 mild · 2 moderate · 3 strong · 4 overwhelming
    for (const w of seg) {
      if (['none', 'no', 'not', 'zero', 'nothing'].includes(w)) return 0;
      if (['VHIGH', 'LOT', 'huge', 'intense', 'overwhelming', 'very', 'really', 'super', 'so', 'badly', 'insane'].includes(w)) return 4;
      if (['little', 'mild', 'slight', 'small', 'low', 'bit', 'tiny', 'weak', 'LOWMED'].includes(w)) return 1;
      if (['strong', 'big', 'high', 'MEDHIGH', 'pretty', 'quite', 'fairly'].includes(w)) return 3;
      if (['some', 'medium', 'moderate', 'okay', 'ok'].includes(w)) return 2;
    }
    return 2;
  }
  // Keep only what comes after the last correction word ("high, actually medium" → "medium")
  const afterCorrection = seg => { const c = seg.lastIndexOf('CORR'); return c < 0 ? seg : seg.slice(c + 1); };

  // opts: { behaviors: [{id, name}], prev: yesterday's entry } (an array is accepted as behaviors)
  function parse(text, opts = {}) {
    const behaviors = Array.isArray(opts) ? opts : (opts.behaviors || []);
    const prevDay = (!Array.isArray(opts) && opts.prev) || {};
    const behStems = behaviors.map(b => ({ id: b.id, stems: stemsOf(b.name) })).filter(b => b.stems.length);
    let note = null;
    const noteMatch = text.match(/\b(?:note|notes|diary|journal)\b[:,]?\s*(.*)$/i);
    if (noteMatch) { note = noteMatch[1].trim(); text = text.slice(0, noteMatch.index); }

    const toks = tokens(text);
    const hits = []; // {id, i, word}
    toks.forEach((w, i) => {
      const b = behStems.find(x => x.stems.some(st => w.startsWith(st)));
      if (b) { const prev = hits[hits.length - 1]; if (!(prev && prev.id === 'beh:' + b.id && i - prev.i <= 3)) hits.push({ id: 'beh:' + b.id, i, word: w }); }
      else if (KW[w]) hits.push({ id: KW[w], i, word: w });
    });
    // "energy drink" is caffeine, not energy
    hits.forEach(h => { if (h.word === 'energy' && /^drinks?$/.test(toks[h.i + 1] || '')) h.id = 'caffeine'; });
    // "drink(s)" next to water/coffee belongs to that, not alcohol
    for (const h of hits) if (h.id === 'alcohol' && /^(drinks|drinking)$/.test(h.word)) {
      const near = toks.slice(Math.max(0, h.i - 2), h.i + 3);
      if (near.some(w => KW[w] === 'water' || KW[w] === 'caffeine')) h.id = null;
    }
    // "rest of the day" isn't about feeling rested
    for (const h of hits) if (h.word === 'rest' && toks[h.i + 1] === 'of') h.id = null;

    const valid = hits.filter(h => h.id);
    const result = {}, heard = {}, unsure = new Set(), noPrev = new Set(), used = new Set();
    // Words after a keyword, up to the next keyword or clause break. A clause starting with a
    // correction ("…, actually 7") still belongs to it.
    const afterIdx = k => {
      const end = k + 1 < valid.length ? valid[k + 1].i : toks.length, out = [];
      for (let j = valid[k].i + 1; j < end && out.length < 10; j++) {
        if (toks[j] === '|') { if (toks[j + 1] === 'CORR' || toks[j - 1] === 'CORR') continue; break; }
        out.push(j);
      }
      return out;
    };
    const after = k => afterIdx(k).map(j => toks[j]);
    const beforeIdx = k => {
      const out = [];
      for (let j = valid[k].i - 1; j >= 0 && j >= valid[k].i - 3; j--) {
        if ((k > 0 && j <= valid[k - 1].i) || toks[j] === '|') break;
        out.unshift(j);
      }
      return out;
    };

    function read(id, seg, before) {
      seg = afterCorrection(seg);
      if (id === 'sleep') return sleepValue(seg);
      if (id === 'instagram') { const m = minutes(seg); return m === null ? null : minutesToIdx(m); }
      if (id === 'ate' || id === 'water') return threeValue(seg, before);
      if (KIND[id]) return scaleValue(seg, KIND[id], prevDay[id]);
      return yesNoValue(seg, before);
    }
    function set(id, v, idxs) {
      if (v === 'NOPREV') { if (!(id in result)) noPrev.add(id); return; }
      noPrev.delete(id);
      if (v === 'UNSURE') { unsure.add(id); delete result[id]; }
      else { result[id] = v; unsure.delete(id); }
      heard[id] = plain(idxs.slice().sort((a, b) => a - b).map(j => toks[j]));
    }

    // Pass 1: value right after the keyword ("stress high"). Later mentions win, so
    // "stress high… stress medium" ends on medium.
    valid.forEach((h, k) => {
      if (h.id.startsWith('beh:')) return;
      let idx = afterIdx(k);
      // "mood, not sure" — uncertainty in the next clause
      if (!idx.length && toks[h.i + 1] === '|' && toks[h.i + 2] === 'UNSURE' && KIND[h.id]) idx = [h.i + 2];
      const v = read(h.id, idx.map(j => toks[j]), beforeIdx(k).map(j => toks[j]));
      if (v !== null) { set(h.id, v, [h.i, ...idx]); idx.forEach(j => used.add(j)); }
    });
    // Pass 2: value just before the keyword ("high stress", "8 hours of sleep", "no alcohol")
    valid.forEach((h, k) => {
      if (h.id.startsWith('beh:') || h.id in result || unsure.has(h.id) || noPrev.has(h.id)) return;
      const idx = beforeIdx(k).filter(j => !used.has(j));
      const seg = idx.map(j => toks[j]);
      let v = h.id === 'sleep' ? sleepValue(seg)
        : h.id === 'instagram' ? (() => { const m = minutes(seg); return m === null ? null : minutesToIdx(m); })()
        : read(h.id, seg, seg);
      // Pass 3: just mentioning it ("I exercised", "felt anxious", "ate")
      if (v === null) {
        if (KIND[h.id] && IMPLIES_SOME.has(h.word)) v = IMPLIED_DEFAULT[h.id] ?? 2;
        else if (!KIND[h.id] && h.id !== 'sleep' && h.id !== 'instagram') {
          v = h.id === 'ate' || h.id === 'water' ? 2 : 1;
          if (['food', 'meals', 'meal', 'water', 'hydration'].includes(h.word) || h.word === 'phone') v = null; // too vague alone
        }
      }
      if (v !== null) { set(h.id, v, [...idx, h.i]); idx.forEach(j => used.add(j)); }
    });

    // Behaviours: "strong urge to flirt but I didn't", "compared myself a lot", "no flirting"
    valid.forEach((h, k) => {
      if (!h.id.startsWith('beh:')) return;
      const id = h.id.slice(4);
      if (result[id + '_did'] !== undefined || result[id + '_urge'] !== undefined) return;
      const bIdx = [];
      for (let j = h.i - 1; j >= 0 && j >= h.i - 5; j--) { if (toks[j] === '|' || (k > 0 && j <= valid[k - 1].i)) break; bIdx.unshift(j); }
      const before = bIdx.map(j => toks[j]);
      const aIdx = afterIdx(k), aft = afterCorrection(aIdx.map(j => toks[j]));
      // the following clause, unless it's about something else ("…, but I didn't")
      const nIdx = [];
      let j = h.i + 1 + aIdx.length;
      if (toks[j] === '|') for (j++; j < toks.length && toks[j] !== '|' && !valid.some(v => v.i === j); j++) nIdx.push(j);
      const next = nIdx.map(i => toks[i]);
      const span = [...bIdx, h.i, ...aIdx];
      if ([...before, ...aft].some(w => URGE_W.has(w))) {
        const u = urgeLevel([...before, ...aft]);
        set(id + '_urge', u, span);
        const tail = [...aft, ...next];
        if (u === 0 || tail.some(w => RESIST_W.has(w))) set(id + '_did', 0, [...span, ...nIdx]);
        else if (tail.some(w => ACTED_W.has(w)) || freq(tail) !== null) set(id + '_did', freq(tail) ?? 1, [...span, ...nIdx]);
      } else if (before.some(w => RESIST_W.has(w)) || RESIST_W.has(aft[0])) {
        set(id + '_did', 0, span);
      } else {
        set(id + '_did', freq(aft) ?? 1, span); // just mentioning it means you did it
      }
    });

    if (unsure.size) result.unsure = [...unsure];
    if (noPrev.size) result.noPrev = [...noPrev]; // "same as yesterday" but yesterday is empty
    if (note) result.note = note;
    else if (!Object.keys(result).length && text.trim()) result.note = text.trim(); // nothing recognised: keep it as a note
    if (Object.keys(heard).length) result._heard = heard;
    return result;
  }

  // ---------------------------------------------------------------------------------------------
  // Guided mode: read a short answer to ONE known question ("high", "a bit", "yes", "seven and a half").
  // ctx: { type: 'slider'|'hours'|'minutes'|'three'|'yesno'|'freq'|'multi'|'note',
  //        kind: 'amount'|'quality'|'urge' (sliders), labels: [...], prev: yesterday's value }
  // Returns { value } | { cmd: 'skip'|'back'|'repeat'|'stop' } | { unsure: true } | { noPrev: true } | null
  const TRIGGER_WORDS = {
    'Bored': ['bored', 'boredom', 'boring'], 'Lonely': ['lonely', 'alone', 'loneliness', 'isolated'],
    'Anxious': ['anxious', 'anxiety', 'nervous', 'worried', 'stressed', 'stress'], 'Felt rejected': ['rejected', 'rejection', 'ignored', 'left on read', 'ghosted'],
    'Scrolling': ['scrolling', 'scrolled', 'instagram', 'insta', 'phone', 'social media', 'tiktok'], 'Tired': ['tired', 'exhausted', 'sleepy'],
    'Drinking': ['drinking', 'drunk', 'alcohol', 'drinks', 'tipsy'], 'After a fight': ['fight', 'argument', 'argued', 'fought', 'conflict'],
    'Other': ['other', 'something else'],
  };
  const clean = t => ' ' + t.toLowerCase().replace(/[’`]/g, "'").replace(/[-_]/g, ' ').replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
  const hasWord = (raw, phrase) => raw.includes(' ' + phrase.toLowerCase().replace(/[-_]/g, ' ') + ' ');
  function labelMatch(raw, labels, aliases = {}) {
    if (/ not /.test(raw)) return null; // "not good" isn't "good"
    const cands = labels.map((l, i) => [l.toLowerCase(), i]);
    for (const [k, i] of Object.entries(aliases)) cands.push([k, +i]);
    cands.sort((a, b) => b[0].length - a[0].length); // "quite high" before "high"
    for (const [l, i] of cands) if (hasWord(raw, l)) return i;
    return null;
  }
  function urgeWord(seg) {
    for (const w of seg) {
      if (['none', 'no', 'not', 'zero', 'nothing'].includes(w)) return 0;
      if (['VHIGH', 'LOT', 'huge', 'intense', 'overwhelming', 'very', 'really', 'super', 'insane'].includes(w)) return 4;
      if (['little', 'mild', 'slight', 'small', 'low', 'bit', 'tiny', 'weak', 'LOWMED'].includes(w)) return 1;
      if (['strong', 'big', 'high', 'MEDHIGH', 'pretty', 'quite', 'fairly'].includes(w)) return 3;
      if (['some', 'medium', 'moderate', 'okay', 'ok'].includes(w)) return 2;
    }
    return null;
  }
  function answer(text, ctx) {
    const raw = clean(text), words = raw.trim().split(' ').filter(Boolean), short = words.length <= 4;
    if (!raw.trim()) return null;
    // Commands (only when the reply is short, so "I couldn't stop…" isn't "stop")
    if (short && /^ (stop|done|finish|finished|that's all|thats all|exit|quit|i'm done|im done|end|close)( it| now| please)? $/.test(raw)) return { cmd: 'stop' };
    if (short && /^ (go )?(back|previous|go back|last one|undo)( please)? $/.test(raw)) return { cmd: 'back' };
    if (short && /^ (repeat|again|say (that|it) again|what|sorry what|pardon|come again)( please)? $/.test(raw)) return { cmd: 'repeat' };
    if (short && /^ (skip|next|pass|skip it|next one|next question|skip this( one)?)( please)? $/.test(raw)) return { cmd: 'skip' };
    if (/ (not sure|don't know|dont know|do not know|no idea|unsure|dunno|hard to say|can't say|cant say) /.test(raw))
      return ctx.type === 'slider' ? { unsure: true } : { cmd: 'skip' };
    if (/ same /.test(raw) && ctx.type !== 'note') return ctx.prev !== undefined && ctx.prev !== null ? { value: ctx.prev } : { noPrev: true };

    const toks = tokens(text).filter(w => w !== '|');
    let v = null;
    switch (ctx.type) {
      case 'slider': {
        // "pretty high", "medium-high", "between low and medium" are in-betweens, not the label inside them
        const between = toks.includes('MEDHIGH') ? 3 : toks.includes('LOWMED') ? 1 : null;
        v = between ?? labelMatch(raw, ctx.labels, { okay: 2, medium: 2, middle: 2 });
        if (v === null && ctx.kind === 'urge') v = urgeWord(toks);
        if (v === null && ctx.kind !== 'urge') v = scaleValue(toks, ctx.kind, ctx.prev);
        if (v === 'UNSURE') return { unsure: true };
        if (v === 'NOPREV') return { noPrev: true };
        break;
      }
      case 'hours': v = sleepValue(toks); break;
      case 'minutes': { const m = minutes(toks); v = m === null ? (hasWord(raw, 'none') ? 0 : null) : minutesToIdx(m); break; }
      case 'three': v = labelMatch(raw, ctx.labels); if (v === null) v = threeValue(toks, []); break;
      case 'yesno': v = yesNoValue(toks, []); if (v === null && /^ (i )?(did|have|had|took|went|ate) /.test(raw)) v = 1; break;
      case 'freq': {
        v = labelMatch(raw, ctx.labels, { twice: 2, 'couple of times': 2, 'a couple': 2, 'few times': 2, never: 0, nope: 0, 'one time': 1 });
        if (v === null) v = toks.some(w => NO.has(w)) ? 0 : freq(toks);
        break;
      }
      case 'multi': {
        if (/^ (no|none|nothing|nope|nah|no idea|not really)( really)? $/.test(raw)) return { value: [] };
        const picked = (ctx.labels || []).filter(l => (TRIGGER_WORDS[l] || [l.toLowerCase()]).some(w => hasWord(raw, w)));
        v = picked.length ? picked : null;
        break;
      }
      case 'note': {
        if (/^ (no|nope|nothing|nah|no thanks|none|not really)( thanks| thank you)? $/.test(raw)) return { cmd: 'skip' };
        v = text.trim(); break;
      }
    }
    return v === null || v === undefined ? null : { value: v };
  }

  root.VoiceParse = { parse, answer };
  if (typeof module !== 'undefined') module.exports = { parse, answer };
})(typeof window !== 'undefined' ? window : globalThis);
