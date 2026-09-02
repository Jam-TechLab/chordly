const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const engineSource = fs.readFileSync(
  path.join(__dirname, '..', 'app', 'static', 'js', 'chord-engine.js'),
  'utf8'
);
const context = { console };
vm.createContext(context);
vm.runInContext(`${engineSource}\nthis.ChordEngineUnderTest = ChordEngine;`, context);

const engine = new context.ChordEngineUnderTest();

const original = ['G', 'F', 'G', 'C'];
const withoutMelody = engine.harmonizeWithMelody(
  original, [], 0, 2, 'C', 'major', 'bright'
);
assert.deepEqual(Array.from(withoutMelody.chords), original);

const melody = [
  { midi: 64, beat: 0, durationBeats: 1, velocity: 0.9 }, // E
  { midi: 67, beat: 2, durationBeats: 1, velocity: 0.9 }, // G
  { midi: 69, beat: 4, durationBeats: 1, velocity: 0.9 }, // A
  { midi: 60, beat: 6, durationBeats: 1, velocity: 0.9 }, // C
];
const harmonized = engine.harmonizeWithMelody(
  original, melody, 0, 2, 'C', 'major', 'emotional'
);

assert.equal(harmonized.chords.length, original.length);
assert.equal(harmonized.insights.length, original.length);
harmonized.insights.forEach(insight => {
  assert.ok(insight);
  assert.ok(insight.melodyFit >= 0 && insight.melodyFit <= 1);
  assert.ok(insight.voiceLeading >= 0 && insight.voiceLeading <= 1);
});

assert.ok(engine.melodyCompatibility('C', [melody[0]], 'C', 'major') > 0.9);
assert.ok(engine.voiceLeadingScore('C', 'Am') > engine.voiceLeadingScore('C', 'F#'));

console.log('Chord engine melody tests passed');
