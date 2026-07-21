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
import { Frequency, Gain, PitchShift, Reverb, Vibrato, WaveShaper, getContext, start as toneStart } from 'tone';
import { playNote, stopAllNotes, stopNote } from '../lib/sound';
import type { MidiNote } from '../lib/types';

const LS_KEY = 'improwiz_piano_velocities';
const LS_VOLUME_KEY = 'improwiz_piano_volume';
const LS_REVERB_SPACE_KEY = 'improwiz_reverb_space';
const LS_REVERB_AMOUNT_KEY = 'improwiz_reverb_amount';
const LS_PITCH_BEND_RANGE_KEY = 'improwiz_pitchbend_range';
const LS_MOD_WHEEL_DEPTH_KEY = 'improwiz_modwheel_depth';

/** Presets surfaced in Settings. Higher = more timbral response to how hard you play. */
export const VELOCITY_OPTIONS = [1, 2, 4, 8] as const;
export const VELOCITY_LABELS: Record<number, string> = { 1: 'Low', 2: 'Medium', 4: 'High', 8: 'Max' };
const DEFAULT_VELOCITIES = 4;

/**
 * Reverb "space" presets. `decay`/`preDelay` drive Tone's Reverb, which renders its impulse response
 * offline on every change (see Reverb.js `generate()`) — fine for a discrete preset pick, but not
 * something to expose as a continuously-dragged slider. The continuous control is `reverbAmount`
 * (wet/dry), which is a live Signal and never triggers a re-render.
 */
export const REVERB_SPACES = [
  { id: 'off', label: 'Off', decay: 0, preDelay: 0 },
  { id: 'room', label: 'Room', decay: 1.2, preDelay: 0.01 },
  { id: 'studio', label: 'Studio', decay: 1.8, preDelay: 0.02 },
  { id: 'hall', label: 'Hall', decay: 3.0, preDelay: 0.03 },
] as const;
export type ReverbSpaceId = (typeof REVERB_SPACES)[number]['id'];
const DEFAULT_REVERB_SPACE: ReverbSpaceId = 'room';
const DEFAULT_REVERB_AMOUNT = 0.25;
/** How long a panic's reverb-tail cut and its restore ramp take, in seconds. */
const REVERB_DUCK_S = 0.02;
const REVERB_RESTORE_S = 0.05;

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

/**
 * Pitch-bend range presets, in semitones each way. `@tonejs/piano`'s Sampler has no per-note bend,
 * so bend is a bus-level Tone.PitchShift on the whole piano output — see `#build()`.
 */
export const PITCH_BEND_RANGES = [1, 2, 7, 12] as const;
const DEFAULT_PITCH_BEND_RANGE = 2;

/** Mod-wheel depth is a 0–1 slider scaling how far CC1 pushes Tone.Vibrato's depth. */
const DEFAULT_MOD_WHEEL_DEPTH = 0.5;
/** Fixed vibrato LFO rate — only depth is user/mod-wheel controlled. */
const VIBRATO_RATE_HZ = 5;

/** Soft (una corda) pedal has no distinct sample set here, so it's approximated by attack velocity. */
const SOFT_PEDAL_VELOCITY_FACTOR = 0.6;

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

function loadReverbSpace(): ReverbSpaceId {
  const raw = localStorage.getItem(LS_REVERB_SPACE_KEY);
  return (REVERB_SPACES as readonly { id: string }[]).some((s) => s.id === raw)
    ? (raw as ReverbSpaceId)
    : DEFAULT_REVERB_SPACE;
}

function loadReverbAmount(): number {
  // Same explicit null check as loadVolume: Number(null) is 0, which would pass the range test.
  const raw = localStorage.getItem(LS_REVERB_AMOUNT_KEY);
  if (raw === null) return DEFAULT_REVERB_AMOUNT;
  const v = Number(raw);
  return Number.isFinite(v) && v >= 0 && v <= 1 ? v : DEFAULT_REVERB_AMOUNT;
}

function loadPitchBendRange(): number {
  const raw = Number(localStorage.getItem(LS_PITCH_BEND_RANGE_KEY));
  return (PITCH_BEND_RANGES as readonly number[]).includes(raw) ? raw : DEFAULT_PITCH_BEND_RANGE;
}

function loadModWheelDepth(): number {
  // Same explicit null check as loadVolume: Number(null) is 0, which would pass the range test.
  const raw = localStorage.getItem(LS_MOD_WHEEL_DEPTH_KEY);
  if (raw === null) return DEFAULT_MOD_WHEEL_DEPTH;
  const v = Number(raw);
  return Number.isFinite(v) && v >= 0 && v <= 1 ? v : DEFAULT_MOD_WHEEL_DEPTH;
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
  /** Selected reverb space preset (persisted). 'off' bypasses the wet signal entirely. */
  reverbSpace = $state(loadReverbSpace());
  /** Reverb wet amount, 0–1 (persisted). Continuous — never triggers an IR re-render. */
  reverbAmount = $state(loadReverbAmount());
  /** True while the browser is blocking audio until the user interacts with the page. */
  blocked = $state(false);
  /** Live pedal/wheel state, for status indicators — not persisted, it's hardware state not a setting. */
  sustainDown = $state(false);
  sostenutoDown = $state(false);
  softDown = $state(false);
  /** 0–1, raw mod-wheel (CC1) position. */
  modWheel = $state(0);
  /** -1..1, raw pitch-bend wheel position; 0 is center. */
  pitchBend = $state(0);
  /** Pitch-bend range preset, in semitones each way (persisted). */
  pitchBendRangeSemitones = $state(loadPitchBendRange());
  /** How far the mod wheel can push vibrato depth, 0–1 (persisted). */
  modWheelDepth = $state(loadModWheelDepth());

  #piano: Piano | null = null;
  /**
   * Master bus: piano -> pitchShift -> vibrato -> reverb -> user gain -> soft-clipper -> destination.
   * All four effect nodes are created once and reused, since they must outlive the piano rebuilds
   * setVelocities() does. The clipper is deliberately last, so nothing downstream can push the
   * signal back over full scale. pitchShift/vibrato sit before reverb so a bent/modulated note still
   * gets the room's tail.
   */
  #reverb: Reverb | null = null;
  #gain: Gain | null = null;
  #pitchShift: PitchShift | null = null;
  #vibrato: Vibrato | null = null;
  #started = false;
  /** Notes captured at the moment sostenuto engaged; their keyUp is deferred until it lifts. */
  #sostenutoNotes = new Set<MidiNote>();
  /** Notes that received a noteOff while sostenuto held them; flushed through keyUp when it lifts. */
  #sostenutoDeferred = new Set<MidiNote>();
  /** Set while a document-level listener is waiting for the gesture that unblocks audio. */
  #unlockHandler: (() => void) | null = null;
  /** Bumped on every (re)build so a superseded in-flight load can detect it lost the race. */
  #loadToken = 0;
  /** Bumped on every panic so an overlapping restore-after-duck doesn't clobber a newer one. */
  #duckToken = 0;

  /** Build + load the piano for the current velocity setting. Safe to call repeatedly. */
  async #build(): Promise<void> {
    const token = ++this.#loadToken;
    this.loaded = false;
    if (!this.#gain) {
      const shaper = new WaveShaper(softClip, 4096).toDestination();
      shaper.oversample = '4x'; // the curve is non-linear — oversample to keep aliasing down
      this.#gain = new Gain(this.volume * MAX_GAIN).connect(shaper);
    }
    if (!this.#reverb) {
      this.#reverb = new Reverb(0.001).connect(this.#gain);
      this.#reverb.wet.value = 0; // #applyReverb() below brings this up to the real setting
      this.#applyReverb();
    }
    if (!this.#vibrato) {
      this.#vibrato = new Vibrato(VIBRATO_RATE_HZ, 0).connect(this.#reverb);
    }
    if (!this.#pitchShift) {
      this.#pitchShift = new PitchShift(0).connect(this.#vibrato);
    }
    const piano = new Piano({
      velocities: this.velocities,
      release: false, // skip keybed/harmonic samples — note layers alone carry the piano sound
      // Piano.pedalDown()/pedalUp() work regardless of this flag — it only gates loading/playing the
      // mechanical pedal-noise samples (creak/thunk), which we don't want the extra download for.
      pedal: false,
      url: SAMPLES_URL,
    }).connect(this.#pitchShift);
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
      // Soft pedal has no distinct sample set here, so it's approximated by softening the attack.
      const velocity = this.softDown ? velocity01 * SOFT_PEDAL_VELOCITY_FACTOR : velocity01;
      this.#piano.keyDown({ note: midiToNote(midi), velocity: clamp01(velocity) });
    } else if (!this.blocked) {
      // Samples still loading — fall back to the synth for immediate feedback. Skipped while
      // blocked: its AudioContext is blocked too, so it would only log "not allowed to start".
      playNote(midi);
    }
  }

  noteOff(midi: MidiNote): void {
    stopNote(midi); // no-op unless the fallback synth is the one holding this note
    if (!this.#piano || !this.loaded) return;
    // Sostenuto only holds notes that were already down when it engaged — anything it captured gets
    // its keyUp deferred until it lifts; everything else releases immediately as normal.
    if (this.sostenutoDown && this.#sostenutoNotes.has(midi)) {
      this.#sostenutoDeferred.add(midi);
      return;
    }
    this.#piano.keyUp({ note: midiToNote(midi) });
  }

  /** Sustain pedal (CC64): @tonejs/piano's own pedalDown/pedalUp already handle held-note release. */
  setSustain(down: boolean): void {
    this.sustainDown = down;
    if (!this.#piano) return;
    if (down) this.#piano.pedalDown();
    else this.#piano.pedalUp();
  }

  /**
   * Sostenuto pedal (CC66): unlike sustain, only holds notes that were *already down* the moment it
   * engaged. `@tonejs/piano` has no concept of this, so it's tracked here: snapshot the currently
   * held notes on engage, defer their release (in noteOff above) until it lifts, then flush.
   */
  setSostenuto(down: boolean, heldNotes: Iterable<MidiNote>): void {
    this.sostenutoDown = down;
    if (down) {
      this.#sostenutoNotes = new Set(heldNotes);
      return;
    }
    if (this.#piano) {
      for (const midi of this.#sostenutoDeferred) this.#piano.keyUp({ note: midiToNote(midi) });
    }
    this.#sostenutoNotes.clear();
    this.#sostenutoDeferred.clear();
  }

  /** Soft/una-corda pedal (CC67): no distinct sample set, so noteOn softens attack velocity while held. */
  setSoft(down: boolean): void {
    this.softDown = down;
  }

  /**
   * Pitch bend wheel: no per-note bend exists on Piano/Sampler, so this bends the whole piano output
   * via a bus-level Tone.PitchShift. Set directly (no ramp) since bend messages arrive rapidly and
   * should track the wheel immediately.
   */
  setPitchBend(value: number): void {
    this.pitchBend = Math.max(-1, Math.min(1, value));
    if (this.#pitchShift) this.#pitchShift.pitch = this.pitchBend * this.pitchBendRangeSemitones;
  }

  /** Mod wheel (CC1): drives a bus-level Tone.Vibrato depth, the classic CC1 mapping. */
  setModWheel(value01: number): void {
    this.modWheel = clamp01(value01);
    if (this.#vibrato) this.#vibrato.depth.rampTo(this.modWheel * this.modWheelDepth, 0.05);
  }

  /** Pick a pitch-bend range preset: persist and re-apply against the current wheel position. */
  setPitchBendRange(semitones: number): void {
    if (semitones === this.pitchBendRangeSemitones) return;
    this.pitchBendRangeSemitones = semitones;
    localStorage.setItem(LS_PITCH_BEND_RANGE_KEY, String(semitones));
    if (this.#pitchShift) this.#pitchShift.pitch = this.pitchBend * semitones;
  }

  /** Set mod-wheel depth from a 0–1 slider position: persist and re-apply live, no re-render. */
  setModWheelDepth(v: number): void {
    const clamped = clamp01(v);
    this.modWheelDepth = clamped;
    localStorage.setItem(LS_MOD_WHEEL_DEPTH_KEY, String(clamped));
    if (this.#vibrato) this.#vibrato.depth.rampTo(this.modWheel * clamped, 0.05);
  }

  /**
   * Panic: silence everything currently sounding, on both the piano and the fallback synth. This is
   * the backstop layer — it doesn't consult any note bookkeeping, so it still works when a missing
   * note-off has left the app's own pressed-key state out of sync with what's audible.
   *
   * A convolution reverb's tail can't be cleared like a note can — the IR just keeps ringing out the
   * decaying noise burst it convolved — so panic wouldn't otherwise be silent while a space with a
   * long decay is active. Duck the wet signal down and back up around the stop instead: brief enough
   * to read as "cut", but ramped so it doesn't click.
   */
  allNotesOff(): void {
    stopAllNotes();
    this.#piano?.stopAll(); // this also calls the piano's own pedalUp() internally
    this.sustainDown = false;
    this.sostenutoDown = false;
    this.softDown = false;
    this.#sostenutoNotes.clear();
    this.#sostenutoDeferred.clear();
    this.pitchBend = 0;
    this.modWheel = 0;
    if (this.#pitchShift) this.#pitchShift.pitch = 0;
    this.#vibrato?.depth.rampTo(0, REVERB_DUCK_S);
    if (this.#reverb && this.reverbSpace !== 'off' && this.reverbAmount > 0) {
      const token = ++this.#duckToken;
      const target = this.reverbAmount;
      this.#reverb.wet.rampTo(0, REVERB_DUCK_S);
      setTimeout(() => {
        if (token !== this.#duckToken || !this.#reverb) return; // superseded by a newer panic
        this.#reverb.wet.rampTo(target, REVERB_RESTORE_S);
      }, REVERB_DUCK_S * 1000);
    }
  }

  /** Set master volume from a 0–1 slider position: persist and apply live (no rebuild needed). */
  setVolume(v: number): void {
    const clamped = clamp01(v);
    this.volume = clamped;
    localStorage.setItem(LS_VOLUME_KEY, String(clamped));
    if (this.#gain) this.#gain.gain.rampTo(clamped * MAX_GAIN, 0.05); // ramp to avoid a click
  }

  /**
   * Push the current reverbSpace/reverbAmount onto the live Reverb node. Setting decay/preDelay
   * triggers an offline IR re-render (Tone queues it internally, so a decay+preDelay pair issued
   * together resolves to the last values); wet is a plain Signal ramp and never re-renders, which is
   * exactly why space is a discrete preset picker and amount is a free slider.
   */
  #applyReverb(): void {
    if (!this.#reverb) return;
    const space = REVERB_SPACES.find((s) => s.id === this.reverbSpace) ?? REVERB_SPACES[1];
    if (space.id === 'off') {
      this.#reverb.wet.rampTo(0, 0.05);
      return;
    }
    this.#reverb.preDelay = space.preDelay;
    this.#reverb.decay = space.decay;
    this.#reverb.wet.rampTo(this.reverbAmount, 0.05);
  }

  /** Pick a reverb space preset: persist and (re)generate the impulse response. */
  setReverbSpace(id: ReverbSpaceId): void {
    if (id === this.reverbSpace) return;
    this.reverbSpace = id;
    localStorage.setItem(LS_REVERB_SPACE_KEY, id);
    this.#applyReverb();
  }

  /** Set reverb wet amount from a 0–1 slider position: persist and apply live, no re-render. */
  setReverbAmount(v: number): void {
    const clamped = clamp01(v);
    this.reverbAmount = clamped;
    localStorage.setItem(LS_REVERB_AMOUNT_KEY, String(clamped));
    if (this.#reverb && this.reverbSpace !== 'off') this.#reverb.wet.rampTo(clamped, 0.05);
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
