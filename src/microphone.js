// src/microphone.js — microphone pitch detection (McLeod Pitch Method)

/**
 * Initialises microphone input and wires up note callbacks.
 * Interface mirrors midi.js: same onNoteOn / onNoteOff / onStatusChange signature.
 *
 * Pitch detection uses the McLeod Pitch Method (MPM):
 *   NSDF(τ) = 2·r(τ) / m(τ)
 * where r(τ) is the autocorrelation and m(τ) normalises by the signal energy at
 * each lag. The NSDF is 1.0 when the signal repeats perfectly at period τ, so the
 * fundamental consistently produces the highest peak regardless of harmonic content.
 * The first local maximum ≥ 90 % of the global NSDF max is taken as the fundamental
 * period, making octave errors much less likely than with raw autocorrelation.
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

  let stream         = null;
  let audioCtx       = null;
  let analyser       = null;
  let rafId          = null;
  let lastNote       = null;   // last midi number passed to onNoteOn, or null
  let stableNote     = null;   // candidate accumulating stability frames
  let stableCount    = 0;
  let lastActiveTime = 0;      // performance.now() of last above-threshold frame

  const FFT_SIZE            = 2048;
  const AMPLITUDE_THRESHOLD = 0.01;   // RMS below this → silence
  const STABILITY_FRAMES    = 2;      // consecutive matching frames before note-on
  const NOTE_HOLD_MS        = 120;    // hold note this long after signal drops (decay grace)
  const NSDF_THRESHOLD      = 0.90;   // McLeod k: first peak ≥ k × globalMax

  // Pre-allocated time-domain buffer — reused every frame (no GC)
  const timeDomain = new Float32Array(FFT_SIZE);

  // NSDF buffer and lag bounds allocated after AudioContext is created
  // (sampleRate may be 44100, 48000, etc.)
  let nsdf   = null;
  let minLag = 0;
  let maxLag = 0;

  navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    .then(s => {
      stream   = s;
      audioCtx = new AudioContext();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      audioCtx.createMediaStreamSource(s).connect(analyser);

      const sr = audioCtx.sampleRate;
      minLag = Math.floor(sr / 2100);   // highest note on keyboard: C7 ≈ 2093 Hz
      maxLag = Math.ceil(sr / 60);      // lowest note on keyboard:  C2 ≈ 65 Hz
      nsdf   = new Float32Array(maxLag + 1);   // pre-allocated, reused every frame

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

    // RMS silence check
    let rmsSum = 0;
    for (let i = 0; i < FFT_SIZE; i++) rmsSum += timeDomain[i] * timeDomain[i];
    const rms = Math.sqrt(rmsSum / FFT_SIZE);

    const now = performance.now();

    if (rms < AMPLITUDE_THRESHOLD) {
      // Grace period: keep the note lit while the piano note decays naturally
      if (lastNote !== null && now - lastActiveTime > NOTE_HOLD_MS) {
        onNoteOff(lastNote);
        lastNote = null;
      }
      stableNote  = null;
      stableCount = 0;
      return;
    }

    lastActiveTime = now;

    const freq = detectPitch(timeDomain, audioCtx.sampleRate);
    if (freq === -1) return;

    const midi = Math.round(69 + 12 * Math.log2(freq / 440));
    if (midi < 36 || midi > 96) return;

    // Stability debounce
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
   * McLeod Pitch Method.
   *
   * Computes the Normalized Square Difference Function:
   *   NSDF(τ) = 2·r(τ) / m(τ)
   *   r(τ) = Σ x[i]·x[i+τ]              (autocorrelation)
   *   m(τ) = Σ (x[i]² + x[i+τ]²)        (per-lag energy normalisation)
   *
   * NSDF = 1.0 for a perfectly periodic signal; harmonics produce lower peaks
   * than the fundamental because the signal only partially repeats at sub-periods.
   * Taking the first peak ≥ NSDF_THRESHOLD × globalMax (scanning from high to low
   * frequency) reliably selects the fundamental over octave-doubling candidates.
   *
   * Returns detected frequency in Hz, or -1 if no confident pitch found.
   */
  function detectPitch(buf, sampleRate) {
    const SIZE = buf.length;

    // Fill NSDF buffer for every lag in the keyboard range
    for (let lag = minLag; lag <= maxLag; lag++) {
      const n = SIZE - lag;
      let r = 0, m = 0;
      for (let i = 0; i < n; i++) {
        const xi    = buf[i];
        const xiLag = buf[i + lag];
        r += xi * xiLag;
        m += xi * xi + xiLag * xiLag;
      }
      nsdf[lag] = m > 0 ? (2 * r) / m : 0;
    }

    // Global NSDF maximum — confidence gate
    let globalMax = -Infinity;
    for (let lag = minLag; lag <= maxLag; lag++) {
      if (nsdf[lag] > globalMax) globalMax = nsdf[lag];
    }
    if (globalMax < 0.3) return -1;  // no confident periodicity in this frame

    // First local peak ≥ NSDF_THRESHOLD × globalMax → fundamental period
    for (let lag = minLag + 1; lag < maxLag; lag++) {
      if (
        nsdf[lag] >  nsdf[lag - 1] &&
        nsdf[lag] >= nsdf[lag + 1] &&
        nsdf[lag] >= NSDF_THRESHOLD * globalMax
      ) {
        // Parabolic interpolation for sub-sample period accuracy
        const a = nsdf[lag - 1], b = nsdf[lag], c = nsdf[lag + 1];
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
    nsdf     = null;
    onStatusChange(null);
  }

  return { stop };
}
