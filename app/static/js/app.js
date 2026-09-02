/**
 * Chordly — Main Application
 * Orchestrates ChordEngine, AudioManager, and UIManager.
 * Manages application state and wires up all event handlers.
 */

// Application state
const state = {
  songData: null,       // Current song configuration + chords
  selectedBlock: null,  // { sectionIdx, chordIdx }
  isPlaying: false,
  stopPlayback: null,
  melody: null,         // Parsed melody notes in beat-based timing
  midiTracks: [],       // Available non-empty tracks from the imported MIDI
  midiImport: null,     // File-level metadata shared by selectable MIDI tracks
};

document.addEventListener('DOMContentLoaded', () => {
  // Initialize UI DOM references
  uiManager.initDom();

  // =============================================
  // Audio Activation
  // =============================================
  document.getElementById('btn-activate-audio').addEventListener('click', async () => {
    await audioManager.init();
    uiManager.showSetup();
  });

  // =============================================
  // Setup Modal Events
  // =============================================

  // Add section button
  document.getElementById('btn-add-section').addEventListener('click', () => {
    uiManager.addSection();
  });

  // Key/Mode change → audio feedback (play tonic chord)
  document.getElementById('setup-sections').addEventListener('change', (e) => {
    const row = e.target.closest('.section-setup-row');
    if (!row) return;

    if (e.target.classList.contains('select-key') || e.target.classList.contains('select-mode')) {
      const key = row.querySelector('.select-key').value;
      const mode = row.querySelector('.select-mode').value;
      const tonicSymbol = key + (mode === 'minor' ? 'm' : '');
      audioManager.playChord(chordEngine.getChordMidi(tonicSymbol));
    }

    if (e.target.classList.contains('select-image')) {
      const key = row.querySelector('.select-key').value;
      const mood = e.target.value;
      const previewChords = chordEngine.getMoodPreviewChords(mood, key);
      audioManager.playMoodPreview(previewChords);
    }
  });

  // おまかせ checkbox
  document.getElementById('chk-tempo-auto').addEventListener('change', (e) => {
    const tempoInput = document.getElementById('input-tempo');
    tempoInput.disabled = e.target.checked;
    if (e.target.checked) {
      tempoInput.style.opacity = '0.5';
    } else {
      tempoInput.style.opacity = '1';
    }
  });

  // Optional MIDI melody import. Parsing remains entirely in the browser.
  document.getElementById('input-melody-midi').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await importMelodyMidi(file);
  });

  document.getElementById('select-melody-track').addEventListener('change', (e) => {
    selectMelodyTrack(parseInt(e.target.value));
  });

  document.getElementById('btn-preview-melody').addEventListener('click', () => {
    if (!state.melody) return;
    const bpm = parseInt(document.getElementById('input-tempo').value) || state.melody.sourceTempo || 120;
    audioManager.playMelody(state.melody.notes, bpm);
  });

  document.getElementById('btn-clear-melody').addEventListener('click', () => {
    clearMelodyImport();
  });

  // Generate button
  document.getElementById('btn-generate').addEventListener('click', () => {
    generateAndRender();
  });

  // =============================================
  // Main Editor Events
  // =============================================

  // Regenerate button
  document.getElementById('btn-regenerate').addEventListener('click', () => {
    if (!state.songData) return;
    regenerateChords();
  });

  // Settings button → open setup modal in editing mode
  document.getElementById('btn-setup').addEventListener('click', () => {
    if (state.isPlaying) stopPlayback();
    uiManager.hideSuggestionPanel();
    if (state.songData) uiManager.populateSetupFromSong(state.songData);
    uiManager.showSetup(true);
  });

  // Cancel setup buttons
  const cancelSetupHeader = document.getElementById('btn-cancel-setup');
  if (cancelSetupHeader) {
    cancelSetupHeader.addEventListener('click', () => uiManager.hideSetup());
  }
  const cancelSetupFooter = document.getElementById('btn-cancel-setup-footer');
  if (cancelSetupFooter) {
    cancelSetupFooter.addEventListener('click', () => uiManager.hideSetup());
  }

  // Live Header Parameter Controls
  const headerBpm = document.getElementById('header-bpm');
  if (headerBpm) {
    headerBpm.addEventListener('change', (e) => {
      const newBpm = parseInt(e.target.value);
      if (newBpm >= 40 && newBpm <= 240 && state.songData) {
        state.songData.tempo = newBpm;
      }
    });
  }

  const headerTimeSig = document.getElementById('header-timesig');
  if (headerTimeSig) {
    headerTimeSig.addEventListener('change', (e) => {
      if (!state.songData) return;
      const [num, den] = e.target.value.split('/').map(Number);
      state.songData.timeSignature = [num, den];
      uiManager.renderEditor(state.songData);
    });
  }

  const headerChordWidth = document.getElementById('header-chord-width');
  if (headerChordWidth) {
    headerChordWidth.addEventListener('change', (e) => {
      if (!state.songData) return;
      state.songData.chordDurationBeats = parseInt(e.target.value);
      regenerateChords();
    });
  }

  // Section Live Parameter Change Handler (Key, Mode, Image)
  uiManager._onSectionParamChange = (sIdx, key, mode, image) => {
    if (!state.songData) return;
    const sec = state.songData.sections[sIdx];
    sec.key = key;
    sec.mode = mode;
    sec.image = image;

    // Play mood preview
    const previewChords = chordEngine.getMoodPreviewChords(image, key);
    audioManager.playMoodPreview(previewChords);

    // Re-generate section chords
    const beatsPerMeasure = state.songData.timeSignature[0];
    const chordsPerMeasure = beatsPerMeasure / state.songData.chordDurationBeats;
    const numChords = Math.round(sec.measures * chordsPerMeasure);

    const nextSec = state.songData.sections[sIdx + 1];
    let nextFirstChord = null;
    if (nextSec) {
      const nextKey = nextSec.key || sec.key;
      const nextMode = nextSec.mode || sec.mode;
      const nextDiatonic = chordEngine.getDiatonicChords(nextKey, nextMode);
      nextFirstChord = nextDiatonic[0];
    }

    sec.chords = chordEngine.generateProgression(
      sec.key, sec.mode, sec.type, sec.image, numChords, nextFirstChord
    );

    harmonizeSectionWithMelody(state.songData, sIdx);

    uiManager.renderEditor(state.songData);
  };

  // Play button
  document.getElementById('btn-play').addEventListener('click', () => {
    if (state.isPlaying) return;
    playFullSong();
  });

  // Stop button
  document.getElementById('btn-stop').addEventListener('click', () => {
    stopPlayback();
  });

  // State for range selection
  let lastClickedBlock = null;

  // Chord block click → select single or range + show suggestions
  document.getElementById('editor-canvas').addEventListener('click', (e) => {
    const block = e.target.closest('.chord-block');
    if (!block) return;

    const sIdx = parseInt(block.dataset.sectionIdx);
    const cIdx = parseInt(block.dataset.chordIdx);
    const section = state.songData.sections[sIdx];
    const symbol = section.chords[cIdx];

    // Range selection check (Shift-click within same section)
    if (e.shiftKey && lastClickedBlock && lastClickedBlock.sectionIdx === sIdx) {
      const startIdx = Math.min(lastClickedBlock.chordIdx, cIdx);
      const endIdx = Math.max(lastClickedBlock.chordIdx, cIdx);
      const rangeLength = endIdx - startIdx + 1;

      uiManager.clearSelection();
      const allBlocks = document.querySelectorAll('.chord-block');
      let flatOffset = 0;
      for (let i = 0; i < sIdx; i++) flatOffset += state.songData.sections[i].chords.length;

      for (let i = startIdx; i <= endIdx; i++) {
        if (allBlocks[flatOffset + i]) {
          allBlocks[flatOffset + i].classList.add('range-selected');
        }
      }

      const prevChord = startIdx > 0 ? section.chords[startIdx - 1] : null;
      const nextChord = endIdx < section.chords.length - 1 ? section.chords[endIdx + 1] : null;

      const rangeSuggestions = chordEngine.getRangeSuggestions(
        prevChord, nextChord, rangeLength, section.key, section.mode
      );

      uiManager.showRangeSuggestionPanel(rangeSuggestions, sIdx, startIdx, endIdx);
      return;
    }

    // Single block click
    lastClickedBlock = { sectionIdx: sIdx, chordIdx: cIdx };
    audioManager.playChord(chordEngine.getChordMidi(symbol));

    uiManager.clearSelection();
    block.classList.add('selected');
    state.selectedBlock = { sectionIdx: sIdx, chordIdx: cIdx };

    const prevChord = cIdx > 0 ? section.chords[cIdx - 1] : null;
    const nextChord = cIdx < section.chords.length - 1 ? section.chords[cIdx + 1] : null;

    const melodyNotes = getMelodyNotesForChord(sIdx, cIdx);
    const suggestions = chordEngine.getSuggestions(
      symbol, prevChord, nextChord, section.key, section.mode, melodyNotes
    );

    uiManager.showSuggestionPanel(suggestions, symbol, sIdx, cIdx);
  });

  // Override single suggestion apply handler
  uiManager._onSuggestionApply = (newSymbol, sIdx, cIdx) => {
    state.songData.sections[sIdx].chords[cIdx] = newSymbol;
    if (state.songData.sections[sIdx].harmonyInsights) {
      state.songData.sections[sIdx].harmonyInsights[cIdx] = null;
    }
    audioManager.playChord(chordEngine.getChordMidi(newSymbol));

    uiManager.renderEditor(state.songData);
    uiManager.hideSuggestionPanel();

    const blocks = document.querySelectorAll('.chord-block');
    let flatIdx = 0;
    for (let i = 0; i < sIdx; i++) flatIdx += state.songData.sections[i].chords.length;
    flatIdx += cIdx;
    if (blocks[flatIdx]) {
      blocks[flatIdx].classList.add('flash-animation');
      setTimeout(() => blocks[flatIdx].classList.remove('flash-animation'), 300);
    }
  };

  // Override range suggestion apply handler
  uiManager._onRangeSuggestionApply = (newChords, sIdx, startIdx, endIdx) => {
    const rangeLength = endIdx - startIdx + 1;
    state.songData.sections[sIdx].chords.splice(startIdx, rangeLength, ...newChords);
    if (state.songData.sections[sIdx].harmonyInsights) {
      state.songData.sections[sIdx].harmonyInsights.splice(
        startIdx, rangeLength, ...newChords.map(() => null)
      );
    }

    audioManager.playMoodPreview(newChords);

    uiManager.renderEditor(state.songData);
    uiManager.hideSuggestionPanel();
  };

  // Close suggestion panel
  document.getElementById('btn-close-suggestions').addEventListener('click', () => {
    uiManager.hideSuggestionPanel();
    uiManager.clearSelection();
  });

  // =============================================
  // Export Events
  // =============================================

  document.getElementById('btn-export-modal').addEventListener('click', () => {
    uiManager.showExportModal();
  });

  document.getElementById('btn-close-export').addEventListener('click', () => {
    uiManager.hideExportModal();
  });

  // WAV download
  document.getElementById('btn-download-wav').addEventListener('click', async () => {
    if (!state.songData) return;

    uiManager.updateExportProgress(0, 'レンダリング中...');

    const flatChords = [];
    state.songData.sections.forEach(sec => {
      sec.chords.forEach(c => flatChords.push({ symbol: c }));
    });

    try {
      const blob = await audioManager.renderToWav(
        flatChords,
        state.songData.tempo,
        state.songData.chordDurationBeats,
        (percent) => uiManager.updateExportProgress(percent, `レンダリング中... ${percent}%`)
      );

      uiManager.updateExportProgress(100, '完了！');
      downloadBlob(blob, 'chordly_export.wav');
    } catch (err) {
      console.error('WAV export error:', err);
      uiManager.updateExportProgress(0, 'エラーが発生しました');
    }
  });

  // Plain-text chord chart download — easy to paste into notes, chats, or a DAW project.
  document.getElementById('btn-download-text').addEventListener('click', () => {
    if (!state.songData) return;

    const text = buildChordChartText();
    downloadBlob(
      new Blob([text], { type: 'text/plain;charset=utf-8' }),
      'chordly_chord_chart.txt'
    );
  });

  // MusicXML download
  document.getElementById('btn-download-xml').addEventListener('click', async () => {
    if (!state.songData) return;

    const exportData = buildExportData();

    try {
      const resp = await fetch('/api/export/musicxml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(exportData)
      });

      if (!resp.ok) throw new Error('Export failed');
      const blob = await resp.blob();
      downloadBlob(blob, 'chordly_export.musicxml');
    } catch (err) {
      console.error('MusicXML export error:', err);
      alert('MusicXML エクスポートに失敗しました');
    }
  });

  // MIDI download
  document.getElementById('btn-download-midi').addEventListener('click', async () => {
    if (!state.songData) return;

    const exportData = buildExportData();

    try {
      const resp = await fetch('/api/export/midi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(exportData)
      });

      if (!resp.ok) throw new Error('Export failed');
      const blob = await resp.blob();
      downloadBlob(blob, 'chordly_export.mid');
    } catch (err) {
      console.error('MIDI export error:', err);
      alert('MIDI エクスポートに失敗しました');
    }
  });
});

// =============================================
// Helper Functions
// =============================================

async function importMelodyMidi(file) {
  const status = document.getElementById('melody-import-status');
  status.dataset.status = '';
  status.textContent = 'MIDIを解析中...';

  try {
    if (file.size > 8 * 1024 * 1024) {
      throw new Error('8MB以下のMIDIファイルを選んでください');
    }
    if (typeof Midi === 'undefined') {
      throw new Error('MIDI解析ライブラリを読み込めませんでした');
    }

    const parsedMidi = new Midi(await file.arrayBuffer());
    const ppq = parsedMidi.header.ppq || 480;
    const sourceTempo = Math.round(parsedMidi.header.tempos?.[0]?.bpm || 120);

    state.midiTracks = parsedMidi.tracks
      .map((track, index) => ({
        index,
        track,
        score: scoreMelodyTrack(track)
      }))
      .filter(item => item.track.notes && item.track.notes.length > 0);

    if (!state.midiTracks.length) {
      throw new Error('音符を含むトラックが見つかりません');
    }

    state.midiImport = { fileName: file.name, ppq, sourceTempo };
    const trackSelect = document.getElementById('select-melody-track');
    trackSelect.innerHTML = '';
    state.midiTracks.forEach(item => {
      const option = document.createElement('option');
      option.value = item.index;
      const trackName = item.track.name || item.track.instrument?.name || `Track ${item.index + 1}`;
      option.textContent = `${trackName}（${item.track.notes.length}音）`;
      trackSelect.appendChild(option);
    });

    const bestTrack = [...state.midiTracks].sort((a, b) => b.score - a.score)[0];
    trackSelect.value = String(bestTrack.index);
    document.getElementById('melody-track-row').style.display = '';
    selectMelodyTrack(bestTrack.index);

    // Adopt the MIDI tempo as a useful starting point without enabling auto tempo.
    const tempoInput = document.getElementById('input-tempo');
    tempoInput.value = Math.min(240, Math.max(40, sourceTempo));
    document.getElementById('chk-tempo-auto').checked = false;
    tempoInput.disabled = false;
    tempoInput.style.opacity = '1';
  } catch (error) {
    clearMelodyImport(false);
    status.dataset.status = 'error';
    status.textContent = `読み込み失敗：${error.message}`;
  }
}

function scoreMelodyTrack(track) {
  if (track.instrument?.percussion) return -1000;
  const notes = [...track.notes].sort((a, b) => a.ticks - b.ticks);
  if (!notes.length) return -1000;

  let overlapCount = 0;
  let previousEnd = -Infinity;
  notes.forEach(note => {
    if (note.ticks < previousEnd) overlapCount++;
    previousEnd = Math.max(previousEnd, note.ticks + (note.durationTicks || 0));
  });

  const monophony = 1 - overlapCount / notes.length;
  const averagePitch = notes.reduce((sum, note) => sum + note.midi, 0) / notes.length;
  const name = `${track.name || ''} ${track.instrument?.name || ''}`;
  const nameBonus = /(melody|lead|vocal|voice|主旋律|メロディ)/i.test(name) ? 45 : 0;
  return monophony * 100
    + Math.min(notes.length, 120) * 0.2
    + Math.max(0, Math.min(averagePitch - 45, 35))
    + nameBonus;
}

function selectMelodyTrack(trackIndex) {
  const item = state.midiTracks.find(candidate => candidate.index === trackIndex);
  if (!item || !state.midiImport) return;

  const { ppq, sourceTempo, fileName } = state.midiImport;
  const track = item.track;
  const firstTick = Math.min(...track.notes.map(note => note.ticks));
  const notes = track.notes.map(note => {
    const durationBeats = Number.isFinite(note.durationTicks)
      ? note.durationTicks / ppq
      : Math.max(0.05, note.duration * sourceTempo / 60);
    return {
      midi: note.midi,
      beat: (note.ticks - firstTick) / ppq,
      durationBeats,
      velocity: note.velocity
    };
  });

  const trackName = track.name || track.instrument?.name || `Track ${trackIndex + 1}`;
  state.melody = { fileName, trackIndex, trackName, sourceTempo, notes };

  const durationBeats = Math.max(...notes.map(note => note.beat + note.durationBeats));
  const status = document.getElementById('melody-import-status');
  status.dataset.status = 'ready';
  status.textContent = `${trackName}：${notes.length}音 / 約${Math.ceil(durationBeats)}拍。ブラウザ内で解析済み。`;
  updateMelodyHeader();
}

function clearMelodyImport(resetStatus = true) {
  state.melody = null;
  state.midiTracks = [];
  state.midiImport = null;
  document.getElementById('input-melody-midi').value = '';
  document.getElementById('select-melody-track').innerHTML = '';
  document.getElementById('melody-track-row').style.display = 'none';
  if (resetStatus) {
    const status = document.getElementById('melody-import-status');
    status.dataset.status = '';
    status.textContent = 'MIDIなし：通常のMood生成を使います';
  }
  updateMelodyHeader();
}

function updateMelodyHeader() {
  const badge = document.getElementById('header-melody-badge');
  if (!badge) return;
  if (state.melody) {
    badge.style.display = '';
    badge.textContent = `🎤 ${state.melody.trackName} · ${state.melody.notes.length}音`;
  } else {
    badge.style.display = 'none';
    badge.textContent = '';
  }
}

function getSectionStartBeat(songData, sectionIndex) {
  const beatsPerMeasure = songData.timeSignature[0];
  return songData.sections.slice(0, sectionIndex)
    .reduce((sum, section) => sum + section.measures * beatsPerMeasure, 0);
}

function harmonizeSectionWithMelody(songData, sectionIndex) {
  const section = songData.sections[sectionIndex];
  if (!section) return;
  const result = chordEngine.harmonizeWithMelody(
    section.chords,
    state.melody?.notes || [],
    getSectionStartBeat(songData, sectionIndex),
    songData.chordDurationBeats,
    section.key,
    section.mode,
    section.image
  );
  section.chords = result.chords;
  section.harmonyInsights = result.insights;
}

function applyMelodyHarmony(songData) {
  songData.sections.forEach((section, index) => {
    harmonizeSectionWithMelody(songData, index);
  });
}

function getMelodyNotesForChord(sectionIndex, chordIndex) {
  if (!state.songData || !state.melody) return [];
  const startBeat = getSectionStartBeat(state.songData, sectionIndex)
    + chordIndex * state.songData.chordDurationBeats;
  const endBeat = startBeat + state.songData.chordDurationBeats;
  return state.melody.notes.filter(note => {
    const noteEnd = note.beat + Math.max(note.durationBeats || 0, 0.05);
    return note.beat < endBeat && noteEnd > startBeat;
  });
}

function generateAndRender() {
  const config = uiManager.getSongConfig();

  // Resolve auto keys/modes
  const hasAutoKey = config.sections.some(s => s.key === 'auto');
  const hasAutoMode = config.sections.some(s => s.mode === 'auto');

  if (hasAutoKey || hasAutoMode) {
    const autoKeys = chordEngine.autoSelectKeysForSong(config.sections);

    config.sections.forEach((sec, idx) => {
      if (sec.key === 'auto') sec.key = autoKeys[idx].key;
      if (sec.mode === 'auto') sec.mode = autoKeys[idx].mode;
    });
  }

  config.sections.forEach((sec, idx) => {
    const beatsPerMeasure = config.timeSignature[0];
    const chordsPerMeasure = beatsPerMeasure / config.chordDurationBeats;
    const numChords = Math.round(sec.measures * chordsPerMeasure);

    const nextSec = config.sections[idx + 1];
    let nextFirstChord = null;
    if (nextSec) {
      const nextKey = nextSec.key || sec.key;
      const nextMode = nextSec.mode || sec.mode;
      const nextDiatonic = chordEngine.getDiatonicChords(nextKey, nextMode);
      nextFirstChord = nextDiatonic[0];
    }

    sec.chords = chordEngine.generateProgression(
      sec.key, sec.mode, sec.type, sec.image, numChords, nextFirstChord
    );
  });

  applyMelodyHarmony(config);

  state.songData = config;
  uiManager.renderEditor(state.songData);
}

function regenerateChords() {
  state.songData.sections.forEach((sec, idx) => {
    const beatsPerMeasure = state.songData.timeSignature[0];
    const chordsPerMeasure = beatsPerMeasure / state.songData.chordDurationBeats;
    const numChords = Math.round(sec.measures * chordsPerMeasure);

    const nextSec = state.songData.sections[idx + 1];
    let nextFirstChord = null;
    if (nextSec) {
      const nextKey = nextSec.key || sec.key;
      const nextMode = nextSec.mode || sec.mode;
      const nextDiatonic = chordEngine.getDiatonicChords(nextKey, nextMode);
      nextFirstChord = nextDiatonic[0];
    }

    sec.chords = chordEngine.generateProgression(
      sec.key, sec.mode, sec.type, sec.image, numChords, nextFirstChord
    );
  });
  applyMelodyHarmony(state.songData);
  uiManager.renderEditor(state.songData);
  uiManager.hideSuggestionPanel();
}

function playFullSong() {
  if (!state.songData) {
    generateAndRender();
  }
  if (!state.songData || !state.songData.sections) return;
  audioManager.stopAll();
  const flatChords = [];
  state.songData.sections.forEach(sec => {
    if (sec.chords) {
      sec.chords.forEach(c => flatChords.push({ symbol: c }));
    }
  });
  if (!flatChords.length) return;

  state.isPlaying = true;
  state.stopPlayback = audioManager.playProgression(
    flatChords,
    state.songData.tempo,
    state.songData.chordDurationBeats,
    (idx) => {
      if (idx === -1) {
        // Playback ended
        stopPlayback();
      } else {
        uiManager.updatePlayhead(idx);
      }
    }
  );
}

function stopPlayback() {
  audioManager.stopAll();
  state.isPlaying = false;
  state.stopPlayback = null;
  uiManager.clearPlayhead();
}

function buildExportData() {
  return {
    title: 'Chordly Export',
    tempo: state.songData.tempo,
    timeSignature: state.songData.timeSignature,
    chordDurationBeats: state.songData.chordDurationBeats,
    sections: state.songData.sections.map(sec => ({
      name: chordEngine.sectionNames[sec.type] || sec.type,
      key: sec.key,
      mode: sec.mode,
      chords: sec.chords,
    }))
  };
}

function buildChordChartText() {
  const { tempo, timeSignature, chordDurationBeats, sections } = state.songData;
  const lines = [
    'Chordly コード進行',
    `BPM: ${tempo} | 拍子: ${timeSignature.join('/')} | コード幅: ${chordDurationBeats}拍`,
    state.melody ? `主メロ: ${state.melody.fileName} / ${state.melody.trackName}` : '主メロ: なし',
    ''
  ];

  sections.forEach(section => {
    const sectionName = chordEngine.sectionNames[section.type] || section.type;
    const mode = section.mode === 'minor' ? 'Minor' : 'Major';
    lines.push(`[${sectionName} | ${section.key} ${mode}]`);
    lines.push(section.chords.join('  |  '));
    lines.push('');
  });

  return lines.join('\n');
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
