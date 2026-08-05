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

    // Mobile Web Audio Buffer Fix: Set latencyHint to 'playback' and lookAhead to 0.1s.
    Tone.setContext(new Tone.Context({
      latencyHint: 'playback',
      lookAhead: 0.1
    }));

    await Tone.start();

    // Rich, warm Electric Piano / Rhodes tone using FM Synthesis
    this.synth = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3,
      modulationIndex: 2.5,
      oscillator: { type: 'sine' },
      envelope: {
        attack: 0.008,
        decay: 0.8,
        sustain: 0.25,
        release: 1.2
      },
      modulation: { type: 'triangle' },
      modulationEnvelope: {
        attack: 0.005,
        decay: 0.2,
        sustain: 0.01,
        release: 0.5
      }
    }).toDestination();
    this.synth.volume.value = -10;

    this.isInitialized = true;
    console.log('[AudioManager] Initialized with FM Electric Piano sound');
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

  /**
   * Play full progression with playhead tracking.
   * Leverages Tone.Transport for clean playback cancellation on Stop.
   */
  playProgression(allChords, bpm, beatsPerChord, onChordPlay) {
    if (!this.isInitialized) return () => {};
    this.stopAll();

    this.isPlaying = true;
    const secPerBeat = 60 / bpm;
    const secPerChord = secPerBeat * beatsPerChord;

    allChords.forEach((chordData, idx) => {
      const notes = chordEngine.getChordMidi(chordData.symbol);
      const freqs = notes.map(m => Tone.Frequency(m, 'midi').toFrequency());
      const chordTime = idx * secPerChord;

      // 1. Schedule chord sound
      const eventId = Tone.Transport.schedule(t => {
        this.synth.triggerAttackRelease(freqs, secPerChord * 0.9, t);
      }, chordTime);
      this.scheduledEvents.push(eventId);

      // 2. Schedule UI playhead update
      if (onChordPlay) {
        const uiId = Tone.Transport.schedule(t => {
          Tone.Draw.schedule(() => {
            if (this.isPlaying && !document.hidden) onChordPlay(idx);
          }, t);
        }, chordTime);
        this.scheduledEvents.push(uiId);
      }
    });

    // Schedule End
    const totalDuration = allChords.length * secPerChord;
    const endId = Tone.Transport.schedule(t => {
      this.isPlaying = false;
      Tone.Draw.schedule(() => {
        if (onChordPlay && !document.hidden) onChordPlay(-1);
      }, t);
      this.stopAll();
    }, totalDuration);
    this.scheduledEvents.push(endId);

    Tone.Transport.bpm.value = bpm;
    Tone.Transport.start();

    const stopFn = () => this.stopAll();
    this.currentStopFn = stopFn;
    return stopFn;
  }

  /** Stop all playback immediately and clear all scheduled events */
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
