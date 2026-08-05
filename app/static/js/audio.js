/**
 * Chordly — Audio Manager
 * Handles all audio playback using Tone.js and WAV export via OfflineAudioContext.
 */

class AudioManager {
  constructor() {
    this.synth = null;
    this.isInitialized = false;
    this.isPlaying = false;
    this.scheduledEvents = [];
    this.currentStopFn = null;
  }

  /** Initialize Tone.js — must be called after a user gesture */
  async init() {
    if (this.isInitialized) return;
    await Tone.start();

    // Master Limiter to prevent digital clipping
    this.limiter = new Tone.Limiter(-2).toDestination();

    // Piano-like PolySynth
    this.synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: {
        attack: 0.01,
        decay: 0.4,
        sustain: 0.3,
        release: 1.0
      }
    }).connect(this.limiter);
    this.synth.volume.value = -10;

    // Click synth for metronome
    this.clickSynth = new Tone.MembraneSynth({
      pitchDecay: 0.008,
      octaves: 4,
      envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.05 }
    }).connect(this.limiter);
    this.clickSynth.volume.value = -16;

    this.isInitialized = true;
    console.log('[AudioManager] Initialized');
  }

  /** Play a chord (array of MIDI note numbers) */
  playChord(midiNotes, duration = 0.8) {
    if (!this.isInitialized || !midiNotes.length) return;
    const freqs = midiNotes.map(m => Tone.Frequency(m, 'midi').toFrequency());
    this.synth.triggerAttackRelease(freqs, duration);
  }

  /** Play a short preview of a chord (for hover) */
  playChordPreview(midiNotes) {
    if (!this.isInitialized || !midiNotes.length) return;
    const freqs = midiNotes.map(m => Tone.Frequency(m, 'midi').toFrequency());
    const prevVol = this.synth.volume.value;
    this.synth.volume.value = -16;
    this.synth.triggerAttackRelease(freqs, 0.25);
    setTimeout(() => { this.synth.volume.value = prevVol; }, 300);
  }

  /** Play a sequence of chords for mood preview */
  playMoodPreview(chordSymbols) {
    if (!this.isInitialized) return;
    chordSymbols.forEach((sym, i) => {
      const notes = chordEngine.getChordMidi(sym);
      const freqs = notes.map(m => Tone.Frequency(m, 'midi').toFrequency());
      setTimeout(() => {
        this.synth.triggerAttackRelease(freqs, 0.5);
      }, i * 500);
    });
  }

  /** Play metronome clicks at given BPM */
  playMetronome(bpm, beats = 2) {
    if (!this.isInitialized) return;
    const secPerBeat = 60 / bpm;
    for (let i = 0; i < beats; i++) {
      this.clickSynth.triggerAttackRelease('C2', '16n', Tone.now() + i * secPerBeat);
    }
  }

  /**
   * Play full progression with playhead tracking and beat clicks.
   * Guarded against background tab CPU throttling on mobile browsers.
   */
  playProgression(allChords, bpm, beatsPerChord, onChordPlay) {
    if (!this.isInitialized) return () => {};
    this.stopAll();

    this.isPlaying = true;
    const secPerBeat = 60 / bpm;
    const secPerChord = secPerBeat * beatsPerChord;

    // Schedule each chord
    allChords.forEach((chordData, idx) => {
      const notes = chordEngine.getChordMidi(chordData.symbol);
      const freqs = notes.map(m => Tone.Frequency(m, 'midi').toFrequency());
      const chordTime = idx * secPerChord;

      // Schedule audio synthesis on Web Audio timeline
      Tone.Transport.schedule(t => {
        this.synth.triggerAttackRelease(freqs, secPerChord * 0.9, t);
      }, chordTime);

      // Schedule UI playhead update safely (skip DOM when tab is hidden)
      if (onChordPlay) {
        Tone.Transport.schedule(t => {
          Tone.Draw.schedule(() => {
            if (!document.hidden) onChordPlay(idx);
          }, t);
        }, chordTime);
      }

      // Schedule beat clicks
      for (let b = 0; b < beatsPerChord; b++) {
        const beatTime = chordTime + b * secPerBeat;
        const pitch = (b % 2 === 0) ? 'C2' : 'C3';
        Tone.Transport.schedule(t => {
          this.clickSynth.triggerAttackRelease(pitch, '32n', t);
        }, beatTime);
      }
    });

    // Schedule end
    const totalDuration = allChords.length * secPerChord;
    Tone.Transport.schedule(t => {
      this.isPlaying = false;
      Tone.Draw.schedule(() => {
        if (onChordPlay) onChordPlay(-1);
      }, t);
      this.stopAll();
    }, totalDuration);

    Tone.Transport.bpm.value = bpm;
    Tone.Transport.start();

    const stopFn = () => this.stopAll();
    this.currentStopFn = stopFn;
    return stopFn;
  }

  /** Stop all playback */
  stopAll() {
    this.scheduledEvents.forEach(id => Tone.Transport.clear(id));
    this.scheduledEvents = [];
    Tone.Transport.stop();
    Tone.Transport.cancel();
    if (this.synth) this.synth.releaseAll();
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
