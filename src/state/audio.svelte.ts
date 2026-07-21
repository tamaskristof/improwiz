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
import { Frequency, Gain, WaveShaper, start as toneStart } from 'tone';
import { playNote } from '../lib/sound';
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

  #piano: Piano | null = null;
  /**
   * Master bus: user gain -> soft-clipper -> destination. Created once and reused, since it must
   * outlive the piano rebuilds setVelocities() does. The clipper is deliberately last, so nothing
   * downstream can push the signal back over full scale.
   */
  #gain: Gain | null = null;
  #started = false;
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
  }

  /**
   * Resume the AudioContext and kick off sample loading. Must be triggered from a user gesture
   * (a MIDI note, a mouse click) — browsers block audio until then. Idempotent.
   */
  ensureStarted(): void {
    if (this.#started) return;
    this.#started = true;
    void toneStart().then(() => this.#build());
  }

  noteOn(midi: MidiNote, velocity01: number): void {
    this.ensureStarted();
    if (this.#piano && this.loaded) {
      this.#piano.keyDown({ note: midiToNote(midi), velocity: clamp01(velocity01) });
    } else {
      playNote(midi); // samples still loading — fall back to the synth for immediate feedback
    }
  }

  noteOff(midi: MidiNote): void {
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
