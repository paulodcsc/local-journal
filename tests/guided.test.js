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
];
let fail = 0;
for (const [t, ctx, exp] of cases) {
  const got = answer(t, ctx);
  if (JSON.stringify(got) !== JSON.stringify(exp)) { fail++; console.log('FAIL', JSON.stringify(t), JSON.stringify(ctx.labels?.[0] ?? ctx.type), '\n  got', JSON.stringify(got), '\n  exp', JSON.stringify(exp)); }
}
console.log(`${cases.length - fail}/${cases.length} passed`);
process.exit(fail ? 1 : 0);
