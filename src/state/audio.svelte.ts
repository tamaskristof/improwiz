// src/state/audio.svelte.ts — sampled acoustic piano via @tonejs/piano, with configurable
// velocity layers. Replaces the old oscillator synth (src/lib/sound.ts) as the sound source for
// MIDI and on-screen key input. Mic input stays silent (your instrument already makes the sound).
//
// Samples are self-hosted under public/salamander/ (see scripts/fetch-samples.mjs) and served from
// our own origin so the PWA works offline. Only the velocity layers the current setting selects are
// actually fetched by the browser (per @tonejs/piano's velocitiesMap), so a higher `velocities`
// setting = more realism + more download.

// Import Piano from its module directly, not the package root: the root's index also exports
// MidiInput, which `extends EventEmitter` from Node's 'events' (Vite externalizes it to undefined in
// the browser) and pulls the uninstalled 'webmidi' peer dep. We only need Piano.
import { Piano } from '@tonejs/piano/build/piano/Piano';
import { Frequency, Gain, WaveShaper, getContext, start as toneStart } from 'tone';
import { playNote, stopAllNotes, stopNote } from '../lib/sound';
import type { MidiNote } from '../lib/types';

const LS_KEY = 'improwiz_piano_velocities';
const LS_VOLUME_KEY = 'improwiz_piano_volume';

/** Presets surfaced in Settings. Higher = more timbral response to how hard you play. */
export const VELOCITY_OPTIONS = [1, 2, 4, 8] as const;
export const VELOCITY_LABELS: Record<number, string> = { 1: 'Low', 2: 'Medium', 4: 'High', 8: 'Max' };
const DEFAULT_VELOCITIES = 4;

// Output headroom. @tonejs/piano bakes `volume: 3` dB into every velocity-layer Sampler (see
// String.js) and sums notes at unity gain, so the raw output clips Web Audio's destination (±1.0)
// even on a *single* note at full velocity — measured peaks were 1.33 for one note, 2.44 for four
// and 3.35 for six. Audible as crackle on chords. -12 dB brings a 6-note voicing to ~0.82, so the
// soft-clipper below is a safety net rather than an effect — though it does still catch the odd
// transient (a 6-note chord was measured peaking at 1.01 pre-shaper), so don't drop it.
const HEADROOM_DB = -12;

// Instantaneous soft-clipper: linear below SOFT_CLIP_KNEE, tanh-curved above, asymptotic to 1.0.
// Deliberately NOT a compressor/Tone.Limiter — those have a 3 ms attack, so a piano's attack
// transient (which is the whole problem here) passes through unlimited before gain reduction
// engages. Tone's Limiter also never overrides Compressor's default `knee: 30` dB, so it barely acts
// near 0 dBFS. A WaveShaper is sample-accurate and mathematically cannot exceed the curve's range.
const SOFT_CLIP_KNEE = 0.8;

function softClip(x: number): number {
  const a = Math.abs(x);
  if (a <= SOFT_CLIP_KNEE) return x;
  const over = (a - SOFT_CLIP_KNEE) / (1 - SOFT_CLIP_KNEE);
  return Math.sign(x) * (SOFT_CLIP_KNEE + (1 - SOFT_CLIP_KNEE) * Math.tanh(over));
}

/**
 * Max master gain, at the top of the volume slider. 2.0 = +6 dB over the safe HEADROOM_DB level;
 * pushing up there trades transparency for loudness, but the soft-clipper keeps it bounded so the
 * worst case is gentle saturation rather than the crackle this whole chain exists to prevent.
 */
const MAX_GAIN = 2;
const DEFAULT_VOLUME = 0.5; // slider midpoint => gain 1.0, i.e. exactly the HEADROOM_DB level

/** Interactions the browser accepts as the user gesture that unblocks audio. */
const UNLOCK_EVENTS = ['pointerdown', 'keydown', 'touchstart'] as const;

/** Vite serves public/salamander/ at BASE_URL + 'salamander/' ('/improwiz/salamander/' in prod). */
const SAMPLES_URL = `${import.meta.env.BASE_URL}salamander/`;

function loadVelocities(): number {
  const raw = Number(localStorage.getItem(LS_KEY));
  return (VELOCITY_OPTIONS as readonly number[]).includes(raw) ? raw : DEFAULT_VELOCITIES;
}

function loadVolume(): number {
  // Note the explicit null check: Number(null) is 0, which would pass the range test below and
  // silently mute a fresh install.
  const raw = localStorage.getItem(LS_VOLUME_KEY);
  if (raw === null) return DEFAULT_VOLUME;
  const v = Number(raw);
  return Number.isFinite(v) && v >= 0 && v <= 1 ? v : DEFAULT_VOLUME;
}

function midiToNote(midi: MidiNote): string {
  return Frequency(midi, 'midi').toNote();
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

class AudioState {
  /** Selected number of velocity layers (persisted). Bind Settings to this via setVelocities(). */
  velocities = $state(loadVelocities());
  /** True once the current piano's samples have finished loading. */
  loaded = $state(false);
  /** Master volume as a 0–1 slider position (persisted). Scaled by MAX_GAIN to get actual gain. */
  volume = $state(loadVolume());
  /** True while the browser is blocking audio until the user interacts with the page. */
  blocked = $state(false);

  #piano: Piano | null = null;
  /**
   * Master bus: user gain -> soft-clipper -> destination. Created once and reused, since it must
   * outlive the piano rebuilds setVelocities() does. The clipper is deliberately last, so nothing
   * downstream can push the signal back over full scale.
   */
  #gain: Gain | null = null;
  #started = false;
  /** Set while a document-level listener is waiting for the gesture that unblocks audio. */
  #unlockHandler: (() => void) | null = null;
  /** Bumped on every (re)build so a superseded in-flight load can detect it lost the race. */
  #loadToken = 0;

  /** Build + load the piano for the current velocity setting. Safe to call repeatedly. */
  async #build(): Promise<void> {
    const token = ++this.#loadToken;
    this.loaded = false;
    if (!this.#gain) {
      const shaper = new WaveShaper(softClip, 4096).toDestination();
      shaper.oversample = '4x'; // the curve is non-linear — oversample to keep aliasing down
      this.#gain = new Gain(this.volume * MAX_GAIN).connect(shaper);
    }
    const piano = new Piano({
      velocities: this.velocities,
      release: false, // skip keybed/harmonic samples — note layers alone carry the piano sound
      pedal: false, // no sustain-pedal control in the app
      url: SAMPLES_URL,
    }).connect(this.#gain);
    // `strings` is the only component in play (release/pedal are off), so it's the one volume knob.
    piano.strings.value = HEADROOM_DB;
    await piano.load();
    if (token !== this.#loadToken) {
      piano.dispose(); // a newer velocity setting superseded this build — throw it away
      return;
    }
    this.#piano?.dispose();
    this.#piano = piano;
    this.loaded = true;
    // Hand over cleanly: anything the fallback synth is still ringing would otherwise sound
    // underneath the piano until its fixed decay ran out.
    stopAllNotes();
  }

  /**
   * Resume the AudioContext and kick off sample loading. Idempotent.
   *
   * Browsers only allow this from a real user gesture, and **WebMIDI note events do not count as
   * one** — so playing a MIDI keyboard on a fresh origin leaves the context suspended and drops
   * every note onto the `playNote` fallback. Chrome leaves a blocked `resume()` promise pending
   * (it resolves later if a gesture happens) rather than rejecting, so audio does recover if the
   * user happens to click something — but a MIDI-only player never does, and nothing told them to.
   * Hence `blocked`, which drives a "click anywhere" banner, plus `armAutoStart()`'s listener so any
   * interaction reliably starts audio. (Only reproduces in production — on localhost Chrome's Media
   * Engagement Index usually grants autoplay, which is why this looked fine in dev.)
   */
  ensureStarted(): void {
    if (this.#started) return;
    this.#armUnlock();
    if (getContext().state !== 'running') {
      this.blocked = true; // a gesture is required; the unlock listener will pick it up
      return;
    }
    void toneStart().then(() => this.#onRunning());
  }

  /**
   * Arm the page so the first real user interaction anywhere starts audio. Call this once on mount:
   * a MIDI-only player may otherwise never produce a gesture the browser accepts.
   */
  armAutoStart(): void {
    this.#armUnlock();
  }

  #armUnlock(): void {
    if (this.#unlockHandler || this.#started) return;
    const handler = () => void toneStart().then(() => this.#onRunning());
    this.#unlockHandler = handler;
    // Capture phase, so this runs before the app's own mousedown handlers on the SVG keys.
    for (const ev of UNLOCK_EVENTS) document.addEventListener(ev, handler, { capture: true });
  }

  #onRunning(): void {
    if (this.#started || getContext().state !== 'running') return;
    this.#started = true;
    this.blocked = false;
    if (this.#unlockHandler) {
      for (const ev of UNLOCK_EVENTS) {
        document.removeEventListener(ev, this.#unlockHandler, { capture: true });
      }
      this.#unlockHandler = null;
    }
    void this.#build();
  }

  noteOn(midi: MidiNote, velocity01: number): void {
    this.ensureStarted();
    if (this.#piano && this.loaded) {
      this.#piano.keyDown({ note: midiToNote(midi), velocity: clamp01(velocity01) });
    } else if (!this.blocked) {
      // Samples still loading — fall back to the synth for immediate feedback. Skipped while
      // blocked: its AudioContext is blocked too, so it would only log "not allowed to start".
      playNote(midi);
    }
  }

  noteOff(midi: MidiNote): void {
    stopNote(midi); // no-op unless the fallback synth is the one holding this note
    if (!this.#piano || !this.loaded) return;
    this.#piano.keyUp({ note: midiToNote(midi) });
  }

  /** Set master volume from a 0–1 slider position: persist and apply live (no rebuild needed). */
  setVolume(v: number): void {
    const clamped = clamp01(v);
    this.volume = clamped;
    localStorage.setItem(LS_VOLUME_KEY, String(clamped));
    if (this.#gain) this.#gain.gain.rampTo(clamped * MAX_GAIN, 0.05); // ramp to avoid a click
  }

  /** Change velocity layers: persist and rebuild (the count is fixed at Piano construction). */
  setVelocities(n: number): void {
    if (n === this.velocities) return;
    this.velocities = n;
    localStorage.setItem(LS_KEY, String(n));
    if (this.#started) void this.#build();
  }
}

export const audio = new AudioState();
