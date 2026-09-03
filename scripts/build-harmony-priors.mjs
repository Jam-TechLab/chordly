#!/usr/bin/env node

/**
 * Build a compact, transposition-invariant harmony prior from ChoCo JAMS.
 *
 * Usage:
 *   node scripts/build-harmony-priors.mjs <choco-bare-git-dir> [output-file]
 *
 * Only the explicitly listed CC BY 4.0 pop partitions are read. The emitted
 * browser asset contains aggregate probabilities, never song titles or raw
 * progressions.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const gitDir = process.argv[2];
const outputFile = resolve(process.argv[3] || 'app/static/js/harmony-priors.js');

if (!gitDir) {
  console.error('Usage: node scripts/build-harmony-priors.mjs <choco-bare-git-dir> [output-file]');
  process.exit(1);
}

const PARTITIONS = [
  'billboard',
  'isophonics',
  'robbie-williams',
  'rock-corpus',
  'rwc-pop',
  'uspop2002'
];
const ROOTS = PARTITIONS.map(name => `partitions/${name}/choco`);
const NOTE_TO_PC = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3,
  E: 4, Fb: 4, 'E#': 5, F: 5, 'F#': 6, Gb: 6,
  G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10,
  B: 11, Cb: 11
};

function git(args, options = {}) {
  return execFileSync('git', [`--git-dir=${gitDir}`, ...args], {
    maxBuffer: 512 * 1024 * 1024,
    ...options
  });
}

function listJams() {
  return git(['ls-tree', '-r', '--name-only', 'HEAD', ...ROOTS], { encoding: 'utf8' })
    .split(/\r?\n/)
    .filter(path => path.endsWith('.jams'));
}

function readGitBlobs(paths) {
  const request = `${paths.map(path => `HEAD:${path}`).join('\n')}\n`;
  const result = git(['cat-file', '--batch'], { input: Buffer.from(request) });
  const blobs = [];
  let offset = 0;

  for (const path of paths) {
    const headerEnd = result.indexOf(0x0a, offset);
    if (headerEnd < 0) throw new Error(`Missing cat-file header for ${path}`);
    const header = result.subarray(offset, headerEnd).toString('utf8');
    const match = header.match(/^[0-9a-f]+ blob (\d+)$/);
    if (!match) throw new Error(`Unexpected cat-file response for ${path}: ${header}`);
    const size = Number(match[1]);
    const bodyStart = headerEnd + 1;
    blobs.push(result.subarray(bodyStart, bodyStart + size));
    offset = bodyStart + size + 1;
  }
  return blobs;
}

function chordQuality(rawType) {
  const type = rawType.toLowerCase();
  if (type.includes('hdim') || type.includes('min7b5')) return 'half-dim';
  if (type.includes('dim')) return 'dim';
  if (type.startsWith('min') || type.startsWith('m') && !type.startsWith('maj')) return 'min';
  if (type.includes('sus')) return 'sus';
  if (/^(7|9|11|13|dom)/.test(type)) return 'dom';
  return 'maj';
}

function parseHarte(value) {
  if (typeof value !== 'string' || /^(N|X|no_chord)$/i.test(value.trim())) return null;
  const match = value.trim().match(/^([A-G](?:#|b)?)(?::([^/]*))?/);
  if (!match || NOTE_TO_PC[match[1]] === undefined) return null;
  return {
    pc: NOTE_TO_PC[match[1]],
    quality: chordQuality(match[2] || ''),
  };
}

function extractChords(jams) {
  const annotations = Array.isArray(jams.annotations) ? jams.annotations : [];
  const chordAnnotations = annotations.filter(annotation =>
    typeof annotation.namespace === 'string' && annotation.namespace.toLowerCase().includes('chord')
  );
  const entries = chordAnnotations.flatMap(annotation => Array.isArray(annotation.data) ? annotation.data : []);
  return entries
    .map(entry => {
      const chord = parseHarte(entry.value);
      if (!chord) return null;
      return {
        ...chord,
        duration: Math.max(0.125, Math.min(Number(entry.duration) || 1, 16))
      };
    })
    .filter(Boolean)
    .filter((chord, index, all) => index === 0
      || chord.pc !== all[index - 1].pc
      || chord.quality !== all[index - 1].quality);
}

const EXPECTED = {
  major: new Map([
    [0, ['maj']], [2, ['min']], [4, ['min']], [5, ['maj']],
    [7, ['maj', 'dom']], [9, ['min']], [11, ['dim', 'half-dim']]
  ]),
  minor: new Map([
    [0, ['min']], [2, ['dim', 'half-dim']], [3, ['maj']], [5, ['min']],
    [7, ['min', 'maj', 'dom']], [8, ['maj']], [10, ['maj']]
  ])
};

function keyScore(chords, tonic, mode) {
  const expected = EXPECTED[mode];
  let score = mode === 'major' ? 0.15 : 0;
  let weightTotal = 0;

  chords.forEach(chord => {
    const weight = Math.sqrt(chord.duration);
    const degree = (chord.pc - tonic + 12) % 12;
    const qualities = expected.get(degree);
    weightTotal += weight;
    if (!qualities) score -= 0.28 * weight;
    else if (qualities.includes(chord.quality) || chord.quality === 'sus') score += 2.35 * weight;
    else score += 0.28 * weight;
  });

  const first = chords[0];
  const last = chords.at(-1);
  const tonicQuality = mode === 'major' ? 'maj' : 'min';
  if (first?.pc === tonic && (first.quality === tonicQuality || first.quality === 'sus')) score += 3.2;
  if (last?.pc === tonic && (last.quality === tonicQuality || last.quality === 'sus')) score += 5.5;

  for (let index = 1; index < chords.length; index++) {
    const previousDegree = (chords[index - 1].pc - tonic + 12) % 12;
    const degree = (chords[index].pc - tonic + 12) % 12;
    if (previousDegree === 7 && degree === 0) score += 3.8;
    if (previousDegree === 5 && degree === 0) score += 1.6;
  }

  return score / Math.max(weightTotal, 1);
}

function inferKey(chords) {
  const candidates = [];
  for (let tonic = 0; tonic < 12; tonic++) {
    for (const mode of ['major', 'minor']) {
      candidates.push({ tonic, mode, score: keyScore(chords, tonic, mode) });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0];
}

function chordToToken(chord, key) {
  const degree = (chord.pc - key.tonic + 12) % 12;
  const minor = chord.quality === 'min' || chord.quality === 'dim' || chord.quality === 'half-dim';
  const diminished = chord.quality === 'dim' || chord.quality === 'half-dim';
  const dominant = chord.quality === 'dom';

  if (key.mode === 'major') {
    const mapping = {
      0: 'I', 1: 'bII', 3: 'bIII', 6: diminished ? '#iv°' : 'bV',
      7: minor ? 'v' : 'V', 8: 'bVI', 10: 'bVII', 11: 'vii°'
    };
    if (degree === 2) return diminished ? 'ii°' : minor ? 'ii' : 'V/V';
    if (degree === 4) return minor ? 'iii' : 'V/vi';
    if (degree === 5) return minor ? 'iv' : 'IV';
    if (degree === 9) return minor ? 'vi' : 'V/ii';
    return mapping[degree] || null;
  }

  const mapping = {
    0: 'i', 1: 'bII', 3: 'bIII', 6: diminished ? '#iv°' : 'bV',
    7: minor && !dominant ? 'v' : 'V', 8: 'bVI', 9: 'vi',
    10: 'bVII', 11: 'vii°'
  };
  if (degree === 2) return diminished ? 'ii°' : minor ? 'ii' : 'V/V';
  if (degree === 4) return dominant ? 'V/bVI' : minor ? 'iii' : 'III';
  if (degree === 5) return minor ? 'iv' : 'IV';
  return mapping[degree] || null;
}

function increment(map, key, amount = 1) {
  map.set(key, (map.get(key) || 0) + amount);
}

function emptyCounts() {
  return {
    songs: 0,
    chords: 0,
    starts: new Map(),
    ends: new Map(),
    unigrams: new Map(),
    bigrams: new Map(),
    trigrams: new Map()
  };
}

function normalizedFlat(map, minCount = 1) {
  const entries = [...map.entries()].filter(([, count]) => count >= minCount);
  const total = entries.reduce((sum, [, count]) => sum + count, 0) || 1;
  return Object.fromEntries(entries
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, count]) => [key, Number((count / total).toFixed(6))]));
}

function normalizedContexts(map, order, minCount = 2) {
  const contexts = new Map();
  for (const [ngram, count] of map.entries()) {
    if (count < minCount) continue;
    const parts = ngram.split('>');
    const next = parts.pop();
    const context = parts.slice(-(order - 1)).join('>');
    if (!contexts.has(context)) contexts.set(context, new Map());
    contexts.get(context).set(next, count);
  }

  return Object.fromEntries([...contexts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([context, nextCounts]) => [context, normalizedFlat(nextCounts)]));
}

const files = listJams();
const blobs = readGitBlobs(files);
const counts = { major: emptyCounts(), minor: emptyCounts() };
const partitionSongs = Object.fromEntries(PARTITIONS.map(name => [name, 0]));
let songsRead = 0;
let songsUsed = 0;

for (let index = 0; index < files.length; index++) {
  songsRead++;
  let jams;
  try {
    jams = JSON.parse(blobs[index].toString('utf8'));
  } catch {
    continue;
  }
  const chords = extractChords(jams);
  if (chords.length < 4) continue;
  const key = inferKey(chords);
  const tokens = chords.map(chord => chordToToken(chord, key)).filter(Boolean)
    .filter((token, tokenIndex, all) => tokenIndex === 0 || token !== all[tokenIndex - 1]);
  if (tokens.length < 4) continue;

  const bucket = counts[key.mode];
  bucket.songs++;
  bucket.chords += tokens.length;
  songsUsed++;
  const partition = files[index].split('/')[1];
  if (partitionSongs[partition] !== undefined) partitionSongs[partition]++;
  increment(bucket.starts, tokens[0]);
  increment(bucket.ends, tokens.at(-1));
  tokens.forEach(token => increment(bucket.unigrams, token));
  for (let position = 1; position < tokens.length; position++) {
    increment(bucket.bigrams, `${tokens[position - 1]}>${tokens[position]}`);
  }
  for (let position = 2; position < tokens.length; position++) {
    increment(bucket.trigrams, `${tokens[position - 2]}>${tokens[position - 1]}>${tokens[position]}`);
  }
}

const prior = {
  meta: {
    source: 'ChoCo v1.0.0 aggregate harmony statistics',
    sourceUrl: 'https://github.com/smashub/choco',
    license: 'CC BY 4.0',
    partitions: PARTITIONS,
    partitionSongs,
    songsRead,
    songsUsed
  },
  major: {
    songs: counts.major.songs,
    chords: counts.major.chords,
    starts: normalizedFlat(counts.major.starts),
    ends: normalizedFlat(counts.major.ends),
    unigrams: normalizedFlat(counts.major.unigrams),
    bigrams: normalizedContexts(counts.major.bigrams, 2),
    trigrams: normalizedContexts(counts.major.trigrams, 3)
  },
  minor: {
    songs: counts.minor.songs,
    chords: counts.minor.chords,
    starts: normalizedFlat(counts.minor.starts),
    ends: normalizedFlat(counts.minor.ends),
    unigrams: normalizedFlat(counts.minor.unigrams),
    bigrams: normalizedContexts(counts.minor.bigrams, 2),
    trigrams: normalizedContexts(counts.minor.trigrams, 3)
  }
};

mkdirSync(dirname(outputFile), { recursive: true });
writeFileSync(
  outputFile,
  `/** Generated aggregate data. See THIRD_PARTY_NOTICES.md. */\n` +
    `globalThis.CHORDLY_HARMONY_PRIORS = ${JSON.stringify(prior, null, 2)};\n`,
  'utf8'
);

console.log(JSON.stringify({ outputFile, songsRead, songsUsed, partitionSongs }, null, 2));
