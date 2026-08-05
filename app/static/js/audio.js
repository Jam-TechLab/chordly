/**
 * Chordly — Audio Manager
 * Handles all audio playback using Tone.js and WAV export via OfflineAudioContext.
 */

class AudioManager {
  constructor() {
    this.synth = null;
    this.isInitialized = false;
    this.isPlaying = false;
    this.isMetronomeEnabled = false; // Default OFF to ensure 100% noise-free playback on mobile
    this.scheduledEvents = [];
    this.currentStopFn = null;
  }

  /** Initialize Tone.js — must be called after a user gesture */
  async init() {
    if (this.isInitialized) return;
    await Tone.start();
    if (Tone.context.state !== 'running') {
      await Tone.context.resume();
    }

    // Bright, rich Piano PolySynth
    this.synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: {
        attack: 0.01,
        decay: 0.4,
        sustain: 0.35,
        release: 1.2
      }
    }).toDestination();
    this.synth.volume.value = -8;

    // Crisp, prominent Beat Metronome Synth (Woodblock / Rimshot sound)
    this.clickSynth = new Tone.MembraneSynth({
      pitchDecay: 0.005,
      octaves: 2,
      envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.03 }
    }).toDestination();
    this.clickSynth.volume.value = -6; // Prominent, clear beat volume!

    this.isInitialized = true;
    console.log('[AudioManager] Initialized successfully');
  }

  /** Play a chord (array of MIDI note numbers) */
  playChord(midiNotes, duration = 0.8) {
    if (!this.isInitialized || !midiNotes.length) return;
    if (Tone.context.state !== 'running') Tone.context.resume();
    const freqs = midiNotes.map(m => Tone.Frequency(m, 'midi').toFrequency());
    this.synth.triggerAttackRelease(freqs, duration);
  }

  /** Play a short preview of a chord (for hover) */
  playChordPreview(midiNotes) {
    if (!this.isInitialized || !midiNotes.length) return;
    if (Tone.context.state !== 'running') Tone.context.resume();
    const freqs = midiNotes.map(m => Tone.Frequency(m, 'midi').toFrequency());
    const prevVol = this.synth.volume.value;
    this.synth.volume.value = -16;
    this.synth.triggerAttackRelease(freqs, 0.25);
    setTimeout(() => { this.synth.volume.value = prevVol; }, 300);
  }

  /** Play a sequence of chords for mood preview */
  playMoodPreview(chordSymbols) {
    if (!this.isInitialized) return;
    if (Tone.context.state !== 'running') Tone.context.resume();
    chordSymbols.forEach((sym, i) => {
      const notes = chordEngine.getChordMidi(sym);
      const freqs = notes.map(m => Tone.Frequency(m, 'midi').toFrequency());
      setTimeout(() => {
        this.synth.triggerAttackRelease(freqs, 0.5);
      }, i * 500);
    });
  }

  /**
   * Play full progression with playhead tracking.
   * Direct WebAudio hardware scheduling via Tone.now() — 100% reliable across all devices.
   */
  async playProgression(allChords, bpm, beatsPerChord, onChordPlay) {
    if (!this.isInitialized) await this.init();
    if (Tone.context.state !== 'running') {
      await Tone.context.resume();
    }
    this.stopAll();

    this.isPlaying = true;
    const secPerBeat = 60 / bpm;
    const secPerChord = secPerBeat * beatsPerChord;

    // WebAudio direct hardware timeline start
    const startTime = Tone.now() + 0.05;

    allChords.forEach((chordData, idx) => {
      const notes = chordEngine.getChordMidi(chordData.symbol);
      const freqs = notes.map(m => Tone.Frequency(m, 'midi').toFrequency());
      const chordTime = startTime + idx * secPerChord;

      // 1. Direct WebAudio hardware synth trigger (ALWAYS PLAYS 100% RELIABLY)
      this.synth.triggerAttackRelease(freqs, secPerChord * 0.9, chordTime);

      // 2. Direct WebAudio hardware metronome trigger (if enabled)
      if (this.isMetronomeEnabled && this.clickSynth) {
        for (let b = 0; b < beatsPerChord; b++) {
          const beatTime = chordTime + b * secPerBeat;
          const pitch = (b === 0) ? 'G5' : 'C5';
          this.clickSynth.triggerAttackRelease(pitch, '32n', beatTime);
        }
      }

      // 3. UI Playhead tracking (pure JS visual indicator)
      if (onChordPlay) {
        const timerId = setTimeout(() => {
          if (this.isPlaying && !document.hidden) onChordPlay(idx);
        }, (idx * secPerChord) * 1000);
        this.scheduledEvents.push(timerId);
      }
    });

    // Schedule End
    const totalDuration = allChords.length * secPerChord;
    const endTimerId = setTimeout(() => {
      this.isPlaying = false;
      if (onChordPlay && !document.hidden) onChordPlay(-1);
    }, totalDuration * 1000);
    this.scheduledEvents.push(endTimerId);

    const stopFn = () => this.stopAll();
    this.currentStopFn = stopFn;
    return stopFn;
  }

  /** Stop all playback immediately */
  stopAll() {
    this.scheduledEvents.forEach(id => clearTimeout(id));
    this.scheduledEvents = [];
    if (this.synth) this.synth.releaseAll();
    if (this.clickSynth) this.clickSynth.releaseAll();
    this.isPlaying = false;
  }

  /**
   * Render the full progression to a WAV blob.
   * Uses OfflineAudioContext for offline rendering.
   */
  async renderToWav(allChords, bpm, beatsPerChord, onProgress) {
    const secPerChord = (60 / bpm) * beatsPerChord;
    const totalDuration = allChords.length * secPerChord + 2; // +2s for release tail
    const sampleRate = 44100;
    const numSamples = Math.ceil(totalDuration * sampleRate);

    const offlineCtx = new OfflineAudioContext(2, numSamples, sampleRate);

    // Create oscillator-based piano chords
    allChords.forEach((chordData, idx) => {
      const notes = chordEngine.getChordMidi(chordData.symbol);
      const startTime = idx * secPerChord;
      const noteDur = secPerChord * 0.9;

      notes.forEach(midiNote => {
        const freq = 440 * Math.pow(2, (midiNote - 69) / 12);

        const osc = offlineCtx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;

        const gain = offlineCtx.createGain();
        const noteGain = 0.15 / notes.length; // normalize volume
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(noteGain, startTime + 0.01);
        gain.gain.setValueAtTime(noteGain, startTime + noteDur * 0.7);
        gain.gain.linearRampToValueAtTime(0, startTime + noteDur + 0.5);

        osc.connect(gain);
        gain.connect(offlineCtx.destination);

        osc.start(startTime);
        osc.stop(startTime + noteDur + 1);
      });

      if (onProgress) {
        // Approximate progress
        onProgress(Math.round((idx / allChords.length) * 80));
      }
    });

    if (onProgress) onProgress(85);

    // Render
    const audioBuffer = await offlineCtx.startRendering();
    if (onProgress) onProgress(95);

    // Convert AudioBuffer to WAV Blob
    const wavBlob = this._audioBufferToWav(audioBuffer);
    if (onProgress) onProgress(100);

    return wavBlob;
  }

  /** Convert AudioBuffer to WAV Blob */
  _audioBufferToWav(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitsPerSample = 16;

    const channelData = [];
    for (let ch = 0; ch < numChannels; ch++) {
      channelData.push(buffer.getChannelData(ch));
    }

    const numSamples = channelData[0].length;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = numSamples * blockAlign;
    const headerSize = 44;

    const arrayBuffer = new ArrayBuffer(headerSize + dataSize);
    const view = new DataView(arrayBuffer);

    // WAV header
    this._writeString(view, 0, 'RIFF');
    view.setUint32(4, headerSize + dataSize - 8, true);
    this._writeString(view, 8, 'WAVE');
    this._writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    this._writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // Write interleaved samples
    let offset = headerSize;
    for (let i = 0; i < numSamples; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        let sample = channelData[ch][i];
        sample = Math.max(-1, Math.min(1, sample));
        const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        view.setInt16(offset, intSample, true);
        offset += 2;
      }
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }

  _writeString(view, offset, str) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }
}

// Global instance
const audioManager = new AudioManager();
