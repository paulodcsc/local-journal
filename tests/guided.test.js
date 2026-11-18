// Run with: node tests/guided.test.js — short answers in guided voice mode
const { answer } = require('../voice.js');
const AMOUNT5 = ['Low', 'Mild', 'Medium', 'Quite high', 'High'];
const MOOD = ['Bad', 'Not great', 'OK', 'Pretty good', 'Good'];
const ENERGY = ['Drained', 'Low', 'OK', 'Good', 'High'];
const URGE = ['None', 'Mild', 'Moderate', 'Strong', 'Overwhelming'];
const PROD = ['Stuck', 'Slow', 'Some done', 'Productive', 'Very productive'];
const HAB = ['Moved / exercised', 'Went outside', 'Real talk', 'Caffeine after 2pm', 'Alcohol'];
const TRIG = ['Bored', 'Lonely', 'Anxious', 'Felt rejected', 'Scrolling', 'Tired', 'Drinking', 'After a fight', 'Other'];
const S = { type: 'slider', kind: 'amount', labels: AMOUNT5 }, M = { type: 'slider', kind: 'quality', labels: MOOD };
const cases = [
  ['high', S, { value: 4 }], ['High.', S, { value: 4 }], ['low', S, { value: 0 }], ['medium', S, { value: 2 }],
  ['quite high', S, { value: 3 }], ['mild', S, { value: 1 }], ['a bit', S, { value: 1 }], ['kind of', S, { value: 1 }],
  ['pretty high', S, { value: 3 }], ['very', S, { value: 4 }], ['really high', S, { value: 4 }], ['medium-high', S, { value: 3 }],
  ['between low and medium', S, { value: 1 }], ['none at all', S, { value: 0 }], ['three', S, { value: 2 }], ['I was pretty stressed', S, { value: 3 }],
  ['same', { ...S, prev: 3 }, { value: 3 }], ['same as yesterday', S, { noPrev: true }], ['a bit more', { ...S, prev: 2 }, { value: 3 }],
  ['not sure', S, { unsure: true }], ["I don't know", S, { unsure: true }],
  ['good', M, { value: 4 }], ['pretty good', M, { value: 3 }], ['not great', M, { value: 1 }], ['not good', M, { value: 1 }],
  ['okay', M, { value: 2 }], ['ok', M, { value: 2 }], ['bad', M, { value: 0 }], ['meh', M, { value: 1 }], ['great', M, { value: 4 }],
  ['low', { type: 'slider', kind: 'quality', labels: ENERGY }, { value: 1 }], ['drained', { type: 'slider', kind: 'quality', labels: ENERGY }, { value: 0 }],
  ['very productive', { type: 'slider', kind: 'quality', labels: PROD }, { value: 4 }], ['some done', { type: 'slider', kind: 'quality', labels: PROD }, { value: 2 }],
  ['stuck', { type: 'slider', kind: 'quality', labels: PROD }, { value: 0 }], ['slow', { type: 'slider', kind: 'quality', labels: PROD }, { value: 1 }],
  ['productive', { type: 'slider', kind: 'quality', labels: PROD }, { value: 3 }], ['pretty good', { type: 'slider', kind: 'quality', labels: PROD }, { value: 3 }],
  ['strong', { type: 'slider', kind: 'urge', labels: URGE }, { value: 3 }], ['none', { type: 'slider', kind: 'urge', labels: URGE }, { value: 0 }],
  ['really strong', { type: 'slider', kind: 'urge', labels: URGE }, { value: 3 }], ['a little', { type: 'slider', kind: 'urge', labels: URGE }, { value: 1 }],
  ['seven and a half', { type: 'hours' }, { value: 7.5 }], ['6', { type: 'hours' }, { value: 6 }], ['about 8 hours', { type: 'hours' }, { value: 8 }],
  ['two hours', { type: 'minutes' }, { value: 4 }],
  ['two hours', { type: 'slider', kind: 'amount', labels: AMOUNT5, minutes: true }, { value: 4 }],
  ['half an hour', { type: 'slider', kind: 'amount', labels: AMOUNT5, minutes: true }, { value: 2 }],
  ['quite high', { type: 'slider', kind: 'amount', labels: AMOUNT5, minutes: true }, { value: 3 }],
  ['low', { type: 'slider', kind: 'amount', labels: AMOUNT5, minutes: true }, { value: 0 }],
  ['I moved and went outside', { type: 'multi', labels: HAB }, { value: ['Moved / exercised', 'Went outside'] }],
  ['had coffee late and talked to a friend', { type: 'multi', labels: HAB }, { value: ['Real talk', 'Caffeine after 2pm'] }],
  ['none', { type: 'multi', labels: HAB }, { value: [] }], ['none', { type: 'minutes' }, { value: 0 }], ['half an hour', { type: 'minutes' }, { value: 2 }],
  ['yes', { type: 'three', labels: ['Barely', 'Some meals', 'Yes'] }, { value: 2 }], ['some meals', { type: 'three', labels: ['Barely', 'Some meals', 'Yes'] }, { value: 1 }],
  ['barely', { type: 'three', labels: ['Barely', 'Some meals', 'Yes'] }, { value: 0 }], ['a bit', { type: 'three', labels: ['No', 'A bit', 'Yes'] }, { value: 1 }],
  ['yeah', { type: 'yesno' }, { value: 1 }], ['nope', { type: 'yesno' }, { value: 0 }], ['I did', { type: 'yesno' }, { value: 1 }], ['no', { type: 'yesno' }, { value: 0 }],
  ['a lot', { type: 'freq', labels: ['No', 'Once', 'A few times', 'A lot'] }, { value: 3 }], ['twice', { type: 'freq', labels: ['No', 'Once', 'A few times', 'A lot'] }, { value: 2 }],
  ['once', { type: 'freq', labels: ['No', 'Once', 'A few times', 'A lot'] }, { value: 1 }], ['no', { type: 'freq', labels: ['No', 'Once', 'A few times', 'A lot'] }, { value: 0 }],
  ['not at all', { type: 'freq', labels: ['No', 'Once', 'A few times', 'A lot'] }, { value: 0 }],
  ['lonely and bored', { type: 'multi', labels: TRIG }, { value: ['Bored', 'Lonely'] }], ['I was scrolling instagram', { type: 'multi', labels: TRIG }, { value: ['Scrolling'] }],
  ['nothing', { type: 'multi', labels: TRIG }, { value: [] }], ['after a fight with my mom', { type: 'multi', labels: TRIG }, { value: ['After a fight'] }],
  ['long day at work', { type: 'note' }, { value: 'long day at work' }], ['no', { type: 'note' }, { cmd: 'skip' }],
  ['skip', S, { cmd: 'skip' }], ['next', { type: 'yesno' }, { cmd: 'skip' }], ['go back', S, { cmd: 'back' }], ['back', M, { cmd: 'back' }],
  ['repeat', S, { cmd: 'repeat' }], ['stop', S, { cmd: 'stop' }], ["that's all", S, { cmd: 'stop' }], ["I'm done", { type: 'yesno' }, { cmd: 'stop' }],
  ['not sure', { type: 'yesno' }, { cmd: 'skip' }], ['banana', S, null],
  // common mishearings
  ['hi', S, { value: 4 }], ['Hi.', S, { value: 4 }], ['hey', S, { value: 4 }], ['I', S, { value: 4 }], ['eye', S, { value: 4 }],
  ['very hi', S, { value: 4 }], ['quite hi', S, { value: 3 }], ['pretty hi', S, { value: 3 }], ['lo', S, { value: 0 }],
  ['mile', S, { value: 1 }], ['media', S, { value: 2 }], ['for', S, { value: 3 }], ['to', S, { value: 1 }],
  ['hi', { type: 'slider', kind: 'quality', labels: ENERGY }, { value: 4 }],
  ['ones', { type: 'freq', labels: ['No', 'Once', 'A few', 'A lot'] }, { value: 1 }],
  ['allot', { type: 'freq', labels: ['No', 'Once', 'A few', 'A lot'] }, { value: 3 }],
  ['I', { type: 'yesno' }, null],
  ['hi', { type: 'note' }, { value: 'hi' }],
  // Portuguese (pt-BR)
  ...[
    ['alto', S, { value: 4 }], ['auto', S, { value: 4 }], ['meio auto', S, { value: 3 }], ['baxo', S, { value: 0 }], ['meio alto', S, { value: 3 }], ['médio', S, { value: 2 }], ['leve', S, { value: 1 }], ['baixo', S, { value: 0 }],
    ['um pouco', S, { value: 1 }], ['muito', S, { value: 4 }], ['igual a ontem', { ...S, prev: 2 }, { value: 2 }], ['não sei', S, { unsure: true }],
    ['bom', M, { value: 3 }], ['ótimo', M, { value: 4 }], ['ruim', M, { value: 0 }], ['mais ou menos', M, { value: 2 }], ['não muito bom', M, { value: 1 }],
    ['forte', { type: 'slider', kind: 'urge', labels: URGE }, { value: 3 }], ['nenhuma', { type: 'slider', kind: 'urge', labels: URGE }, { value: 0 }],
    ['incontrolável', { type: 'slider', kind: 'urge', labels: URGE }, { value: 4 }],
    ['sete e meia', { type: 'hours' }, { value: 7.5 }], ['oito horas', { type: 'hours' }, { value: 8 }],
    ['duas horas', { type: 'slider', kind: 'amount', labels: AMOUNT5, minutes: true }, { value: 4 }],
    ['uma vez', { type: 'freq', labels: ['No', 'Once', 'A few', 'A lot'] }, { value: 1 }],
    ['algumas vezes', { type: 'freq', labels: ['No', 'Once', 'A few', 'A lot'] }, { value: 2 }],
    ['muitas', { type: 'freq', labels: ['No', 'Once', 'A few', 'A lot'] }, { value: 3 }],
    ['não', { type: 'freq', labels: ['No', 'Once', 'A few', 'A lot'] }, { value: 0 }],
    ['sim', { type: 'three', labels: ['Barely', 'Some meals', 'Yes'] }, { value: 2 }],
    ['algumas refeições', { type: 'three', labels: ['Barely', 'Some meals', 'Yes'] }, { value: 1 }],
    ['quase nada', { type: 'three', labels: ['Barely', 'Some meals', 'Yes'] }, { value: 0 }],
    ['um pouco', { type: 'three', labels: ['No', 'A bit', 'Yes'] }, { value: 1 }],
    ['sim', { type: 'yesno' }, { value: 1 }], ['não', { type: 'yesno' }, { value: 0 }],
    ['solidão e tédio', { type: 'multi', labels: TRIG }, { value: ['Bored', 'Lonely'] }],
    ['me mexi e saí', { type: 'multi', labels: HAB }, { value: ['Moved / exercised', 'Went outside'] }],
    ['tomei café e conversei com uma amiga', { type: 'multi', labels: HAB }, { value: ['Real talk', 'Caffeine after 2pm'] }],
    ['nada', { type: 'multi', labels: HAB }, { value: [] }],
    ['dia longo no trabalho', { type: 'note' }, { value: 'dia longo no trabalho' }], ['não', { type: 'note' }, { cmd: 'skip' }],
    ['pular', S, { cmd: 'skip' }], ['voltar', S, { cmd: 'back' }], ['repete', S, { cmd: 'repeat' }], ['parar', S, { cmd: 'stop' }],
  ].map(([t, ctx, exp]) => [t, { ...ctx, lang: 'pt' }, exp]),
];
let fail = 0;
for (const [t, ctx, exp] of cases) {
  const got = answer(t, ctx);
  if (JSON.stringify(got) !== JSON.stringify(exp)) { fail++; console.log('FAIL', JSON.stringify(t), JSON.stringify(ctx.labels?.[0] ?? ctx.type), '\n  got', JSON.stringify(got), '\n  exp', JSON.stringify(exp)); }
}
console.log(`${cases.length - fail}/${cases.length} passed`);
process.exit(fail ? 1 : 0);
