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

const cMajorMelody = [60, 64, 67, 65, 62, 67, 64, 60].map((midi, index) => ({
  midi,
  beat: index,
  durationBeats: index === 7 ? 2 : 1,
  velocity: 0.85
}));
const detectedKey = engine.detectKeyFromMelody(cMajorMelody);
assert.equal(detectedKey.key, 'C');
assert.equal(detectedKey.mode, 'major');

const automaticKey = engine.autoSelectKeysForSong([
  { key: 'auto', mode: 'auto', image: 'dark', type: 'verse' }
], cMajorMelody);
assert.equal(automaticKey[0].key, 'C');
assert.equal(automaticKey[0].mode, 'major');

const longNote = [{ midi: 64, beat: 0, durationBeats: 2, velocity: 0.9, importance: 2 }];
assert.ok(
  engine.melodyCompatibility('Cmaj7', longNote, 'C', 'major')
  > engine.melodyCompatibility('Dm', longNote, 'C', 'major')
);

const anchorResult = engine.harmonizeWithMelody(
  ['G'],
  [{ midi: 64, beat: 0, durationBeats: 2, velocity: 0.9 }],
  0, 2, 'C', 'major', 'bright'
);
assert.ok(engine.getChordPitchClasses(anchorResult.chords[0]).includes(4));
assert.equal(anchorResult.insights[0].anchorFit, 1);

const passingToneResult = engine.harmonizeWithMelody(
  ['G'],
  [
    { midi: 60, beat: 0, durationBeats: 1.5, velocity: 0.9 },
    { midi: 62, beat: 1.5, durationBeats: 0.25, velocity: 0.55 },
    { midi: 64, beat: 1.75, durationBeats: 0.25, velocity: 0.7 }
  ],
  0, 2, 'C', 'major', 'calm'
);
assert.ok(engine.getChordPitchClasses(passingToneResult.chords[0]).includes(0));

console.log('Chord engine melody tests passed');
