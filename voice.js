// Turns a spoken (or typed) sentence into check-in answers.
// Example: "slept seven and a half hours, rested good, stress high, no alcohol, instagram 2 hours"
// Runs entirely in the browser: no network, no AI service.
(function (root) {
  const NUMBERS = {
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
    ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, twenty: 20,
    thirty: 30, forty: 40, fifty: 50, sixty: 60, ninety: 90, an: 1, a: 1,
  };
  // Multi-word phrases collapsed into single tokens before tokenizing (longest first).
  const PHRASES = [
    ['half an hour', 'HALFHOUR'], ['half hour', 'HALFHOUR'], ['| a half', 'PLUSHALF'], ['| half', 'PLUSHALF'], ['hour | a half', 'hour PLUSHALF'],
    ['very very', 'very'], ['very high', 'VHIGH'], ['really high', 'VHIGH'], ['super high', 'VHIGH'], ['extremely', 'VHIGH'],
    ['through the roof', 'VHIGH'], ['very low', 'none'], ['very good', 'great'], ['really good', 'great'],
    ['super good', 'great'], ['pretty good', 'good'], ['quite good', 'good'], ['not great', 'poor'], ['not good', 'poor'],
    ['not bad', 'ok'], ['so so', 'ok'], ['very bad', 'awful'], ['really bad', 'awful'], ['a lot', 'LOT'], ['lots', 'LOT'],
    ['too much', 'LOT'], ['a bit', 'little'], ['a little', 'little'], ['kind of', 'little'], ['sort of', 'little'],
    ['not at all', 'none'], ['not really', 'little'], ['social media', 'SOCIAL'], ['tik tok', 'tiktok'],
    ['went out', 'outside'], ['got outside', 'outside'], ['worked out', 'workout'], ['work out', 'workout'],
    ['out of 5', ''], ['out of five', ''], ['did not', 'not'], ["didn't", 'not'], ['did nt', 'not'], ["haven't", 'not'],
    ["don't", 'not'], ["wasn't", 'not'], ["isn't", 'not'], ["i'm", 'im'],
  ];

  const KEYWORDS = {
    sleep: ['slept', 'sleep', 'sleeping'],
    rested: ['rested', 'rest', 'restful'],
    mood: ['mood'],
    stress: ['stress', 'stressed', 'stressful'],
    anxiety: ['anxiety', 'anxious', 'nervous', 'worried'],
    irritable: ['irritable', 'irritability', 'irritated', 'annoyed', 'cranky', 'grumpy', 'angry'],
    insecure: ['insecure', 'insecurity', 'insecurities', 'self-conscious'],
    energy: ['energy', 'energetic'],
    instagram: ['instagram', 'insta', 'SOCIAL', 'tiktok', 'scrolling', 'scrolled', 'phone'],
    ate: ['ate', 'eat', 'eaten', 'eating', 'food', 'meals', 'meal'],
    water: ['water', 'hydrated', 'hydration'],
    moved: ['exercise', 'exercised', 'workout', 'gym', 'walk', 'walked', 'run', 'ran', 'moved', 'yoga', 'sport', 'training', 'trained'],
    outside: ['outside', 'outdoors', 'daylight', 'sunlight', 'sun'],
    social: ['talked', 'talk', 'conversation', 'friend', 'friends', 'called', 'socialized'],
    caffeine: ['caffeine', 'coffee', 'espresso', 'energy-drink'],
    alcohol: ['alcohol', 'drinks', 'drinking', 'beer', 'beers', 'wine', 'booze', 'drunk'],
    meds: ['medication', 'meds', 'medicine', 'pills', 'pill'],
  };
  const KW = {};
  for (const [id, words] of Object.entries(KEYWORDS)) for (const w of words) KW[w] = id;

  // Value vocabularies -----------------------------------------------------
  // "Amount" scales (stress, anxiety, ...): 0 none … 4 very high
  const AMOUNT = { none: 0, no: 0, zero: 0, nothing: 0, not: 0, calm: 0, little: 1, low: 1, slightly: 1, mild: 1, bit: 1,
    some: 2, medium: 2, moderate: 2, moderately: 2, ok: 2, okay: 2, average: 2, normal: 2,
    high: 3, very: 3, really: 3, so: 3, pretty: 3, quite: 3, LOT: 4, VHIGH: 4, max: 4, maximum: 4, insane: 4, crazy: 4 };
  // "Quality" scales (mood, rested, energy): 0 awful … 4 great
  const QUALITY = { awful: 0, terrible: 0, horrible: 0, shit: 0, worst: 0, exhausted: 0, dead: 0,
    bad: 1, poor: 1, low: 1, tired: 1, meh: 2, ok: 2, okay: 2, fine: 2, alright: 2, average: 2, normal: 2, decent: 2, medium: 2, some: 2,
    good: 3, well: 3, high: 3, nice: 3, happy: 3, great: 4, amazing: 4, excellent: 4, fantastic: 4, awesome: 4, VHIGH: 4, perfect: 4, very: 4, really: 4 };
  const YES = new Set(['yes', 'yeah', 'yep', 'yup', 'did', 'done', 'took', 'some', 'LOT', 'little']);
  const NO = new Set(['no', 'nope', 'not', 'none', 'zero', 'never', 'without', 'skipped', 'nothing', 'nah']);
  const THREE = { // ate / water: 0 barely, 1 some, 2 yes
    yes: 2, yeah: 2, enough: 2, drank: 2, drink: 2, hydrated: 2, yep: 2, well: 2, good: 2, great: 2, properly: 2, plenty: 2, LOT: 2, normal: 2, ok: 2, okay: 2, fine: 2, all: 2, healthy: 2,
    some: 1, little: 1, bit: 1, partly: 1, half: 1, kinda: 1, meh: 1, poorly: 1, bad: 1, junk: 1,
    no: 0, not: 0, barely: 0, nothing: 0, none: 0, skipped: 0, zero: 0, never: 0, hardly: 0, without: 0,
  };

  function normalize(text) {
    let t = ' ' + text.toLowerCase().replace(/[’`]/g, "'") + ' ';
    t = t.replace(/(\d)[.,](\d+)/g, '$1xdotx$2');          // 6.5 / 6,5
    t = t.replace(/[.,;!?]+|\b(?:and|but|then|also|plus)\b/g, ' | '); // clause breaks
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

  function scaleValue(id, seg, kind) {
    const vocab = kind === 'quality' ? QUALITY : AMOUNT;
    // "stress 4", "mood 3 out of 5" → 1–5 rating
    for (const w of seg) { const n = num(w); if (n !== null && n >= 1 && n <= 5 && Number.isInteger(n)) return n - 1; }
    let best = null;
    for (let i = 0; i < seg.length; i++) {
      const w = seg[i];
      if (w === 'not' && kind === 'amount') { const nxt = seg[i + 1]; if (nxt === 'very' || nxt === 'that' || nxt === 'too') return 1; return 0; }
      if (w === 'not' && kind === 'quality') { const nxt = seg[i + 1]; if (QUALITY[nxt] >= 3) return 1; if (QUALITY[nxt] <= 1) return 2; continue; }
      if (w in vocab) {
        // prefer the strongest explicit word over intensifiers like "very"
        const v = vocab[w];
        if (['very', 'really', 'so', 'pretty', 'quite'].includes(w)) { if (best === null) best = v; continue; }
        return v;
      }
    }
    return best;
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

  const KIND = { rested: 'quality', mood: 'quality', energy: 'quality', stress: 'amount', anxiety: 'amount', irritable: 'amount', insecure: 'amount' };
  // Words that themselves mean "present" when said without a value: "I was stressed", "felt anxious"
  const IMPLIES_SOME = new Set(['stressed', 'anxious', 'nervous', 'worried', 'irritated', 'annoyed', 'cranky', 'grumpy', 'angry', 'irritable', 'insecure', 'self-conscious', 'rested', 'energetic']);
  const IMPLIED_DEFAULT = { rested: 3, energy: 3 };

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
  function urgeLevel(seg) { // 0 none · 1 mild · 2 strong · 3 very strong
    for (const w of seg) {
      if (['none', 'no', 'not', 'zero', 'nothing'].includes(w)) return 0;
      if (['VHIGH', 'LOT', 'huge', 'intense', 'overwhelming', 'very', 'really', 'super', 'so', 'badly'].includes(w)) return 3;
      if (['little', 'mild', 'slight', 'small', 'low', 'bit', 'tiny', 'weak'].includes(w)) return 1;
      if (['strong', 'big', 'high', 'some'].includes(w)) return 2;
    }
    return 2;
  }

  function parse(text, behaviors = []) {
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
    const result = {}, used = new Set();
    const after = k => {
      const seg = toks.slice(valid[k].i + 1, k + 1 < valid.length ? valid[k + 1].i : toks.length).slice(0, 7);
      const stop = seg.indexOf('|'); return stop < 0 ? seg : seg.slice(0, stop);
    };
    const beforeIdx = k => {
      const out = [];
      for (let j = valid[k].i - 1; j >= 0 && j >= valid[k].i - 3; j--) {
        if ((k > 0 && j <= valid[k - 1].i) || toks[j] === '|') break;
        out.unshift(j);
      }
      return out;
    };

    function read(id, seg, before, word) {
      if (id === 'sleep') return sleepValue(seg);
      if (id === 'instagram') { const m = minutes(seg); return m === null ? null : minutesToIdx(m); }
      if (id === 'ate' || id === 'water') return threeValue(seg, before);
      if (KIND[id]) return scaleValue(id, seg, KIND[id]);
      return yesNoValue(seg, before);
    }

    // Pass 1: value right after the keyword ("stress high", "slept 7 hours")
    valid.forEach((h, k) => {
      if (h.id.startsWith('beh:') || h.id in result) return;
      const before = beforeIdx(k).map(j => toks[j]);
      const v = read(h.id, after(k), before, h.word);
      if (v !== null) { result[h.id] = v; after(k).forEach((_, j) => used.add(h.i + 1 + j)); }
    });
    // Pass 2: value just before the keyword ("high stress", "8 hours of sleep", "no alcohol")
    valid.forEach((h, k) => {
      if (h.id.startsWith('beh:') || h.id in result) return;
      const idx = beforeIdx(k).filter(j => !used.has(j));
      const seg = idx.map(j => toks[j]);
      let v = h.id === 'sleep' ? sleepValue(seg)
        : h.id === 'instagram' ? (() => { const m = minutes(seg); return m === null ? null : minutesToIdx(m); })()
        : read(h.id, seg, seg, h.word);
      // Pass 3: just mentioning it ("I exercised", "felt anxious", "ate")
      if (v === null) {
        if (KIND[h.id] && IMPLIES_SOME.has(h.word)) v = IMPLIED_DEFAULT[h.id] ?? 2;
        else if (!KIND[h.id] && h.id !== 'sleep' && h.id !== 'instagram') {
          v = h.id === 'ate' || h.id === 'water' ? 2 : 1;
          if (['food', 'meals', 'meal', 'water', 'hydration'].includes(h.word) || h.word === 'phone') v = null; // too vague alone
        }
      }
      if (v !== null) { result[h.id] = v; idx.forEach(j => used.add(j)); }
    });

    // Behaviours: "strong urge to flirt but I didn't", "compared myself a lot", "no flirting"
    valid.forEach((h, k) => {
      if (!h.id.startsWith('beh:')) return;
      const id = h.id.slice(4);
      if (result[id + '_did'] !== undefined || result[id + '_urge'] !== undefined) return;
      const before = [];
      for (let j = h.i - 1; j >= 0 && j >= h.i - 5; j--) { if (toks[j] === '|' || (k > 0 && j <= valid[k - 1].i)) break; before.unshift(toks[j]); }
      const aft = after(k);
      // the following clause, unless it's about something else ("…, but I didn't")
      const next = [];
      let j = h.i + 1 + aft.length;
      if (toks[j] === '|') for (j++; j < toks.length && toks[j] !== '|' && !valid.some(v => v.i === j); j++) next.push(toks[j]);
      if ([...before, ...aft].some(w => URGE_W.has(w))) {
        const u = urgeLevel([...before, ...aft]);
        result[id + '_urge'] = u;
        const tail = [...aft, ...next];
        if (u === 0 || tail.some(w => RESIST_W.has(w))) result[id + '_did'] = 0;
        else if (tail.some(w => ACTED_W.has(w)) || freq(tail) !== null) result[id + '_did'] = freq(tail) ?? 1;
      } else if (before.some(w => RESIST_W.has(w)) || RESIST_W.has(aft[0])) {
        result[id + '_did'] = 0;
      } else {
        result[id + '_did'] = freq(aft) ?? 1; // just mentioning it means you did it
      }
    });

    if (note) result.note = note;
    else if (!Object.keys(result).length && text.trim()) result.note = text.trim(); // nothing recognised: keep it as a note
    return result;
  }

  root.VoiceParse = { parse };
  if (typeof module !== 'undefined') module.exports = { parse };
})(typeof window !== 'undefined' ? window : globalThis);
