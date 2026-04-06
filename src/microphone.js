// src/microphone.js — microphone pitch detection

/**
 * Initialises microphone input and wires up note callbacks.
 * Interface mirrors midi.js: same onNoteOn / onNoteOff / onStatusChange signature.
 *
 * @param {(midi: number, velocity: number) => void} onNoteOn
 * @param {(midi: number) => void}                   onNoteOff
 * @param {(status: string | null) => void}          onStatusChange  — null on clean stop
 * @returns {{ stop: () => void }}
 */
function initMic(onNoteOn, onNoteOff, onStatusChange) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    onStatusChange('Mic: not supported');
    return { stop: () => {} };
  }

  let stream      = null;
  let audioCtx    = null;
  let analyser    = null;
  let rafId       = null;
  let lastNote    = null;   // last midi number passed to onNoteOn, or null
  let stableNote  = null;   // candidate note accumulating stability frames
  let stableCount = 0;      // consecutive frames agreeing on stableNote

  const FFT_SIZE            = 2048;
  const AMPLITUDE_THRESHOLD = 0.01;  // RMS below this → treat as silence
  const STABILITY_FRAMES    = 3;     // consecutive matching frames before note-on

  // Pre-allocated time-domain buffer — reused every animation frame
  const timeDomain = new Float32Array(FFT_SIZE);

  navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    .then(s => {
      stream   = s;
      audioCtx = new AudioContext();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      audioCtx.createMediaStreamSource(s).connect(analyser);
      onStatusChange('Mic: listening');
      loop();
    })
    .catch(err => {
      const msg = err.name === 'NotAllowedError'
        ? 'Mic: access denied'
        : 'Mic: unavailable';
      onStatusChange(msg);
    });

  function loop() {
    rafId = requestAnimationFrame(loop);
    analyser.getFloatTimeDomainData(timeDomain);

    // RMS amplitude — silence check
    let rmsSum = 0;
    for (let i = 0; i < FFT_SIZE; i++) rmsSum += timeDomain[i] * timeDomain[i];
    const rms = Math.sqrt(rmsSum / FFT_SIZE);

    if (rms < AMPLITUDE_THRESHOLD) {
      if (lastNote !== null) {
        onNoteOff(lastNote);
        lastNote = null;
      }
      stableNote  = null;
      stableCount = 0;
      return;
    }

    const freq = autoCorrelate(timeDomain, audioCtx.sampleRate);
    if (freq === -1) return;

    const midi = Math.round(69 + 12 * Math.log2(freq / 440));
    if (midi < 36 || midi > 96) return;  // outside keyboard range

    // Stability debounce: require STABILITY_FRAMES consecutive matching frames
    if (midi === stableNote) {
      stableCount++;
    } else {
      stableNote  = midi;
      stableCount = 1;
    }

    if (stableCount >= STABILITY_FRAMES && midi !== lastNote) {
      if (lastNote !== null) onNoteOff(lastNote);
      onNoteOn(midi, 80);
      lastNote = midi;
    }
  }

  /**
   * Autocorrelation pitch detection.
   * Searches only lags corresponding to MIDI 36–96 (C2 ≈ 65 Hz to C7 ≈ 2093 Hz).
   * Returns the detected frequency in Hz, or -1 if no clear pitch is found.
   */
  function autoCorrelate(buf, sampleRate) {
    // Lag bounds for the piano keyboard range shown on screen
    const minLag = Math.floor(sampleRate / 2100);  // ≈ 21 samples @ 44100 Hz
    const maxLag = Math.ceil(sampleRate / 60);      // ≈ 735 samples @ 44100 Hz
    const SIZE   = buf.length;

    // Compute unnormalised autocorrelation for each lag in range
    const corr = new Float32Array(maxLag + 1);
    for (let lag = minLag; lag <= maxLag; lag++) {
      let s = 0;
      const n = SIZE - lag;
      for (let i = 0; i < n; i++) s += buf[i] * buf[i + lag];
      corr[lag] = s / n;
    }

    // Global max — used as normalisation reference for the peak threshold
    let maxCorr = 0;
    for (let lag = minLag; lag <= maxLag; lag++) {
      if (corr[lag] > maxCorr) maxCorr = corr[lag];
    }
    if (maxCorr < 0.01) return -1;  // signal too weak to pitch-detect

    // First local maximum ≥ 50 % of the global max → fundamental period.
    // Searching from minLag upward means we prefer the highest frequency
    // (shortest period = fundamental) rather than a harmonic alias.
    for (let lag = minLag + 1; lag < maxLag; lag++) {
      if (
        corr[lag] >  corr[lag - 1] &&
        corr[lag] >= corr[lag + 1] &&
        corr[lag] >= maxCorr * 0.5
      ) {
        // Parabolic interpolation for sub-sample period accuracy
        const a = corr[lag - 1], b = corr[lag], c = corr[lag + 1];
        const denom = 2 * (2 * b - a - c);
        const refinedLag = Math.abs(denom) > 1e-10 ? lag + (c - a) / denom : lag;
        return sampleRate / refinedLag;
      }
    }

    return -1;
  }

  function stop() {
    if (rafId    !== null) { cancelAnimationFrame(rafId); rafId = null; }
    if (lastNote !== null) { onNoteOff(lastNote); lastNote = null; }
    if (stream   !== null) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    if (audioCtx !== null) { audioCtx.close(); audioCtx = null; }
    analyser = null;
    onStatusChange(null);
  }

  return { stop };
}
