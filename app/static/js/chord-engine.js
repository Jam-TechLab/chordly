/**
 * Chordly — Chord Theory Engine v2
 * Music theory: chord definitions, diatonic generation,
 * progression templates, context-aware suggestions,
 * key characteristics, auto-key selection, and modulation.
 */

class ChordEngine {
  constructor() {
    // Note name to pitch class (0-11)
    this.noteMap = {
      'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
      'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
      'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
    };

    // Pitch class to note name (display)
    this.pcToNote = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

    // Chord type → intervals from root (in semitones)
    this.chordTypes = {
      '':       [0, 4, 7],
      'm':      [0, 3, 7],
      '7':      [0, 4, 7, 10],
      'maj7':   [0, 4, 7, 11],
      'm7':     [0, 3, 7, 10],
      'm7b5':   [0, 3, 6, 10],
      'dim':    [0, 3, 6],
      'dim7':   [0, 3, 6, 9],
      'aug':    [0, 4, 8],
      'sus2':   [0, 2, 7],
      'sus4':   [0, 5, 7],
      '6':      [0, 4, 7, 9],
      'm6':     [0, 3, 7, 9],
      '9':      [0, 4, 7, 10, 14],
      'm9':     [0, 3, 7, 10, 14],
      'maj9':   [0, 4, 7, 11, 14],
      'add9':   [0, 4, 7, 14],
      'm(maj7)':[0, 3, 7, 11],
      '7sus4':  [0, 5, 7, 10],
    };

    // Section type display names
    this.sectionNames = {
      'intro': 'Intro',
      'verse': 'Aメロ',
      'verse2': "A'メロ",
      'bridge': 'Bメロ',
      'chorus': 'サビ',
      'interlude': '間奏',
      'outro': 'Outro'
    };

    // ==========================================
    // Key Characteristics — 調の性格
    // ==========================================
    // brightness: -3(暗い) ~ +3(明るい)
    // color: 色のイメージ
    // feel: 雰囲気のキーワード
    this.keyCharacteristics = {
      'C':  { brightness: 2,  feel: '純粋、素直、清潔', color: '白' },
      'C#': { brightness: 0,  feel: '神秘的、輝き', color: '虹色' },
      'Db': { brightness: 0,  feel: '温かい、柔らかい', color: '薄紫' },
      'D':  { brightness: 3,  feel: '勝利、喜び、華やか', color: '黄金' },
      'Eb': { brightness: 1,  feel: '英雄的、堂々', color: '金色' },
      'E':  { brightness: 3,  feel: '明るい、輝かしい、春', color: '黄色' },
      'F':  { brightness: 1,  feel: '牧歌的、穏やか、自然', color: '緑' },
      'F#': { brightness: -1, feel: '幻想的、不思議', color: '蛍光' },
      'Gb': { brightness: -1, feel: '柔らかい、夢', color: '薄青' },
      'G':  { brightness: 2,  feel: '素朴、田園、爽やか', color: '水色' },
      'Ab': { brightness: 0,  feel: '甘美、ロマンティック', color: 'ピンク' },
      'A':  { brightness: 1,  feel: '暖かい、情熱的', color: 'オレンジ' },
      'Bb': { brightness: 0,  feel: '楽天的、柔和', color: 'ベージュ' },
      'B':  { brightness: -1, feel: '冷たい、鋭い、緊張', color: '青' },
    };

    // ==========================================
    // Image/Mood Definitions (10 種類)
    // ==========================================
    this.moods = {
      'jazzy':     { label: '✨ おしゃれに',   brightness: 0,  defaultMode: 'major', tempoRange: [90, 110] },
      'bright':    { label: '☀️ 明るく',       brightness: 2,  defaultMode: 'major', tempoRange: [120, 135] },
      'dark':      { label: '🌙 暗く',         brightness: -2, defaultMode: 'minor', tempoRange: [65, 85] },
      'beautiful': { label: '🌸 きれいに',     brightness: 1,  defaultMode: 'major', tempoRange: [68, 88] },
      'setsunai':  { label: '💧 切なく',       brightness: -1, defaultMode: 'minor', tempoRange: [72, 88] },
      'powerful':  { label: '🔥 力強く',       brightness: 1,  defaultMode: 'major', tempoRange: [130, 150] },
      'calm':      { label: '🍃 穏やかに',     brightness: 1,  defaultMode: 'major', tempoRange: [65, 85] },
      'emotional': { label: '💜 エモく',       brightness: -1, defaultMode: 'minor', tempoRange: [75, 95] },
      'pop':       { label: '🎵 ポップに',     brightness: 2,  defaultMode: 'major', tempoRange: [120, 135] },
      'cinematic': { label: '🎬 ドラマチックに', brightness: 0, defaultMode: 'minor', tempoRange: [65, 90] },
    };
  }

  /** Format chord symbol for UI display (e.g. Db -> D♭, m7b5 -> m7♭5, 7b9 -> 7♭9, C/Eb -> C/E♭) */
  formatChordForDisplay(chord) {
    if (!chord) return '';
    return chord
      .replace(/^([A-G])b/, '$1♭')
      .replace(/\/([A-G])b/, '/$1♭')
      .replace(/b(5|9|13)/g, '♭$1');
  }

  // ==========================================
  // Auto Key Selection
  // ==========================================

  /** Pick a key automatically based on mood and optional preferences */
  autoSelectKey(mood, preferredMode) {
    const moodDef = this.moods[mood] || this.moods['bright'];
    const targetBrightness = moodDef.brightness;

    // Score each key by how well it matches the mood's brightness
    const candidates = [];
    for (const [keyName, chars] of Object.entries(this.keyCharacteristics)) {
      if (keyName === 'Db' || keyName === 'Gb') continue; // Skip duplicates

      const brightnessDiff = Math.abs(chars.brightness - targetBrightness);
      let score = 3 - brightnessDiff;

      // Add slight randomness (±0.8)
      score += (Math.random() - 0.5) * 1.6;

      candidates.push({ key: keyName, score, brightness: chars.brightness });
    }

    candidates.sort((a, b) => b.score - a.score);
    const topN = candidates.slice(0, 4);
    const chosen = topN[Math.floor(Math.random() * topN.length)];

    // Strictly enforce mode: if preferredMode is set (major/minor), use it.
    // If auto/unspecified, use mood's strict defaultMode (Bright=Major, Dark=Minor, etc.)
    let mode = preferredMode;
    if (!mode || mode === 'auto') {
      if (mood === 'jazzy') {
        mode = Math.random() > 0.4 ? 'major' : 'minor';
      } else {
        mode = moodDef.defaultMode;
      }
    }

    return { key: chosen.key, mode };
  }

  /** Get relative minor root for a major key (e.g., E -> C#, C -> A) */
  getRelativeMinor(majorKey) {
    const relMap = {
      'C': 'A', 'C#': 'A#', 'Db': 'Bb', 'D': 'B', 'D#': 'C', 'Eb': 'C',
      'E': 'C#', 'F': 'D', 'F#': 'D#', 'Gb': 'Eb', 'G': 'E', 'G#': 'F',
      'Ab': 'F', 'A': 'F#', 'A#': 'G', 'Bb': 'G', 'B': 'G#'
    };
    return relMap[majorKey] || 'A';
  }

  /** Get relative major root for a minor key (e.g., C# -> E, A -> C) */
  getRelativeMajor(minorKey) {
    const relMap = {
      'A': 'C', 'A#': 'C#', 'Bb': 'Db', 'B': 'D', 'C': 'Eb', 'C#': 'E',
      'D': 'F', 'D#': 'F#', 'Eb': 'Gb', 'E': 'G', 'F': 'Ab', 'F#': 'A',
      'G': 'Bb', 'G#': 'B', 'Ab': 'C'
    };
    return relMap[minorKey] || 'C';
  }

  /**
   * Auto-select keys for all sections using a unified Home Key Family.
   * - Determines song's base key from overall mood or main chorus.
   * - Major sections use Home Major Key (e.g., E Major).
   * - Minor sections use Home Relative Minor Key (e.g., C# / Db Minor), NOT parallel minor (E minor).
   * - Avoids unmotivated random key changes; progression and atmosphere take priority.
   */
  autoSelectKeysForSong(sections) {
    if (sections.length === 0) return [];

    // 1. Check if user explicitly set a key for any section
    let explicitKey = null;
    let explicitMode = null;
    for (const sec of sections) {
      if (sec.key && sec.key !== 'auto') {
        explicitKey = sec.key;
        explicitMode = sec.mode !== 'auto' ? sec.mode : 'major';
        break;
      }
    }

    // 2. Determine Home Major & Home Relative Minor keys for the song
    let homeMajorKey = 'C';
    let homeMinorKey = 'A';

    if (explicitKey) {
      if (explicitMode === 'minor') {
        homeMinorKey = explicitKey;
        homeMajorKey = this.getRelativeMajor(explicitKey);
      } else {
        homeMajorKey = explicitKey;
        homeMinorKey = this.getRelativeMinor(explicitKey);
      }
    } else {
      // Pick a base key based on the Chorus (サビ) or first section's mood
      const mainSection = sections.find(s => s.type === 'chorus') || sections[0];
      const mainMood = mainSection.image || 'bright';
      const picked = this.autoSelectKey(mainMood, 'major');
      homeMajorKey = picked.key;
      homeMinorKey = this.getRelativeMinor(homeMajorKey);
    }

    // 3. Assign key/mode for each section within the Home Key Family
    return sections.map(sec => {
      // Respect explicit user choice
      if (sec.key && sec.key !== 'auto') {
        let secMode = sec.mode;
        if (!secMode || secMode === 'auto') {
          const moodDef = this.moods[sec.image] || this.moods['bright'];
          secMode = moodDef.defaultMode;
        }
        return { key: sec.key, mode: secMode };
      }

      // Determine mode based on atmosphere
      const moodDef = this.moods[sec.image] || this.moods['bright'];
      let targetMode = sec.mode;
      if (!targetMode || targetMode === 'auto') {
        targetMode = moodDef.defaultMode;
      }

      // Assign: Major -> Home Major, Minor -> Relative Minor
      if (targetMode === 'minor') {
        return { key: homeMinorKey, mode: 'minor' };
      } else {
        return { key: homeMajorKey, mode: 'major' };
      }
    });
  }

  // ==========================================
  // Chord Parsing & MIDI
  // ==========================================

  /** Parse chord symbol → { root, type, bass } */
  parseChord(symbol) {
    if (!symbol) return null;
    let bass = null;
    let main = symbol;

    if (symbol.includes('/')) {
      const parts = symbol.split('/');
      main = parts[0];
      bass = parts[1];
    }

    const match = main.match(/^([A-G][#b]?)(.*)$/);
    if (!match) return null;

    return { root: match[1], type: match[2] || '', bass };
  }

  /**
   * Get MIDI note numbers for a chord:
   * 1. All upper voicing notes across ALL chords are clamped into a FIXED 1-OCTAVE ABSOLUTE WINDOW [60..71] (C4 to B4).
   *    No matter what chord it is (C or B or F#), notes higher than B4 are folded down into this single window.
   * 2. Bass note (slash bass if specified, else root) is placed in lower octave window [48..59] (C3 to B3).
   */
  getChordMidi(symbol, octave = 4) {
    const parsed = this.parseChord(symbol);
    if (!parsed) return [48, 60, 64, 67];

    const rootPc = this.noteMap[parsed.root];
    if (rootPc === undefined) return [48, 60, 64, 67];

    const rawIntervals = this.chordTypes[parsed.type] || this.chordTypes[''];

    // 1. Extract unique pitch classes (0-11) for all chord tones
    const pitchClasses = Array.from(new Set(rawIntervals.map(iv => (rootPc + iv) % 12)));

    // 2. Clamp all upper notes into the fixed absolute 1-octave window [60..71] (C4 to B4)
    const upperWindowBase = 60; // C4
    const upperNotes = pitchClasses.map(pc => upperWindowBase + pc);
    upperNotes.sort((a, b) => a - b);

    // 3. Bass note in lower octave window [48..59] (C3 to B3)
    const bassNoteName = (parsed.bass && this.noteMap[parsed.bass] !== undefined) ? parsed.bass : parsed.root;
    const bassPc = this.noteMap[bassNoteName] !== undefined ? this.noteMap[bassNoteName] : rootPc;
    const bassWindowBase = 48; // C3
    let bassMidi = bassWindowBase + bassPc;
    if (bassMidi >= upperNotes[0]) bassMidi -= 12;

    return [bassMidi, ...upperNotes];
  }

  /** Get pitch classes (0-11) for a chord */
  getChordPitchClasses(symbol) {
    const parsed = this.parseChord(symbol);
    if (!parsed) return [0, 4, 7];
    const rootPc = this.noteMap[parsed.root] || 0;
    const intervals = this.chordTypes[parsed.type] || this.chordTypes[''];
    return intervals.map(iv => (rootPc + iv) % 12);
  }

  // ==========================================
  // Diatonic & Progression Generation
  // ==========================================

  /** Get the 7 diatonic chords for a key + mode */
  getDiatonicChords(key, mode) {
    const base = this.noteMap[key] || 0;

    const tmpl = mode === 'major'
      ? [
          { offset: 0,  type: '' },      // I   (0)
          { offset: 2,  type: 'm' },     // ii  (1)
          { offset: 4,  type: 'm' },     // iii (2)
          { offset: 5,  type: '' },      // IV  (3)
          { offset: 7,  type: '' },      // V   (4)
          { offset: 9,  type: 'm' },     // vi  (5)
          { offset: 11, type: 'dim' },   // vii°(6)
        ]
      : [
          { offset: 0,  type: 'm' },     // i   (0)
          { offset: 2,  type: 'dim' },   // ii° (1)
          { offset: 3,  type: '' },      // III (2)
          { offset: 5,  type: 'm' },     // iv  (3)
          { offset: 7,  type: 'm' },     // v   (4)
          { offset: 8,  type: '' },      // VI  (5)
          { offset: 10, type: '' },      // VII (6)
        ];

    return tmpl.map(t => {
      const noteName = this.pcToNote[(base + t.offset) % 12];
      return noteName + t.type;
    });
  }

  /**
   * Generate a chord progression for a section using authentic masterpiece templates.
   * If nextFirstChord is provided, resolves the last bar of the section to lead into it!
   */
  /**
   * Generate a chord progression for a section using authentic masterpiece templates.
   * Prioritizes Mood (imageType) to ensure distinctive progression signatures.
   */
  generateProgression(key, mode, sectionType, imageType, numChords, nextFirstChord = null) {
    const d = this.getDiatonicChords(key, mode);

    // Secondary dominant of vi (III7, e.g. E7 in C major for Just the Two of Us)
    const dom3 = this.pcToNote[(this.noteMap[key] + 4) % 12] + '7';
    // Secondary dominant of IV (I7)
    const dom1 = d[0] + '7';

    // Mood-driven masterpiece progression templates
    const moodTemplatesMajor = {
      bright: [
        [d[0], d[4], d[5], d[3]],                 // 1-5-6-4 小悪魔
        [d[0], d[3], d[0], d[4]],                 // 1-4-1-5 定番
        [d[0], d[2], d[3], d[4]],                 // 1-3-4-5 カノンアプローチ
      ],
      setsunai: [
        [d[3], d[4], d[2], d[5]],                 // IV-V-iii-vi (王道進行：Subdominant起点でエモい)
        [d[3], dom3, d[5], dom1],                 // IV-III7-vi-I7 (丸サ進行：切なさ全開)
        [d[5], d[3], d[0], d[4]],                 // vi-IV-I-V (Submediant起点の切ない進行)
      ],
      dark: [
        [d[5], d[3], d[0], d[4]],                 // vi-IV-I-V (Submediant起点のダーク進行)
        [d[0], d[3], d[5], d[4]],                 // 1-4-6-5
        [d[5], d[4], d[3], d[4]],                 // 6-5-4-5
      ],
      jazzy: [
        [d[1], d[4], d[0], d[5]],                 // ii-V-I-vi (2-5-1-6 進行)
        [d[3], dom3, d[5], dom1],                 // IV-III7-vi-I7 (丸サ進行)
        [d[2], d[5], d[1], d[4]],                 // iii-vi-ii-V
      ],
      beautiful: [
        [d[0], d[4], d[5], d[2], d[3], d[0], d[3], d[4]], // カノン進行 (全節)
        [d[3], d[4], d[2], d[5]],                         // 王道進行
        [d[0], d[3], d[0], d[4]],                         // 1-4-1-5
      ],
      powerful: [
        [d[0], d[4], d[5], d[3]],                         // 1-5-6-4
        [d[5], d[3], d[4], d[0]],                         // 小室進行 (vi-IV-V-I)
        [d[0], d[3], d[4], d[4]],                         // 1-4-5-5
      ],
      calm: [
        [d[0], d[3], d[0], d[4]],                         // 1-4-1-5
        [d[0], d[2], d[3], d[4]],                         // 1-3-4-5
        [d[3], d[4], d[0], d[0]],                         // 4-5-1
      ],
      emotional: [
        [d[3], d[4], d[2], d[5]],                         // 王道進行
        [d[3], dom3, d[5], dom1],                         // 丸サ進行
        [d[5], d[3], d[4], d[0]],                         // 小室進行
      ],
      pop: [
        [d[0], d[4], d[5], d[3]],                         // 1-5-6-4
        [d[3], d[4], d[2], d[5]],                         // 王道進行
        [d[0], d[3], d[0], d[4]],                         // 1-4-1-5
      ],
      cinematic: [
        [d[5], d[3], d[0], d[4]],                         // 6-4-1-5
        [d[3], d[4], d[2], d[5]],                         // 王道進行
        [d[0], d[4], d[5], d[2]],                         // カノン前半
      ]
    };

    const moodTemplatesMinor = {
      dark: [
        [d[0], d[3], d[5], d[4]],                 // i-iv-VI-v
        [d[0], d[5], d[3], d[4]],                 // i-VI-III-VII
        [d[5], d[3], d[4], d[0]],                 // VI-iv-v-i
      ],
      setsunai: [
        [d[5], d[3], d[0], d[4]],                 // VI-iv-i-V
        [d[0], d[5], d[3], d[4]],                 // i-VI-III-VII
        [d[1], d[4], d[0], d[5]],                 // ii°-V-i-VI
      ],
      jazzy: [
        [d[1], d[4], d[0], d[5]],                 // ii°-V-i-VI
        [d[3], d[4], d[0], d[5]],                 // iv-V-i-VI
      ],
      emotional: [
        [d[0], d[5], d[3], d[4]],
        [d[5], d[3], d[4], d[0]],
      ],
      cinematic: [
        [d[0], d[3], d[5], d[4]],
        [d[5], d[3], d[4], d[0]],
      ]
    };

    // Priority 1: Mood-driven templates
    const moodPool = mode === 'major'
      ? (moodTemplatesMajor[imageType] || moodTemplatesMajor['bright'])
      : (moodTemplatesMinor[imageType] || moodTemplatesMinor['dark'] || moodTemplatesMajor['bright']);

    const pool = moodPool;

    // Select base template
    let prog = [...pool[Math.floor(Math.random() * pool.length)]];

    // Extend to required number of chords
    while (prog.length < numChords) {
      const extra = [...pool[Math.floor(Math.random() * pool.length)]];
      prog = prog.concat(extra);
    }
    prog = prog.slice(0, numChords);

    // Apply image-based modifications
    prog = prog.map(c => this._applyImage(c, imageType));

    return prog;
  }

  /** Apply image/mood modifier to a chord — conservative for most moods */
  _applyImage(chord, imageType) {
    const parsed = this.parseChord(chord);
    if (!parsed) return chord;
    const root = parsed.root;
    const type = parsed.type;
    const r = () => Math.random();

    // Jazzy: aggressive extensions (70% chance)
    if (imageType === 'jazzy') {
      if (r() > 0.7) return chord; // 30% stay plain
      if (type === '') return root + (r() > 0.5 ? 'maj7' : (r() > 0.5 ? '9' : '6'));
      if (type === 'm') return root + (r() > 0.5 ? 'm7' : 'm9');
      return chord;
    }

    // All other moods: keep it simple, only lightly season
    switch (imageType) {
      case 'bright':
        if (r() > 0.2) return chord;
        if (type === '') return root + 'add9';
        return chord;
      case 'dark':
        if (r() > 0.2) return chord;
        if (type === 'm') return root + 'm7';
        return chord;
      case 'beautiful':
        if (r() > 0.25) return chord;
        if (type === '') return root + (r() > 0.5 ? 'add9' : 'sus4');
        return chord;
      case 'setsunai':
        if (r() > 0.2) return chord;
        if (type === 'm') return root + 'm7';
        if (type === '') return root + '7';
        return chord;
      case 'powerful':
        return chord;
      case 'calm':
        if (r() > 0.25) return chord;
        if (type === '') return root + (r() > 0.5 ? 'add9' : 'maj7');
        return chord;
      case 'emotional':
        if (r() > 0.2) return chord;
        if (type === '') return root + 'sus4';
        if (type === 'm') return root + 'm7';
        return chord;
      case 'pop':
        if (r() > 0.15) return chord;
        if (type === '') return root + 'add9';
        return chord;
      case 'cinematic':
        if (r() > 0.25) return chord;
        if (type === '') return root + 'sus4';
        return chord;
      default:
        return chord;
    }
  }

  // ==========================================
  // Suggestion Engine
  // ==========================================

  /** Count common pitch classes between two chords */
  _commonTones(chordA, chordB) {
    const pcsA = new Set(this.getChordPitchClasses(chordA));
    const pcsB = this.getChordPitchClasses(chordB);
    return pcsB.filter(pc => pcsA.has(pc)).length;
  }

  /** Score root motion quality (0-1) */
  _rootMotionScore(fromChord, toChord) {
    const parsedA = this.parseChord(fromChord);
    const parsedB = this.parseChord(toChord);
    if (!parsedA || !parsedB) return 0.5;

    const pcA = this.noteMap[parsedA.root] || 0;
    const pcB = this.noteMap[parsedB.root] || 0;
    const interval = Math.abs(pcB - pcA) % 12;
    const normalized = Math.min(interval, 12 - interval);

    const scores = { 0: 0.9, 1: 0.75, 2: 0.8, 3: 0.7, 4: 0.7, 5: 1.0, 6: 0.4, 7: 1.0 };
    return scores[normalized] || 0.5;
  }

  /** Calculate connection score between two chords (0-1) */
  _connectionScore(fromChord, toChord) {
    const commonTones = this._commonTones(fromChord, toChord);
    const rootMotion = this._rootMotionScore(fromChord, toChord);
    return Math.min(1, (commonTones / 3) * 0.4 + rootMotion * 0.6);
  }

  /** Get suggestion candidates for a selected chord block for all 10 moods */
  getSuggestions(currentChord, prevChord, nextChord, key, mode) {
    const root = this.parseChord(currentChord)?.root || 'C';
    const rootPc = this.noteMap[root] || 0;
    const diatonic = this.getDiatonicChords(key, mode);

    const moodPools = {
      jazzy: [
        root + 'maj7', root + '7', root + 'm7', root + '9', root + 'm9', root + '6', root + '7sus4',
        this.pcToNote[(rootPc + 7) % 12] + '7', this.pcToNote[(rootPc + 6) % 12] + '7'
      ],
      bright: [
        root + '', root + 'add9', root + 'sus2', root + '6',
        this.pcToNote[(rootPc + 5) % 12] + '', ...diatonic.filter(c => !c.includes('m') && !c.includes('dim'))
      ],
      dark: [
        root + 'm', root + 'm7', root + 'm7b5', root + 'dim',
        this.pcToNote[(rootPc + 8) % 12] + '', this.pcToNote[(rootPc + 10) % 12] + ''
      ],
      beautiful: [
        root + 'sus4', root + 'add9', root + 'maj7', root + 'm(maj7)',
        root + '/' + this.pcToNote[(rootPc + 9) % 12], root + '/' + this.pcToNote[(rootPc + 4) % 12]
      ],
      setsunai: [
        root + 'm7', root + 'sus4', root + '7', root + 'm9',
        this.pcToNote[(rootPc + 8) % 12] + '', this.pcToNote[(rootPc + 10) % 12] + ''
      ],
      powerful: [
        root + '', root + 'sus4', root + '5', ...diatonic.filter(c => !c.includes('dim'))
      ],
      calm: [
        root + 'add9', root + 'maj7', root + 'sus2', root + '',
        this.pcToNote[(rootPc + 5) % 12] + 'add9'
      ],
      emotional: [
        root + 'sus4', root + '7', root + 'add9', root + 'm7',
        this.pcToNote[(rootPc + 5) % 12] + 'sus4'
      ],
      pop: [
        root + '', root + 'add9', root + 'm7', ...diatonic.slice(0, 6)
      ],
      cinematic: [
        root + 'sus4', root + 'maj7', root + 'add9', root + 'm(maj7)',
        this.pcToNote[(rootPc + 8) % 12] + ''
      ]
    };

    const result = {};
    const threshold = 0.35;

    Object.keys(moodPools).forEach(cat => {
      result[cat] = [];
      const seen = new Set();
      moodPools[cat].forEach(symbol => {
        if (seen.has(symbol) || symbol === currentChord) return;
        seen.add(symbol);

        let score = 0.5;
        if (prevChord) score = (score + this._connectionScore(prevChord, symbol)) / 2;
        if (nextChord) score = (score + this._connectionScore(symbol, nextChord)) / 2;
        if (!prevChord && !nextChord) score = 0.7;

        if (score >= threshold) {
          result[cat].push({
            symbol,
            notes: this.getChordMidi(symbol),
            score: Math.round(score * 100) / 100
          });
        }
      });

      result[cat].sort((a, b) => b.score - a.score);
      result[cat] = result[cat].slice(0, 6);
    });

    return result;
  }

  /**
   * Get range substitution suggestions with named famous phrases.
   */
  getRangeSuggestions(prevChord, nextChord, rangeLength, key, mode) {
    const d = this.getDiatonicChords(key, mode);
    const dom3 = this.pcToNote[(this.noteMap[key] + 4) % 12] + '7';
    const dom1 = d[0] + '7';

    let phraseDefs = [];
    if (rangeLength === 2) {
      phraseDefs = [
        { name: '王道アプローチ (IV - V)', pattern: [d[3], d[4]] },
        { name: 'ツーファイブ (ii - V)', pattern: [d[1], d[4]] },
        { name: '丸サ接続 (III7 - vi)', pattern: [dom3, d[5]] },
        { name: '感情高揚 (iii - vi)', pattern: [d[2], d[5]] },
        { name: 'サブドミナント終止 (IV - I)', pattern: [d[3], d[0]] },
        { name: 'ドミナント進行 (I - V)', pattern: [d[0], d[4]] },
        { name: '哀愁進行 (vi - IV)', pattern: [d[5], d[3]] },
      ];
    } else if (rangeLength === 3) {
      phraseDefs = [
        { name: '王道 2-5-1 (ii - V - I)', pattern: [d[1], d[4], d[0]] },
        { name: '王道アプローチ (IV - V - iii)', pattern: [d[3], d[4], d[2]] },
        { name: 'サビ前高揚 (IV - V - vi)', pattern: [d[3], d[4], d[5]] },
        { name: '丸サフレーズ (IV - III7 - vi)', pattern: [d[3], dom3, d[5]] },
        { name: 'カノンアプローチ (I - IV - V)', pattern: [d[0], d[3], d[4]] },
        { name: 'サブドミモーション (iii - vi - ii)', pattern: [d[2], d[5], d[1]] },
      ];
    } else {
      phraseDefs = [
        { name: '王道進行 (エモさ定番)', pattern: [d[3], d[4], d[2], d[5]] },
        { name: '丸サ進行 (おしゃれ・CityPop)', pattern: [d[3], dom3, d[5], dom1] },
        { name: '小室進行 (力強い・90s)', pattern: [d[5], d[3], d[4], d[0]] },
        { name: 'カノン進行 (安心感)', pattern: [d[0], d[4], d[5], d[2]] },
        { name: '小悪魔進行 (ポップ定番)', pattern: [d[0], d[4], d[5], d[3]] },
        { name: '2-5-1-6進行 (ジャズ・オシャレ)', pattern: [d[1], d[4], d[0], d[5]] },
        { name: 'アンドロメダ進行 (ドラマチック)', pattern: [d[5], d[3], d[0], d[4]] },
        { name: '1-4-1-5進行 (定番展開)', pattern: [d[0], d[3], d[0], d[4]] },
      ];
    }

    const moodKeys = Object.keys(this.moods);
    const result = {};

    moodKeys.forEach(cat => {
      const phrases = [];
      phraseDefs.forEach(def => {
        let adjusted = [...def.pattern];
        while (adjusted.length < rangeLength) {
          adjusted.push(adjusted[adjusted.length - 1]);
        }
        adjusted = adjusted.slice(0, rangeLength);

        let score = 0.7;
        if (prevChord) score = (score + this._connectionScore(prevChord, adjusted[0])) / 2;
        if (nextChord) score = (score + this._connectionScore(adjusted[adjusted.length - 1], nextChord)) / 2;
        score = Math.round(score * 100) / 100;

        phrases.push({
          name: def.name,
          chords: adjusted.map(c => this._applyImage(c, cat)),
          score
        });
      });

      // Deduplicate & sort
      const seen = new Set();
      const clean = [];
      phrases.forEach(p => {
        const keyStr = p.chords.join('-');
        if (!seen.has(keyStr)) {
          seen.add(keyStr);
          clean.push(p);
        }
      });
      clean.sort((a, b) => b.score - a.score);
      result[cat] = clean.slice(0, 4);
    });

    return result;
  }

  // ==========================================
  // Mood Preview & Auto Tempo
  // ==========================================

  /** Get mood preview chords */
  getMoodPreviewChords(mood, key) {
    const base = this.noteMap[key] || 0;
    const r = n => this.pcToNote[(base + n) % 12];

    switch (mood) {
      case 'jazzy':       return [r(0) + 'maj7', r(5) + '9', r(0) + '6'];
      case 'bright':      return [r(0) + 'add9', r(5) + '', r(0) + ''];
      case 'dark':        return [r(0) + 'm7', r(8) + '', r(10) + ''];
      case 'beautiful':   return [r(0) + 'sus4', r(0) + '', r(5) + 'add9'];
      case 'setsunai':    return [r(0) + 'm7', r(5) + 'sus4', r(0) + 'm'];
      case 'powerful':    return [r(0) + '', r(5) + '', r(7) + ''];
      case 'calm':        return [r(0) + 'add9', r(5) + 'maj7', r(0) + 'sus2'];
      case 'emotional':   return [r(0) + 'sus4', r(0) + '', r(5) + 'm7'];
      case 'pop':         return [r(0) + '', r(7) + '', r(9) + 'm'];
      case 'cinematic':   return [r(0) + 'sus4', r(8) + '', r(0) + 'add9'];
      case 'energetic':   return [r(0) + '', r(5) + '', r(7) + ''];
      case 'joyful':      return [r(0) + 'add9', r(5) + '', r(0) + ''];
      case 'melancholic': return [r(0) + 'm', r(8) + '', r(10) + ''];
      case 'mysterious':  return [r(0) + 'm7', r(6) + '7b5', r(0) + 'm'];
      case 'chill':       return [r(0) + 'maj7', r(5) + 'add9', r(0) + 'maj7'];
      case 'dreamy':      return [r(0) + 'add9', r(5) + 'maj7', r(0) + 'sus2'];
      case 'classical':   return [r(0) + '', r(5) + '', r(7) + '7'];
      case 'driving':     return [r(0) + '', r(7) + '', r(5) + ''];
      default:            return [r(0) + ''];
    }
  }

  /** Get "おまかせ" tempo based on image type with randomness */
  getAutoTempo(imageType) {
    const moodDef = this.moods[imageType];
    const range = moodDef ? moodDef.tempoRange : [100, 140];
    return Math.floor(range[0] + Math.random() * (range[1] - range[0]));
  }

  /** Get key characteristic description */
  getKeyDescription(key) {
    const chars = this.keyCharacteristics[key];
    if (!chars) return '';
    return `${chars.color}・${chars.feel}`;
  }
}

// Global instance
const chordEngine = new ChordEngine();
