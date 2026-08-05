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

  // Tempo change → metronome feedback
  document.getElementById('input-tempo').addEventListener('change', (e) => {
    const bpm = parseInt(e.target.value);
    if (bpm > 0) audioManager.playMetronome(bpm);
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
        if (state.isPlaying) Tone.Transport.bpm.value = newBpm;
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

    const suggestions = chordEngine.getSuggestions(
      symbol, prevChord, nextChord, section.key, section.mode
    );

    uiManager.showSuggestionPanel(suggestions, symbol, sIdx, cIdx);
  });

  // Override single suggestion apply handler
  uiManager._onSuggestionApply = (newSymbol, sIdx, cIdx) => {
    state.songData.sections[sIdx].chords[cIdx] = newSymbol;
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
