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
  autoSelectKeysForSong(sections, melodyNotes = []) {
    if (sections.length === 0) return [];
    const detectedKey = melodyNotes.length
      ? this.detectKeyFromMelody(melodyNotes)
      : null;

    // 1. Check if user explicitly set a key for any section
    let explicitKey = null;
    let explicitMode = null;
    for (const sec of sections) {
      if (sec.key && sec.key !== 'auto') {
        explicitKey = sec.key;
        explicitMode = sec.mode !== 'auto'
          ? sec.mode
          : (detectedKey?.mode || 'major');
        break;
      }
    }

    // 2. Determine Home Major & Home Relative Minor keys for the song
    let homeMajorKey = 'C';
    let homeMinorKey = 'A';

    if (!explicitKey && detectedKey) {
      if (detectedKey.mode === 'minor') {
        homeMinorKey = detectedKey.key;
        homeMajorKey = this.getRelativeMajor(detectedKey.key);
      } else {
        homeMajorKey = detectedKey.key;
        homeMinorKey = this.getRelativeMinor(detectedKey.key);
      }
    } else if (explicitKey) {
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
          secMode = detectedKey ? detectedKey.mode : moodDef.defaultMode;
        }
        return { key: sec.key, mode: secMode };
      }

      // Determine mode based on atmosphere
      const moodDef = this.moods[sec.image] || this.moods['bright'];
      let targetMode = sec.mode;
      if (!targetMode || targetMode === 'auto') {
        targetMode = detectedKey ? detectedKey.mode : moodDef.defaultMode;
      }

      // Assign: Major -> Home Major, Minor -> Relative Minor
      if (targetMode === 'minor') {
        return { key: homeMinorKey, mode: 'minor' };
      } else {
        return { key: homeMajorKey, mode: 'major' };
      }
    });
  }

  /** Infer one of 24 major/minor keys from duration-weighted melody pitch classes. */
  detectKeyFromMelody(melodyNotes) {
    if (!melodyNotes || melodyNotes.length === 0) {
      return { key: 'C', mode: 'major', confidence: 0 };
    }

    // Krumhansl-Schmuckler tonal profiles, rotated through all tonics.
    const majorProfile = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
    const minorProfile = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
    const histogram = Array(12).fill(0);
    const sortedNotes = [...melodyNotes].sort((a, b) => a.beat - b.beat);

    sortedNotes.forEach((note, index) => {
      const pc = ((note.midi % 12) + 12) % 12;
      let weight = Math.sqrt(Math.max(note.durationBeats || 0.25, 0.1));
      if (Math.abs(note.beat - Math.round(note.beat)) < 0.08) weight *= 1.25;
      if (index === 0 || index === sortedNotes.length - 1) weight *= 1.2;
      histogram[pc] += weight * Math.max(0.4, note.velocity || 0.7);
    });

    const candidates = [];
    for (let tonic = 0; tonic < 12; tonic++) {
      [['major', majorProfile], ['minor', minorProfile]].forEach(([mode, profile]) => {
        let score = 0;
        for (let pc = 0; pc < 12; pc++) {
          score += histogram[pc] * profile[(pc - tonic + 12) % 12];
        }

        const firstPc = ((sortedNotes[0].midi % 12) + 12) % 12;
        const lastPc = ((sortedNotes[sortedNotes.length - 1].midi % 12) + 12) % 12;
        if (firstPc === tonic) score *= 1.035;
        if (lastPc === tonic) score *= 1.08;
        if (lastPc === (tonic + 7) % 12) score *= 1.025;
        candidates.push({ tonic, mode, score });
      });
    }

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    const runnerUp = candidates[1];
    const confidence = best.score > 0
      ? Math.max(0, Math.min(1, (best.score - runnerUp.score) / best.score * 4))
      : 0;
    return {
      key: this.pcToNote[best.tonic],
      mode: best.mode,
      confidence
    };
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

    // 1. Extract unique pitch classes (0-11) for all chord tones
    // Tonal.js understands a wider range of symbols; the local table remains
    // as an offline-safe fallback.
    const pitchClasses = Array.from(new Set(this.getChordPitchClasses(symbol)));

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
    if (typeof Tonal !== 'undefined' && Tonal.Chord && Tonal.Note) {
      const tonalChord = Tonal.Chord.get(symbol);
      if (tonalChord && tonalChord.notes && tonalChord.notes.length) {
        const tonalPcs = tonalChord.notes
          .map(noteName => Tonal.Note.chroma(noteName))
          .filter(pc => Number.isInteger(pc));
        if (tonalPcs.length) return Array.from(new Set(tonalPcs));
      }
    }

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

  // ==========================================
  // Melody-aware harmony ranking
  // ==========================================

  /** Pitch classes in the selected key. Uses Tonal.js when available. */
  getScalePitchClasses(key, mode) {
    if (typeof Tonal !== 'undefined' && Tonal.Scale && Tonal.Note) {
      const scale = Tonal.Scale.get(`${key} ${mode}`);
      if (scale && scale.notes && scale.notes.length) {
        return scale.notes
          .map(noteName => Tonal.Note.chroma(noteName))
          .filter(pc => Number.isInteger(pc));
      }
    }

    const rootPc = this.noteMap[key] || 0;
    const intervals = mode === 'minor'
      ? [0, 2, 3, 5, 7, 8, 10]
      : [0, 2, 4, 5, 7, 9, 11];
    return intervals.map(interval => (rootPc + interval) % 12);
  }

  /** Candidate pool: template, diatonic chords, mixture, and secondary dominants. */
  getHarmonyCandidates(baseChord, key, mode) {
    const tonicPc = this.noteMap[key] || 0;
    const diatonic = this.getDiatonicChords(key, mode);
    const candidates = [baseChord, ...diatonic];

    // Seventh/add-note variants let a sustained melody note become a real
    // chord tone instead of being treated as a generic non-chord tone.
    diatonic.forEach(symbol => {
      const parsed = this.parseChord(symbol);
      if (!parsed) return;
      if (parsed.type === '') {
        candidates.push(`${parsed.root}maj7`, `${parsed.root}add9`, `${parsed.root}6`);
      } else if (parsed.type === 'm') {
        candidates.push(`${parsed.root}m7`, `${parsed.root}m9`);
      } else if (parsed.type === 'dim') {
        candidates.push(`${parsed.root}m7b5`);
      }
    });

    if (mode === 'major') {
      candidates.push(
        `${this.pcToNote[(tonicPc + 5) % 12]}m`,  // borrowed iv
        this.pcToNote[(tonicPc + 8) % 12],        // borrowed bVI
        this.pcToNote[(tonicPc + 10) % 12]        // borrowed bVII
      );
    } else {
      candidates.push(
        `${this.pcToNote[(tonicPc + 7) % 12]}7`,  // harmonic-minor V7
        this.pcToNote[(tonicPc + 1) % 12]         // Neapolitan colour
      );
    }

    // Dominants targeting the main diatonic destinations.
    diatonic.slice(0, 6).forEach(target => {
      const targetRoot = this.parseChord(target)?.root;
      if (targetRoot && this.noteMap[targetRoot] !== undefined) {
        candidates.push(`${this.pcToNote[(this.noteMap[targetRoot] + 7) % 12]}7`);
      }
    });

    return Array.from(new Set(candidates)).filter(symbol => this.parseChord(symbol));
  }

  /** Melody/chord compatibility from 0 to 1, weighted by strong beats and velocity. */
  melodyCompatibility(chordSymbol, melodyNotes, key, mode) {
    if (!melodyNotes || melodyNotes.length === 0) return 0.5;

    const chordPcs = new Set(this.getChordPitchClasses(chordSymbol));
    const scalePcs = new Set(this.getScalePitchClasses(key, mode));
    let scoreTotal = 0;
    let weightTotal = 0;

    melodyNotes.forEach(note => {
      const pc = ((note.midi % 12) + 12) % 12;
      const beatFraction = Math.abs(note.beat - Math.round(note.beat));
      const strongBeatWeight = beatFraction < 0.08 ? 1.35 : 1;
      const roleWeight = note.importance || 1;
      const durationWeight = Math.sqrt(Math.max(note.overlapBeats || note.durationBeats || 0.25, 0.1));
      const weight = strongBeatWeight * roleWeight * durationWeight
        * Math.max(0.35, note.velocity || 0.7);

      let fit = 0.15;
      if (chordPcs.has(pc)) {
        fit = 1;
      } else if (scalePcs.has(pc)) {
        fit = 0.48;
      } else {
        const nearest = Math.min(...Array.from(chordPcs).map(chordPc => {
          const distance = Math.abs(chordPc - pc);
          return Math.min(distance, 12 - distance);
        }));
        fit = nearest === 1 ? 0.08 : 0.25;
      }

      scoreTotal += fit * weight;
      weightTotal += weight;
    });

    return weightTotal ? scoreTotal / weightTotal : 0.5;
  }

  /** Average nearest-note motion between upper chord voices, normalized to 0..1. */
  voiceLeadingScore(fromChord, toChord) {
    if (!fromChord) return 0.7;
    const fromNotes = this.getChordMidi(fromChord).slice(1);
    const toNotes = this.getChordMidi(toChord).slice(1);
    if (!fromNotes.length || !toNotes.length) return 0.5;

    const averageMotion = toNotes.reduce((sum, note) => {
      const nearest = Math.min(...fromNotes.map(prev => Math.abs(prev - note)));
      return sum + nearest;
    }, 0) / toNotes.length;

    return Math.max(0, 1 - Math.min(averageMotion, 6) / 6);
  }

  chordTension(chordSymbol) {
    const type = this.parseChord(chordSymbol)?.type || '';
    if (type.includes('dim') || type.includes('b5')) return 0.95;
    if (type.includes('9') || type === '7') return 0.78;
    if (type.includes('maj7') || type.includes('m7')) return 0.62;
    if (type.includes('sus') || type.includes('aug')) return 0.58;
    if (type === 'm') return 0.42;
    return 0.28;
  }

  moodTensionTarget(mood) {
    const targets = {
      jazzy: 0.72, bright: 0.32, dark: 0.78, beautiful: 0.48,
      setsunai: 0.62, powerful: 0.52, calm: 0.28, emotional: 0.66,
      pop: 0.38, cinematic: 0.74
    };
    return targets[mood] ?? 0.5;
  }

  harmonicFunction(chordSymbol, key, mode) {
    const parsed = this.parseChord(chordSymbol);
    if (!parsed || this.noteMap[parsed.root] === undefined) return 'chromatic';
    const tonic = this.noteMap[key] || 0;
    const degree = (this.noteMap[parsed.root] - tonic + 12) % 12;

    if (mode === 'minor') {
      if ([0, 3, 8].includes(degree)) return 'tonic';
      if ([2, 5].includes(degree)) return 'predominant';
      if ([7, 10, 11].includes(degree)) return 'dominant';
    } else {
      if ([0, 4, 9].includes(degree)) return 'tonic';
      if ([2, 5].includes(degree)) return 'predominant';
      if ([7, 11].includes(degree)) return 'dominant';
    }
    return parsed.type === '7' ? 'dominant' : 'chromatic';
  }

  harmonicTransitionScore(fromChord, toChord, key, mode) {
    if (!fromChord) return 0.7;
    const fromFunction = this.harmonicFunction(fromChord, key, mode);
    const toFunction = this.harmonicFunction(toChord, key, mode);
    const functionScores = {
      tonic: { tonic: 0.62, predominant: 0.95, dominant: 0.78, chromatic: 0.55 },
      predominant: { tonic: 0.62, predominant: 0.48, dominant: 1, chromatic: 0.55 },
      dominant: { tonic: 1, predominant: 0.25, dominant: 0.42, chromatic: 0.45 },
      chromatic: { tonic: 0.82, predominant: 0.58, dominant: 0.72, chromatic: 0.38 }
    };

    const parsedFrom = this.parseChord(fromChord);
    const parsedTo = this.parseChord(toChord);
    const fromPc = this.noteMap[parsedFrom?.root];
    const toPc = this.noteMap[parsedTo?.root];
    let rootMotion = 0.5;
    if (fromPc !== undefined && toPc !== undefined) {
      const distance = Math.min(Math.abs(fromPc - toPc), 12 - Math.abs(fromPc - toPc));
      rootMotion = ({ 0: 0.28, 1: 0.48, 2: 0.64, 3: 0.58, 4: 0.62, 5: 1, 6: 0.2 })[distance] ?? 1;
      // A dominant seventh resolving down a fifth gets an explicit resolution bonus.
      if (parsedFrom.type === '7' && (toPc - fromPc + 12) % 12 === 5) rootMotion = 1;
    }

    const functionFit = functionScores[fromFunction]?.[toFunction] ?? 0.5;
    const voiceLeading = this.voiceLeadingScore(fromChord, toChord);
    return voiceLeading * 0.48 + functionFit * 0.37 + rootMotion * 0.15;
  }

  /**
   * Re-rank generated chords against an imported melody without requiring a
   * training database. Returns both the chosen chords and explainable scores.
   */
  harmonizeWithMelody(baseProgression, melodyNotes, sectionStartBeat,
                       beatsPerChord, key, mode, mood) {
    if (!baseProgression || baseProgression.length === 0) {
      return { chords: [], insights: [] };
    }
    if (!melodyNotes || melodyNotes.length === 0) {
      return { chords: [...baseProgression], insights: [] };
    }

    const diatonic = new Set(this.getDiatonicChords(key, mode));
    const tonicPc = this.noteMap[key] || 0;
    const targetTension = this.moodTensionTarget(mood);
    const sortedMelody = [...melodyNotes].sort((a, b) => a.beat - b.beat);

    const slots = baseProgression.map((baseChord, index) => {
      const slotStart = sectionStartBeat + index * beatsPerChord;
      const slotEnd = slotStart + beatsPerChord;
      const slotNotes = sortedMelody.filter(note => {
        const noteEnd = note.beat + Math.max(note.durationBeats || 0, 0.05);
        return note.beat < slotEnd && noteEnd > slotStart;
      }).map(note => {
        const melodyIndex = sortedMelody.indexOf(note);
        const previous = sortedMelody[melodyIndex - 1];
        const next = sortedMelody[melodyIndex + 1];
        const previousStep = previous ? note.midi - previous.midi : 0;
        const nextStep = next ? next.midi - note.midi : 0;
        const isPassing = previous && next
          && Math.abs(previousStep) <= 2
          && Math.abs(nextStep) <= 2
          && Math.sign(previousStep) === Math.sign(nextStep);
        const startsSlot = Math.abs(note.beat - slotStart) < 0.08;
        const startsBeat = Math.abs(note.beat - Math.round(note.beat)) < 0.08;
        const noteEnd = note.beat + Math.max(note.durationBeats || 0, 0.05);
        const overlapBeats = Math.max(0, Math.min(noteEnd, slotEnd) - Math.max(note.beat, slotStart));
        return {
          ...note,
          overlapBeats,
          importance: startsSlot ? 2.2 : startsBeat ? 1.35 : isPassing ? 0.42 : 0.8
        };
      });

      const candidates = this.getHarmonyCandidates(baseChord, key, mode).map(candidate => {
        const melodyFit = this.melodyCompatibility(candidate, slotNotes, key, mode);
        const theoryFit = diatonic.has(candidate) ? 1 : 0.62;
        const moodFit = 1 - Math.abs(this.chordTension(candidate) - targetTension);
        const templateFit = candidate === baseChord ? 1 : 0.45;
        const anchorNote = slotNotes.reduce((best, note) => {
          const strength = note.importance * Math.max(note.overlapBeats, 0.1);
          return !best || strength > best.strength ? { note, strength } : best;
        }, null);
        const chordPcs = new Set(this.getChordPitchClasses(candidate));
        const anchorFit = anchorNote
          ? (chordPcs.has(((anchorNote.note.midi % 12) + 12) % 12) ? 1 : 0)
          : 0.5;

        let unaryScore;
        if (slotNotes.length) {
          unaryScore = melodyFit * 0.42
            + anchorFit * 0.18
            + theoryFit * 0.12
            + moodFit * 0.08
            + templateFit * 0.10;
        } else {
          unaryScore = theoryFit * 0.18 + moodFit * 0.12 + templateFit * 0.60;
        }

        const candidateRoot = this.noteMap[this.parseChord(candidate)?.root];
        if (index === baseProgression.length - 1 && candidateRoot === tonicPc) {
          unaryScore += 0.09;
        }

        return { candidate, unaryScore, melodyFit, anchorFit, theoryFit, moodFit };
      });

      return { baseChord, slotNotes, candidates };
    });

    // Viterbi-style dynamic programming: optimize the full section instead of
    // making isolated greedy choices at each chord slot.
    const paths = [];
    paths[0] = slots[0].candidates.map(candidate => ({
      total: candidate.unaryScore,
      previousIndex: -1
    }));

    for (let index = 1; index < slots.length; index++) {
      paths[index] = slots[index].candidates.map(candidate => {
        let bestTotal = -Infinity;
        let bestPreviousIndex = 0;
        slots[index - 1].candidates.forEach((previous, previousIndex) => {
          const transition = this.harmonicTransitionScore(
            previous.candidate, candidate.candidate, key, mode
          );
          const repeatPenalty = previous.candidate === candidate.candidate ? 0.16 : 0;
          const total = paths[index - 1][previousIndex].total
            + candidate.unaryScore
            + transition * 0.28
            - repeatPenalty;
          if (total > bestTotal) {
            bestTotal = total;
            bestPreviousIndex = previousIndex;
          }
        });
        return { total: bestTotal, previousIndex: bestPreviousIndex };
      });
    }

    const chosenIndices = Array(slots.length).fill(0);
    const finalPath = paths[paths.length - 1];
    chosenIndices[chosenIndices.length - 1] = finalPath.reduce(
      (bestIndex, entry, index) => entry.total > finalPath[bestIndex].total ? index : bestIndex,
      0
    );
    for (let index = chosenIndices.length - 1; index > 0; index--) {
      chosenIndices[index - 1] = paths[index][chosenIndices[index]].previousIndex;
    }

    const chords = chosenIndices.map((candidateIndex, slotIndex) =>
      slots[slotIndex].candidates[candidateIndex].candidate
    );
    const insights = chosenIndices.map((candidateIndex, slotIndex) => {
      if (!slots[slotIndex].slotNotes.length) return null;
      const selected = slots[slotIndex].candidates[candidateIndex];
      const previousChord = slotIndex > 0 ? chords[slotIndex - 1] : null;
      return {
        melodyFit: selected.melodyFit,
        anchorFit: selected.anchorFit,
        voiceLeading: this.voiceLeadingScore(previousChord, selected.candidate),
        theoryFit: selected.theoryFit,
        moodFit: selected.moodFit,
        changedFromTemplate: selected.candidate !== slots[slotIndex].baseChord
      };
    });

    return { chords, insights };
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
  getSuggestions(currentChord, prevChord, nextChord, key, mode, melodyNotes = []) {
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

        const melodyFit = melodyNotes.length
          ? this.melodyCompatibility(symbol, melodyNotes, key, mode)
          : null;
        if (melodyFit !== null) score = score * 0.45 + melodyFit * 0.55;

        if (score >= threshold) {
          result[cat].push({
            symbol,
            notes: this.getChordMidi(symbol),
            score: Math.round(score * 100) / 100,
            melodyFit: melodyFit === null ? null : Math.round(melodyFit * 100) / 100
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
