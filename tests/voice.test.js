// Run with: node tests/voice.test.js
const { parse } = require('../voice.js');
const B = [{ id: 'flirt', name: 'Obsessive flirting' }, { id: 'compare', name: 'Comparing myself to others' }, { id: 'bx', name: 'Checking his profile' }];
const PREV = { stress: 2, mood: 3, sleep: 7 };

// [text, expected, options]; `_heard` is ignored unless listed.
const cases = [
  // basics
  ['slept 7 hours, rested good, stress high, mood ok', { sleep: 7, rested: 4, stress: 4, mood: 2 }],
  ['I slept seven and a half hours and I feel pretty rested', { sleep: 7.5, rested: 3 }],
  ['slept 6.5 hours', { sleep: 6.5 }],
  ['8 hours of sleep', { sleep: 8 }],
  ['stress high mood good anxiety low', { stress: 4, mood: 4, anxiety: 0 }],
  ['high stress, good mood, very high anxiety', { stress: 4, mood: 4, anxiety: 4 }],
  ['I was really stressed today', { stress: 4 }],
  ['not stressed at all', { stress: 0 }],
  ['no stress', { stress: 0 }],
  ['felt anxious and a bit insecure', { anxiety: 2, insecure: 1 }],
  ['irritability 4 insecurity 2', { irritable: 3, insecure: 1 }],
  ['energy low, mood bad', { energy: 1, mood: 0 }],
  ['mood not great', { mood: 1 }],
  ['rested exhausted', { rested: 0 }],
  ['mood is good energy is low and I feel really insecure', { mood: 4, energy: 1, insecure: 4 }],
  ['Slept 7 hours. Rested: okay. Stress 3. Anxiety none. Instagram one hour. Ate yes. Water no. Exercise yes. Outside no. Alcohol no.',
    { sleep: 7, rested: 2, stress: 2, anxiety: 0, instagram: 3, ate: 2, water: 0, moved: 1, outside: 0, alcohol: 0 }],
  ['slept 7 hours rested okay stress high anxiety low instagram 2 hours ate well water no exercise yes alcohol no',
    { sleep: 7, rested: 2, stress: 4, anxiety: 0, instagram: 4, ate: 2, water: 0, moved: 1, alcohol: 0 }],
  // productivity (overall, not just work)
  ['productivity high', { productive: 4 }],
  ['pretty productive', { productive: 3 }],
  ['I got a lot done today', { productive: 4 }],
  ['got some things done, mood ok', { productive: 2, mood: 2 }],
  ['unproductive day', { productive: 0 }],
  ['felt productive', { productive: 3 }],
  ['productivity same as yesterday', { productive: 1 }, { productive: 1 }],
  // habits
  ['instagram 2 hours', { instagram: 4 }],
  ['instagram half an hour', { instagram: 2 }],
  ['instagram 15 minutes', { instagram: 1 }],
  ['about an hour on instagram', { instagram: 3 }],
  ["didn't use instagram", { instagram: 0 }],
  ['instagram high', { instagram: 4 }],
  ['a bit of social media', { instagram: 1 }],
  ['social media pretty high, stress low', { instagram: 3, stress: 0 }],
  ['ate well, drank enough water', { ate: 2, water: 2 }],
  ["I didn't eat much and not enough water", { ate: 0, water: 0 }],
  ['ate a little, water a bit', { ate: 1, water: 1 }],
  ['I exercised and went outside', { moved: 1, outside: 1 }],
  ['no alcohol, no coffee after 2', { alcohol: 0, caffeine: 0 }],
  ['energy drink in the afternoon', { caffeine: 1 }],
  ['took my meds', { meds: 1 }],
  ['slept 5 hours stress very high note long day at work, fought with my boss', { sleep: 5, stress: 4, note: 'long day at work, fought with my boss' }],
  ['today was a hard day', { note: 'today was a hard day' }],
  // hedges → in-between positions
  ['kind of stressed', { stress: 1, _heard: { stress: 'a bit stressed' } }],
  ['a little anxious', { anxiety: 1 }],
  ['pretty stressed', { stress: 3 }],
  ['stress medium-high', { stress: 3 }],
  ['stress between medium and high', { stress: 3 }],
  ['anxiety low to medium', { anxiety: 1 }],
  ['mood pretty good', { mood: 3 }],
  ['mood 7 out of 10', { mood: 3 }],
  ['stress 3 out of 5', { stress: 2 }],
  // relative to yesterday
  ['stress same as yesterday', { stress: 2 }, PREV],
  ['same stress as yesterday', { stress: 2 }, PREV],
  ['more stressed than yesterday', { stress: 3 }, PREV],
  ['way more stressed', { stress: 4 }, PREV],
  ['better mood', { mood: 4 }, PREV],
  ['mood worse than yesterday', { mood: 2 }, PREV],
  ['less anxious than yesterday', { noPrev: ['anxiety'] }, PREV],
  // uncertainty
  ['not sure about my mood', { unsure: ['mood'] }],
  ['mood, not sure', { unsure: ['mood'] }],
  ["I don't know my anxiety, stress high", { unsure: ['anxiety'], stress: 4 }],
  ['skip energy', { unsure: ['energy'] }],
  // corrections — the last thing said wins
  ['stress high, actually medium', { stress: 2 }],
  ['stress high no wait medium', { stress: 2 }],
  ['slept 6 hours, actually 7', { sleep: 7 }],
  ['stress high, stress medium', { stress: 2 }],
  // behaviours
  ['I flirted with guys obsessively today', { flirt_did: 3 }, B],
  ['flirted a lot and compared myself a few times', { flirt_did: 3, compare_did: 2 }, B],
  ["didn't flirt today", { flirt_did: 0 }, B],
  ["strong urge to flirt but I didn't", { flirt_urge: 3, flirt_did: 0 }, B],
  ['I really wanted to compare myself but I resisted', { compare_urge: 4, compare_did: 0 }, B],
  ['mild urge to flirt and I did it anyway', { flirt_urge: 1, flirt_did: 1 }, B],
  ['no urge to compare', { compare_urge: 0, compare_did: 0 }, B],
  ['urge to flirt', { flirt_urge: 2 }, B],
  ['checked his profile twice, mood bad', { bx_did: 2, mood: 0 }, B],
  ['slept 6 hours, flirted, felt insecure', { sleep: 6, flirt_did: 1, insecure: 2 }, B],
  // Portuguese (pt-BR)
  ['dormi sete e meia, estresse alto, humor mais ou menos', { sleep: 7.5, stress: 4, mood: 2 }, { lang: 'pt' }],
  ['um pouco ansiosa', { anxiety: 1 }, { lang: 'pt' }],
  ['muito estressada hoje', { stress: 4 }, { lang: 'pt' }],
  ['humor igual a ontem', { mood: 3 }, { lang: 'pt', prev: PREV }],
  ['não sei a ansiedade, energia boa', { unsure: ['anxiety'], energy: 3 }, { lang: 'pt' }],
  ['estresse alto, na verdade médio', { stress: 2 }, { lang: 'pt' }],
  ['comi bem, bebi água', { ate: 2, water: 2 }, { lang: 'pt' }],
  ['me mexi e saí de casa', { moved: 1, outside: 1 }, { lang: 'pt' }],
  ['redes sociais duas horas', { instagram: 4 }, { lang: 'pt' }],
  ['produtividade alta', { productive: 4 }, { lang: 'pt' }],
  ['flertei muito', { flirt_did: 3 }, { lang: 'pt', behaviors: B }],
  ['tive vontade forte de flertar mas não flertei', { flirt_urge: 3, flirt_did: 0 }, { lang: 'pt', behaviors: B }],
  ['me comparei algumas vezes', { compare_did: 2 }, { lang: 'pt', behaviors: B }],
  ['dormi oito horas, nota: dia longo no trabalho', { sleep: 8, note: 'dia longo no trabalho' }, { lang: 'pt' }],
];

let fail = 0;
const norm = o => JSON.stringify(Object.keys(o).sort().map(k => [k, o[k]]));
for (const [text, exp, opt] of cases) {
  const o = Array.isArray(opt) ? { behaviors: opt } : opt && opt.lang ? opt : { prev: opt };
  const got = parse(text, o);
  if (!exp._heard) delete got._heard;
  else got._heard = Object.fromEntries(Object.keys(exp._heard).map(k => [k, got._heard?.[k]]));
  if (norm(got) !== norm(exp)) { fail++; console.log('FAIL', JSON.stringify(text), '\n  got', JSON.stringify(got), '\n  exp', JSON.stringify(exp)); }
}
console.log(`${cases.length - fail}/${cases.length} passed`);
process.exit(fail ? 1 : 0);
