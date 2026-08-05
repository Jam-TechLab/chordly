/**
 * Chordly — UI Manager
 * Handles all DOM manipulation, event binding, and visual state management.
 */

class UIManager {
  constructor() {
    // DOM references (set after DOMContentLoaded)
    this.audioOverlay = null;
    this.setupModal = null;
    this.mainEditor = null;
    this.editorCanvas = null;
    this.suggestionPanel = null;
    this.exportModal = null;
    this.setupSections = null;
  }

  /** Initialize DOM references */
  initDom() {
    this.audioOverlay = document.getElementById('audio-overlay');
    this.setupModal = document.getElementById('setup-modal');
    this.mainEditor = document.getElementById('main-editor');
    this.editorCanvas = document.getElementById('editor-canvas');
    this.suggestionPanel = document.getElementById('suggestion-panel');
    this.exportModal = document.getElementById('export-modal');
    this.setupSections = document.getElementById('setup-sections');
  }

  /** Show the setup modal */
  showSetup(isEditing = false) {
    this.audioOverlay.classList.remove('open');
    this.setupModal.classList.add('open');
    this.mainEditor.style.display = 'none';

    const cancelHeader = document.getElementById('btn-cancel-setup');
    const cancelFooter = document.getElementById('btn-cancel-setup-footer');

    if (isEditing) {
      if (cancelHeader) cancelHeader.style.display = '';
      if (cancelFooter) cancelFooter.style.display = '';
    } else {
      if (cancelHeader) cancelHeader.style.display = 'none';
      if (cancelFooter) cancelFooter.style.display = 'none';

      // Add default sections if empty
      if (this.setupSections.children.length === 0) {
        this.addSection('intro', 'auto', 'auto', 'calm', 4);
        this.addSection('verse', 'auto', 'auto', 'pop', 8);
        this.addSection('bridge', 'auto', 'auto', 'emotional', 8);
        this.addSection('chorus', 'auto', 'auto', 'bright', 8);
        this.addSection('outro', 'auto', 'auto', 'beautiful', 4);
      }
    }
  }

  /** Hide setup modal and return to editor */
  hideSetup() {
    this.setupModal.classList.remove('open');
    this.mainEditor.style.display = '';
  }

  /** Populate setup modal from current songData when editing */
  populateSetupFromSong(songData) {
    if (!songData) return;
    const tempoInput = document.getElementById('input-tempo');
    if (tempoInput) tempoInput.value = songData.tempo;

    const widthSelect = document.getElementById('input-chord-width');
    if (widthSelect) widthSelect.value = songData.chordDurationBeats;

    this.setupSections.innerHTML = '';
    songData.sections.forEach(sec => {
      this.addSection(sec.type, sec.key, sec.mode, sec.image, sec.measures);
    });
  }

  /** Add a section row to the setup modal */
  addSection(type = 'verse', key = 'auto', mode = 'auto', image = 'bright', measures = 4) {
    const template = document.getElementById('section-setup-template');
    const clone = template.content.cloneNode(true);
    const row = clone.querySelector('.section-setup-row');

    row.querySelector('.select-section-type').value = type;
    row.querySelector('.select-key').value = key;
    row.querySelector('.select-mode').value = mode;
    row.querySelector('.select-image').value = image;
    row.querySelector('.input-measures').value = measures;

    // Remove button handler
    row.querySelector('.btn-remove-section').addEventListener('click', () => {
      if (this.setupSections.children.length > 1) {
        row.remove();
      }
    });

    this.setupSections.appendChild(row);
  }

  /** Get song configuration from setup modal */
  getSongConfig() {
    const tempoInput = document.getElementById('input-tempo');
    const autoTempo = document.getElementById('chk-tempo-auto');
    const chordWidth = parseInt(document.getElementById('input-chord-width').value);

    const sections = [];
    this.setupSections.querySelectorAll('.section-setup-row').forEach(row => {
      const image = row.querySelector('.select-image').value;
      sections.push({
        type: row.querySelector('.select-section-type').value,
        key: row.querySelector('.select-key').value,
        mode: row.querySelector('.select-mode').value,
        image: image,
        measures: parseInt(row.querySelector('.input-measures').value) || 4,
      });
    });

    // Determine tempo
    let tempo;
    if (autoTempo.checked) {
      // Use the first section's image to determine tempo with randomness
      const mainImage = sections.length > 0 ? sections[0].image : 'bright';
      tempo = chordEngine.getAutoTempo(mainImage);
      tempoInput.value = tempo;
    } else {
      tempo = parseInt(tempoInput.value) || 120;
    }

    return { tempo, chordDurationBeats: chordWidth, timeSignature: [4, 4], sections };
  }

  /** Render the main editor with song data */
  renderEditor(songData) {
    this.setupModal.classList.remove('open');
    this.mainEditor.style.display = '';
    this.editorCanvas.innerHTML = '';

    // Update header controls values
    const bpmInput = document.getElementById('header-bpm');
    if (bpmInput && document.activeElement !== bpmInput) {
      bpmInput.value = songData.tempo;
    }
    const tsSelect = document.getElementById('header-timesig');
    if (tsSelect) {
      tsSelect.value = songData.timeSignature.join('/');
    }
    const widthSelect = document.getElementById('header-chord-width');
    if (widthSelect) {
      widthSelect.value = songData.chordDurationBeats;
    }

    const keyDisplayMap = {
      'C':'C','C#':'C#','D':'D','Eb':'E♭','E':'E','F':'F',
      'F#':'F#','G':'G','Ab':'A♭','A':'A','Bb':'B♭','B':'B'
    };
    const keyOptions = Object.keys(keyDisplayMap)
      .map(k => `<option value="${k}">${keyDisplayMap[k]}</option>`).join('');

    const moodOptions = Object.entries(chordEngine.moods)
      .map(([k, m]) => `<option value="${k}">${m.label}</option>`).join('');

    songData.sections.forEach((section, sIdx) => {
      const sectionDiv = document.createElement('div');
      sectionDiv.className = 'song-section';
      sectionDiv.dataset.sectionIdx = sIdx;

      const sectionName = chordEngine.sectionNames[section.type] || section.type;

      // Section header with live controls
      const headerDiv = document.createElement('div');
      headerDiv.className = 'section-header';
      headerDiv.dataset.image = section.image;

      headerDiv.innerHTML = `
        <div class="section-title-group">
          <h3>${sectionName}</h3>
          <button class="btn-play-section btn-icon" title="このセクションを再生">▶</button>
        </div>
        <div class="section-controls-group">
          <select class="section-live-key section-control-select" title="キー">
            ${keyOptions}
          </select>
          <select class="section-live-mode section-control-select" title="モード">
            <option value="major">Major</option>
            <option value="minor">Minor</option>
          </select>
          <select class="section-live-image section-control-select" title="イメージ">
            ${moodOptions}
          </select>
        </div>
      `;

      const keySelect = headerDiv.querySelector('.section-live-key');
      const modeSelect = headerDiv.querySelector('.section-live-mode');
      const imageSelect = headerDiv.querySelector('.section-live-image');
      const playBtn = headerDiv.querySelector('.btn-play-section');

      keySelect.value = section.key;
      modeSelect.value = section.mode;
      imageSelect.value = section.image;

      const onParamChange = () => {
        this._onSectionParamChange(
          sIdx, keySelect.value, modeSelect.value, imageSelect.value
        );
      };

      keySelect.addEventListener('change', onParamChange);
      modeSelect.addEventListener('change', onParamChange);
      imageSelect.addEventListener('change', onParamChange);

      playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._playSectionFrom(songData, sIdx);
      });

      sectionDiv.appendChild(headerDiv);

      // Chord track
      const trackDiv = document.createElement('div');
      trackDiv.className = 'chord-track';

      const beatsPerMeasure = songData.timeSignature[0];
      const chordsPerMeasure = beatsPerMeasure / songData.chordDurationBeats;

      section.chords.forEach((chord, cIdx) => {
        if (cIdx > 0 && cIdx % chordsPerMeasure === 0) {
          const sep = document.createElement('div');
          sep.className = 'measure-sep';
          trackDiv.appendChild(sep);
        }

        const block = document.createElement('div');
        block.className = 'chord-block';
        block.dataset.sectionIdx = sIdx;
        block.dataset.chordIdx = cIdx;
        block.innerHTML = `<span class="chord-symbol">${chordEngine.formatChordForDisplay(chord)}</span>`;
        trackDiv.appendChild(block);
      });

      sectionDiv.appendChild(trackDiv);
      this.editorCanvas.appendChild(sectionDiv);
    });
  }

  /** Section live parameter change handler (overridden by app.js) */
  _onSectionParamChange(sIdx, key, mode, image) {
    // Overridden in app.js
  }

  /** Play from a specific section */
  _playSectionFrom(songData, fromSectionIdx) {
    const flatChords = [];
    songData.sections.forEach((sec, sIdx) => {
      if (sIdx >= fromSectionIdx) {
        sec.chords.forEach(c => flatChords.push({ symbol: c, sectionIdx: sIdx }));
      }
    });

    if (flatChords.length === 0) return;

    // Calculate the flat index offset
    let offset = 0;
    for (let i = 0; i < fromSectionIdx; i++) {
      offset += songData.sections[i].chords.length;
    }

    audioManager.playProgression(flatChords, songData.tempo, songData.chordDurationBeats, (idx) => {
      if (idx === -1) {
        this.clearPlayhead();
      } else {
        this.updatePlayhead(offset + idx);
      }
    });
  }

  /** Show suggestion panel with candidates for a single block */
  showSuggestionPanel(suggestions, currentChord, sIdx, cIdx) {
    this.suggestionPanel.classList.add('open');
    document.querySelector('.main-area').classList.add('panel-open');

    document.getElementById('suggestion-title').textContent =
      `💡 「${currentChord}」の代わりに...`;

    // Set active tab and render
    const tabs = this.suggestionPanel.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
      tab.classList.remove('active');
      tab.onclick = () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this._renderSuggestions(suggestions, tab.dataset.category, sIdx, cIdx);
      };
    });

    // Activate first tab
    tabs[0].classList.add('active');
    this._renderSuggestions(suggestions, tabs[0].dataset.category, sIdx, cIdx);
  }

  /** Render suggestion cards for a category */
  _renderSuggestions(suggestions, category, sIdx, cIdx) {
    const container = document.getElementById('suggestion-content');
    container.innerHTML = '';

    const items = suggestions[category] || [];
    if (items.length === 0) {
      container.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:20px;">候補がありません</p>';
      return;
    }

    items.forEach(item => {
      const card = document.createElement('div');
      card.className = `suggestion-card ${category}`;
      card.dataset.symbol = item.symbol;
      card.dataset.sectionIdx = sIdx;
      card.dataset.chordIdx = cIdx;

      // Score display
      const scoreLabel = item.score >= 0.8 ? '◉ スムーズ' :
                         item.score >= 0.6 ? '◎ 自然' : '○ やや跳躍';

      card.innerHTML = `
        <span class="suggestion-chord">${chordEngine.formatChordForDisplay(item.symbol)}</span>
        <span class="suggestion-score">${scoreLabel}</span>
      `;

      // Hover → preview
      card.addEventListener('mouseenter', () => {
        audioManager.playChordPreview(item.notes);
      });

      // Click → apply
      card.addEventListener('click', () => {
        this._onSuggestionApply(item.symbol, sIdx, cIdx);
      });

      container.appendChild(card);
    });
  }

  /** Apply a single suggestion (overridden by app.js) */
  _onSuggestionApply(symbol, sIdx, cIdx) {
    // Will be overridden
  }

  /** Show suggestion panel for a range selection */
  showRangeSuggestionPanel(rangeSuggestions, sIdx, startIdx, endIdx) {
    const rangeLength = endIdx - startIdx + 1;
    this.suggestionPanel.classList.add('open');
    document.querySelector('.main-area').classList.add('panel-open');

    document.getElementById('suggestion-title').textContent =
      `💡 選択範囲（${rangeLength}コード）の置換フレーズ候補`;

    const tabs = this.suggestionPanel.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
      tab.classList.remove('active');
      tab.onclick = () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this._renderRangeSuggestions(rangeSuggestions, tab.dataset.category, sIdx, startIdx, endIdx);
      };
    });

    tabs[0].classList.add('active');
    this._renderRangeSuggestions(rangeSuggestions, tabs[0].dataset.category, sIdx, startIdx, endIdx);
  }

  /** Render multi-chord phrase cards for range substitution */
  _renderRangeSuggestions(rangeSuggestions, category, sIdx, startIdx, endIdx) {
    const container = document.getElementById('suggestion-content');
    container.innerHTML = '';

    const items = rangeSuggestions[category] || [];
    if (items.length === 0) {
      container.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:20px;">範囲候補がありません</p>';
      return;
    }

    items.forEach(item => {
      const card = document.createElement('div');
      card.className = `suggestion-card ${category}`;
      card.style.minWidth = '160px';

      const phraseStr = item.chords.map(c => chordEngine.formatChordForDisplay(c)).join(' → ');
      const scoreLabel = item.score >= 0.8 ? '◉ スムーズ' : '◎ 自然';

      card.innerHTML = `
        <div class="suggestion-phrase-name" style="font-weight:600;font-size:0.82rem;color:var(--accent-primary);margin-bottom:4px;">${item.name || '定番フレーズ'}</div>
        <span class="suggestion-chord" style="font-size:0.95rem;">${phraseStr}</span>
        <span class="suggestion-score">${scoreLabel}</span>
      `;

      // Hover → preview multi-chord phrase
      card.addEventListener('mouseenter', () => {
        audioManager.playMoodPreview(item.chords);
      });

      // Click → apply range substitution
      card.addEventListener('click', () => {
        this._onRangeSuggestionApply(item.chords, sIdx, startIdx, endIdx);
      });

      container.appendChild(card);
    });
  }

  /** Apply range substitution (overridden by app.js) */
  _onRangeSuggestionApply(newChords, sIdx, startIdx, endIdx) {
    // Will be overridden
  }

  /** Hide suggestion panel */
  hideSuggestionPanel() {
    this.suggestionPanel.classList.remove('open');
    document.querySelector('.main-area').classList.remove('panel-open');
  }

  /** Update playhead to highlight a specific chord block */
  updatePlayhead(flatIndex) {
    if (document.hidden) return;

    const blocks = document.querySelectorAll('.chord-block');
    blocks.forEach((el, i) => {
      if (i === flatIndex) {
        el.classList.add('playing');
        // Scroll into view
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        el.classList.remove('playing');
      }
    });
  }

  /** Clear all playhead highlights */
  clearPlayhead() {
    document.querySelectorAll('.chord-block').forEach(el =>
      el.classList.remove('playing')
    );
  }

  /** Clear selection highlights */
  clearSelection() {
    document.querySelectorAll('.chord-block').forEach(el => {
      el.classList.remove('selected');
      el.classList.remove('range-selected');
    });
  }

  /** Show export modal */
  showExportModal() {
    this.exportModal.classList.add('open');
    // Reset progress
    document.getElementById('export-progress').style.display = 'none';
    document.getElementById('export-progress-fill').style.width = '0%';
  }

  /** Hide export modal */
  hideExportModal() {
    this.exportModal.classList.remove('open');
  }

  /** Update export progress */
  updateExportProgress(percent, status) {
    const prog = document.getElementById('export-progress');
    prog.style.display = '';
    document.getElementById('export-progress-fill').style.width = percent + '%';
    if (status) document.getElementById('export-status').textContent = status;
  }
}

// Global instance
const uiManager = new UIManager();
