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
import { Frequency, start as toneStart } from 'tone';
import { playNote } from '../lib/sound';
import type { MidiNote } from '../lib/types';

const LS_KEY = 'improwiz_piano_velocities';

/** Presets surfaced in Settings. Higher = more timbral response to how hard you play. */
export const VELOCITY_OPTIONS = [1, 2, 4, 8] as const;
export const VELOCITY_LABELS: Record<number, string> = { 1: 'Low', 2: 'Medium', 4: 'High', 8: 'Max' };
const DEFAULT_VELOCITIES = 4;

/** Vite serves public/salamander/ at BASE_URL + 'salamander/' ('/improwiz/salamander/' in prod). */
const SAMPLES_URL = `${import.meta.env.BASE_URL}salamander/`;

function loadVelocities(): number {
  const raw = Number(localStorage.getItem(LS_KEY));
  return (VELOCITY_OPTIONS as readonly number[]).includes(raw) ? raw : DEFAULT_VELOCITIES;
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

  #piano: Piano | null = null;
  #started = false;
  /** Bumped on every (re)build so a superseded in-flight load can detect it lost the race. */
  #loadToken = 0;

  /** Build + load the piano for the current velocity setting. Safe to call repeatedly. */
  async #build(): Promise<void> {
    const token = ++this.#loadToken;
    this.loaded = false;
    const piano = new Piano({
      velocities: this.velocities,
      release: false, // skip keybed/harmonic samples — note layers alone carry the piano sound
      pedal: false, // no sustain-pedal control in the app
      url: SAMPLES_URL,
    }).toDestination();
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

  /** Change velocity layers: persist and rebuild (the count is fixed at Piano construction). */
  setVelocities(n: number): void {
    if (n === this.velocities) return;
    this.velocities = n;
    localStorage.setItem(LS_KEY, String(n));
    if (this.#started) void this.#build();
  }
}

export const audio = new AudioState();
