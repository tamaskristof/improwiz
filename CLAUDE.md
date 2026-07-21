# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

ImproWiz is a client-side piano improvisation practice app: Vite + Svelte 5 (runes) + TypeScript, no
backend. It connects to a MIDI keyboard via WebMIDI, renders an SVG piano that lights up as you play, and
randomly picks a key + mode/scale for you to improvise over, highlighting scale/root notes on the keyboard.
It's installable/offline-capable as a PWA.

## Running / developing

- `npm install`, then `npm run dev` (Vite dev server) and open in Chrome or Edge — WebMIDI is not supported
  in Firefox/Safari, and the app shows an in-page banner (`App.svelte`, gated on
  `'requestMIDIAccess' in navigator`) when it's missing.
- `npm run fetch-samples` (one-time) downloads the Salamander piano samples into `public/salamander/` (not
  committed). Without it the app still runs but every note falls back to the `src/lib/sound.ts` synth
  instead of the sampled piano — run it before `npm run dev`/`npm run build` (and in CI before a deploy).
- `npm test` runs the Vitest suite (`tests/scales.test.ts`, `tests/tracker.test.ts`) against the pure logic
  in `src/lib/scales.ts` and `src/lib/tracker.ts` — both are DOM-free and fully unit-tested.
- `npm run check` runs `svelte-check` (type-checks `.svelte` + `.ts` files, including rune syntax) —
  use this over a bare `tsc`, which doesn't understand `$state`/`$derived`/`$props`.
- `npm run build` / `npm run preview` — production build (base path `/improwiz/` for GitHub Pages) and a
  local server to test it. `.github/workflows/deploy.yml` builds and deploys `dist/` to GitHub Pages on
  every push to `main` (repo Pages source must be set to "GitHub Actions").
- No MIDI hardware needed to test manually — the computer keyboard plays (`src/lib/computerKeys.ts`,
  always on) and the SVG keyboard keys are clickable; both fire the same `onNoteOn`/`onNoteOff` callback
  shape as real MIDI/microphone input. The computer keyboard also feeds run scoring, so that's testable
  without hardware too; alternatively drive it from the DevTools console via the dev-only debug handle in
  `src/main.ts` (`window.improwiz`): `improwiz.startRun({scaleNotes: improwiz.getScaleNotes(0,'Ionian'),
  rootPitchClass: 0, chordNotes: [0,4,7]})`, then `improwiz.recordNoteOn`/`recordNoteOff`/`endRun`. The
  same handle exposes `improwiz.audio` for firing dense chords at full velocity to check for clipping.
- Microphone-based note detection can be tested with a real instrument/voice through the "🎤 Mic" button.

## Architecture

`src/lib/` holds pure, DOM-free logic and typed I/O wrappers; `src/state/` holds cross-component reactive
state (Svelte 5 runes in plain `.svelte.ts` modules, each exporting a singleton class instance rather than
a bare `$state` binding, since only component files can reassign an imported `let`); `src/components/` holds
the UI. `src/App.svelte` is the composition root and `src/main.ts` is the entry point.

- **`src/lib/scales.ts`** — pure data/logic. `SCALE_DEFS` is a flat name → interval-array map, 31 scales
  total: the 7 church modes plus 3 pentatonic/blues are still hand-typed; the other 21 (melodic minor,
  harmonic minor, and harmonic major modes, 7 each) are generated at load time by rotating each family's
  parent interval array (`SCALE_PARENTS`, `FAMILY_MODE_NAMES`, `rotateIntervals`) rather than hand-typed —
  don't hand-type new modes, add/rotate a parent instead. (`ScaleName` is typed as `string`, not a literal
  union, precisely because this set is built at load time rather than declared.) `SCALE_FAMILIES` groups
  mode names for the settings-panel UI and as the derivation reference pool; `DEFAULT_ENABLED_SCALES` (the
  original 10) is what a fresh install picks from before the user opts into the new families. `SCALE_INFO`
  carries musical "flavor" descriptions (feel, genres, tip, optional alias) for all 31 — `randomize()`
  assumes every enabled mode has an entry, so a new scale needs one too. `getBrightness(modeName)` computes
  a 1–11 rating for every 7-note scale as `sum(intervals) - 30` (a formula that reproduces the original
  hand-authored 1–7 values as `sum - 32`, rescaled to fit the wider range the new families need); only the 3
  odd-cardinality scales (pentatonics, blues) still hand-pin `brightness` in `SCALE_INFO` since sums aren't
  comparable across different note counts. `getDerivation(modeName)` finds the closest known scale and what
  changed (e.g. "Lydian = Major with #4"), via `diffScales` (an index-wise diff exploiting that every
  interval array here is sorted starting at 0, so degree N is always index N-1) and a tiered reference
  choice: Ionian/Aeolian are anchors with no derivation; other church modes derive from {Ionian, Aeolian},
  fewest alterations; the 21 new modes prefer a church mode named inside their own name (`Lydian Dominant` →
  Lydian) else fewest alterations tie-broken by a fixed familiarity rank; the 3 odd-cardinality scales are
  handled as explicit subset/superset cases in `deriveOtherCardinality`. Don't replace this tiered logic with
  a flat "fewest alterations" rule — it produces backwards/wrong answers (e.g. deriving Ionian from
  Mixolydian). `formatDerivation()` renders the object to text; `alterationSymbol` spells a raised-off-Aeolian
  degree with a natural sign (♮) rather than a sharp, since un-flattening a minor-scale degree reads as
  "natural" in standard usage, not "sharp". `getSiblings(root, modeName)` finds same-cardinality scales one
  degree apart (`diffScales(...).length === 1`) on the same root, searched across all 31 scales regardless of
  which are enabled; `alterName` respells the moving note (raise: drop a flat else add a sharp; lower: drop a
  sharp else add a flat) so e.g. a raised D shows as D♯, not the fixed-spelling `ROOT_NAMES` Eb. Also:
  `getScaleNotes`, `getDiatonicTriads`, `randomKeyAndMode`, `pickRandomChord`, `findRelatedScales` (scales
  that share the same pitch-class set as the current one, e.g. modal relatives — orthogonal to siblings:
  related scales are the same notes on a different root, siblings are a different note on the same root),
  `getStepSizes`. Covered by `tests/scales.test.ts`.
- **`src/lib/tracker.ts`** — pure logic. Records what was played during a "run" (one randomized key/mode) and
  grades it: `startRun()` / `recordNoteOn()` / `recordNoteOff()` / `endRun()`, plus `getRunScore()`, which
  scores the run *in progress* without disturbing it so the card can update live. `randomize()` in
  `src/state/practice.svelte.ts` is the run boundary — it banks the previous run's grade (via
  `src/state/score.svelte.ts`'s `beginRun()`), then starts a new one. Summaries carry a `graded` flag rather
  than being withheld: accuracy is meaningful from the first note, but a letter grade off two notes isn't, so
  `score`/`grade` are null until `MIN_NOTES_TO_GRADE`. **Only MIDI and the computer keyboard feed the
  tracker** — both deliver real note-on/note-off pairs with honest durations, which is exactly what the
  duration-weighted scoring below needs. Mic and on-screen clicks light keys but don't score, because mic
  pitch detection emits spurious notes on attack transients and clicking is for exploring, not playing.
  Scoring is duration-weighted in-scale accuracy (a held wrong
  note hurts, a brushed one barely does) with chromatic passing tones forgiven, plus low-weight chord-tone
  and note-variety bonuses. The tuned constants at the top (`PASSING_MAX_MS`, `MAX_NOTE_MS`,
  `LANDING_MIN_MS`, `MIN_NOTES_TO_GRADE`) and the score weights encode deliberate tradeoffs — read the
  comments before changing them. Covered by `tests/tracker.test.ts` (mocks `performance.now()`).
- **`src/lib/midi.ts`** — `initMidi()` wraps `navigator.requestMIDIAccess`, attaches `midimessage` listeners
  to all inputs, and re-attaches on `onstatechange` (hot-plug). Byte parsing lives in the exported pure
  `parseMidiMessage()` (covered by `tests/midi.test.ts`), so the rules are testable without hardware:
  0x90/0x80 → note-on/note-off, **0x90 with velocity 0 → note-off** (many controllers never send 0x80 at
  all, and missing this is the classic stuck-note bug), and **0xB0 CC 120/123** (All Sound Off / All Notes
  Off) → `onPanic`. The channel nibble is deliberately ignored — the app is monotimbral. `onPanic` also
  fires when an input port goes `disconnected`, since a controller unplugged mid-chord never sends the
  note-offs for what it was holding. Unsupported-browser detection is the caller's job (`App.svelte`
  checks `'requestMIDIAccess' in navigator` directly and renders the banner reactively). `parseMidiMessage`
  also handles the 3 pedals and 2 wheels via a single `ControllerMessage` union, dispatched through one
  `onController` callback rather than a handler per CC (computerKeys.ts/microphone.ts have no analog for
  any of these, so it stays MIDI-only): **0xB0 CC 64/66/67** (sustain/sostenuto/soft) parse to a boolean,
  thresholded at `value >= 64` like most gear does rather than attempting half-pedaling; **CC 1** (mod
  wheel) to a 0–1 value; and **0xE0** (pitch bend) reconstructs the 14-bit value (`data1` low 7 bits,
  `data2` high 7 bits) and normalizes around center (`0x2000`) to -1..1 — note the 14-bit range isn't
  symmetric around its own center, so the max value normalizes to just short of +1, not exactly it.
- **`src/lib/computerKeys.ts`** — the computer keyboard as a playable, *scored* input source, so a laptop
  with no hardware is a real practice setup. `initComputerKeys()` mirrors midi.ts's callback signature.
  Layout is the tracker/FL two-row one (`Z X C V B N M , . /` + `Q W E R T Y U I O P`, blacks on the row
  above each), giving ~2.5 octaves at once; `-`/`=` shift by an octave. It is **always on**, not gated on
  "no MIDI device" — gating would yank the keys away mid-phrase when a controller hot-plugs. Keyed by
  `KeyboardEvent.code`, **never `.key`**: `.code` is the physical key position, so the layout survives
  QWERTZ/AZERTY, where `.key` would swap Z/Y and move every punctuation key. Three stuck-note guards worth
  keeping: `e.repeat` is ignored (auto-repeat would machine-gun note-ons); a `code -> MidiNote` map records
  what each held key actually started, so releases go through it rather than recomputing from the current
  base (otherwise shifting octave mid-hold strands the old note); and `blur`/`visibilitychange` release
  everything, since the browser delivers no keyup once focus leaves the page. `MIN_BASE_MIDI`/
  `MAX_BASE_MIDI` are both C's and shifts are refused rather than clamped at the ends, so the base is
  always a C and the row picture reads the same at every octave. Pure exports covered by
  `tests/computerKeys.test.ts`.
- **`src/lib/microphone.ts`** — `initMic()` implements real-time pitch detection from the mic using the
  **McLeod Pitch Method** (normalized square difference function, not raw autocorrelation, to avoid octave
  errors). Deliberately mirrors midi.ts's `(onNoteOn, onNoteOff, onStatusChange)` signature so callers can
  treat mic and MIDI input interchangeably. Has hand-tuned constants for silence/onset/stability detection
  (`AMPLITUDE_THRESHOLD`, `ATTACK_HOLDOFF_MS`, `NOTE_HOLD_MS`, `NSDF_THRESHOLD`) — read the header comment
  before touching these, they encode specific tradeoffs about attack transients vs. note-decay grace periods.
- **`src/lib/sound.ts`** — tiny Web Audio synth (`playNote`/`stopNote`/`stopAllNotes`). No longer the
  primary sound source; it's now only the **fallback** `src/state/audio.svelte.ts` plays while the sampled
  piano's samples are still loading (immediate feedback on the first keypresses), then the real piano takes
  over. It runs on its own `AudioContext`, so it can't route through the master soft-clipper — its per-note
  peak gain is kept low (0.18) so simultaneous notes don't clip on their own. It tracks sounding voices in
  an `active` map so they can be damped early: `playNote` used to be fire-and-forget with a fixed 1.8 s
  decay, so notes still ringing when the piano finished loading kept sounding *underneath* it (measured
  550 ms of audible synth-over-piano overlap). `noteOff` now calls `stopNote`, and `#build()` calls
  `stopAllNotes()` at the handover. **This only shows up when sample loading is slow enough to play
  through** — on localhost it loads instantly, so reproduce it with CDP network throttling.
- **`src/state/audio.svelte.ts`** — the sampled acoustic piano (the actual sound source for MIDI + on-screen
  keys; **mic input stays silent**, since your instrument already makes the sound). Wraps `@tonejs/piano`
  (Salamander Grand). `noteOn(midi, velocity01)`/`noteOff(midi)` map to the library's `keyDown`/`keyUp`, so
  **held keys sustain until release** (unlike the old fixed-decay synth). `allNotesOff()` is the panic
  backstop — `Piano.stopAll()` plus the fallback synth's `stopAllNotes()`, consulting no note bookkeeping
  of its own, so it still silences things when a missing note-off has desynced `input.pressedKeys` from
  what's actually audible. The number of velocity layers is a
  user setting (`velocities`, persisted to `localStorage` under `improwiz_piano_velocities`, presets
  `VELOCITY_OPTIONS` = 1/2/4/8) — more layers = more timbral response to how hard you play. The count is
  fixed at `Piano` construction, so `setVelocities()` disposes and rebuilds the piano + reloads samples
  (`#loadToken` guards against overlapping reloads). `Piano` is built with `release:false, pedal:false` —
  `pedal:false` only gates loading/playing the *mechanical* pedal-noise samples (creak/thunk); the
  library's actual sustain bookkeeping (`pedalDown()`/`pedalUp()`) works regardless, which is what
  `setSustain()` calls. The output chain is **piano → `Tone.PitchShift` → `Tone.Vibrato` → `Tone.Reverb` →
  user `Gain` → soft-clip `WaveShaper` → destination**, with `piano.strings` trimmed to `HEADROOM_DB`
  (-12). This exists because
  `@tonejs/piano` bakes `volume: 3` dB into every velocity-layer `Sampler` and sums notes at unity gain, so
  the raw output hard-clips Web Audio's destination (±1.0) even on a *single* note at full velocity —
  measured peaks were 1.33 / 2.44 / 3.35 for 1 / 4 / 6 notes, audible as crackle. At -12 dB a 6-note
  voicing lands ~0.82, so the shaper is a safety net rather than an effect. **Don't swap the shaper for a
  compressor or `Tone.Limiter`**: those have a 3 ms attack, so the piano's attack transient — the entire
  problem — passes through before gain reduction engages, and `Tone.Limiter` additionally never overrides
  `Compressor`'s default `knee: 30` dB so it barely acts near 0 dBFS (measured: it left a 6-note chord at
  1.78). The `WaveShaper` is sample-accurate and cannot exceed its curve's range. The shaper stays **last**
  so nothing downstream can push back over full scale, and the `#gain`/`#reverb`/`#pitchShift`/`#vibrato`
  nodes are all created once and deliberately outlive the piano rebuilds `setVelocities()` performs.
  `setSostenuto(down, heldNotes)` implements the one pedal `@tonejs/piano` has no concept of at all: it
  snapshots the currently-held notes into `#sostenutoNotes` on engage, and `noteOff()` defers the real
  `keyUp` for any of them into `#sostenutoDeferred` until sostenuto lifts — everything else releases
  immediately as normal. `setSoft()` similarly has no library support (no distinct una-corda sample set),
  so it's approximated by scaling attack velocity (`SOFT_PEDAL_VELOCITY_FACTOR`) on notes played while
  held — it only affects new notes, not already-sounding ones, same as the real mechanism. Pitch bend and
  the mod wheel have no per-note equivalent on `Sampler` either, so both are bus-level effects on the
  *whole* piano output rather than true per-note bend: `setPitchBend()` sets `PitchShift.pitch` directly
  (semitones, scaled by the `pitchBendRangeSemitones` preset — no ramp, since bend messages arrive rapidly
  and should track the wheel immediately), and `setModWheel()` ramps `Vibrato.depth` (scaled by the
  `modWheelDepth` setting, against a fixed `VIBRATO_RATE_HZ`). `allNotesOff()` resets all of this too:
  pedal/wheel `$state` flags back to false/0, the sostenuto snapshot/deferred sets cleared, `pitchShift`
  pitch to 0, and `vibrato` depth ramped to 0 — `Piano.stopAll()` already calls the library's own
  `pedalUp()` internally, so sustain doesn't need a separate reset call. `volume` is a 0–1 slider position
  (persisted under `improwiz_piano_volume`) scaled by `MAX_GAIN` = 2, so the top of the slider is +6 dB and
  trades transparency for loudness — the shaper keeps that bounded (measured 0.89 on a 6-note chord).
  Reverb is split into two settings for a reason: `reverbSpace` (`REVERB_SPACES` presets Off/Room/
  Studio/Hall, persisted under `improwiz_reverb_space`) sets `decay`/`preDelay`, and Tone's `Reverb`
  **re-renders its impulse response offline on every `decay`/`preDelay` write** (see
  `node_modules/tone/.../effect/Reverb.js`'s `generate()`), so that's a preset picker, not a
  continuously-dragged slider. `reverbAmount` (persisted under `improwiz_reverb_amount`) instead drives
  `wet`, a plain `Signal` ramp with no re-render — that's the free 0–1 slider. `allNotesOff()` also ducks
  `wet` to 0 and ramps it back (`#duckToken` guards overlapping panics) since a convolution reverb's tail
  can't otherwise be silenced — the IR just keeps ringing out its decaying noise burst regardless of what
  the piano is doing. `ensureStarted()` resumes the AudioContext (`Tone.start()`), but **WebMIDI note events are not a user
  gesture**, so playing a MIDI keyboard can't start audio by itself — on a fresh origin the context stays
  suspended and every note falls through to the `playNote` synth. `armAutoStart()` (called once from
  `App.svelte`'s `onMount`) therefore listens for the first `pointerdown`/`keydown`/`touchstart` anywhere
  on the page, and `blocked` drives a "click anywhere to enable sound" banner so a MIDI-only player knows
  why it's silent. This **only reproduces in production**: on localhost Chrome's Media Engagement Index
  usually grants autoplay, so dev testing won't catch a regression here — drive it headless with
  `--autoplay-policy=document-user-activation-required`. Samples are self-hosted under `public/salamander/` (fetched by
  `scripts/fetch-samples.mjs` → `npm run fetch-samples`; ~32 MB across all 16 layers, not committed by
  default) and served from our origin so the PWA works offline; `vite.config.ts` lazily runtime-caches them
  (`CacheFirst`, cache `piano-samples`) rather than precaching. The browser only downloads the layers the
  current `velocities` setting selects (per `@tonejs/piano`'s `velocitiesMap`).
- **`src/state/practice.svelte.ts`** — current key/mode selection (root, mode, scale notes, chord,
  derivation, siblings, related scales, characteristic notes) as runes state, plus enabled-scales settings
  (persisted to `localStorage` under `improwiz_enabled_scales`, defaulting to `DEFAULT_ENABLED_SCALES` on
  first run; at least one scale must stay enabled — enforced in `setModeEnabled`/`setFamilyEnabled`).
  `randomize()` is the single method that updates the entire selection and hands off to
  `score.svelte.ts`'s `beginRun()` for the run-boundary bookkeeping.
- **`src/state/score.svelte.ts`** — live/last-run score summaries. `beginRun()` banks the previous run
  (only if it reached a grade) and starts the new one; `refresh()` re-reads `getRunScore()` and is called
  after every note event plus a 250ms tick while any key is held (`hasHeldNotes()`) — a held note keeps
  changing the duration-weighted score with no discrete event to hang off.
- **`src/state/input.svelte.ts`** — pressed keys (a `SvelteSet<MidiNote>`, from `svelte/reactivity`, so
  `.has()` reads inside templates stay fine-grained-reactive) plus the status-bar text (MIDI status or mic
  status — mic takes over the display while active, MIDI status is restored when mic stops).
- **`src/components/Keyboard.svelte`** — the SVG piano (MIDI range 36–96, i.e. C2–C7), built declaratively:
  white-key geometry computed once, then black keys `{#each}`-ed after them in the same `<svg>` so they
  paint on top. `class:is-scale`/`is-root`/`is-characteristic`/`is-pressed` are bound directly to derived
  set-membership — there's no DOM lookup map to maintain (the old `keyElements` Map is gone; Svelte owns the
  element↔state binding). A **held** key always renders its fill, including one outside the scale, which
  gets the neutral `--n-avoid` grey at `opacity: 0.8` (`.held.avoid`) — `app.css` forbids a fourth accent
  hue, so grey rather than a red, and it reads as "off the map" instead of as an error. It used to render
  nothing at all for out-of-scale notes, which was indistinguishable from the key not registering.
- **`src/components/InfoPanel.svelte`** + children (`ScaleDisplay`, `FlavorCard`, `SiblingChips`,
  `RelatedScales`, `ScaleSettings`, `RunScoreCard`) — each owns its own scoped `<style>` block carved out of
  the old single `style.css`; some small rules (e.g. a `.label` style) are intentionally duplicated
  per-component rather than hoisted into a shared global class, to preserve the original CSS exactly (a few
  visually-similar `.label` usages in the original actually had different font sizes depending on context —
  check before "deduplicating" any of these).
- **`src/App.svelte`** — the composition root: wires `initMidi`/`initComputerKeys`/`initMic` callbacks into
  `input`/`score` state, mounts `InfoPanel` + `Keyboard` + `StatusBar`, and calls `practice.randomize()`
  once on mount. MIDI and the computer keyboard share one `playNoteOn`/`playNoteOff` pair — the scored path
  is identical by design, so it's literally the same code. Mouse clicks and mic input light keys via
  `input.press`/`release` but never call `recordNoteOn`/`recordNoteOff`. Also owns `panic()` — release
  everything, reachable from Esc, the top-bar ⏹ pill, the controller's own All Notes Off, and a device
  disconnect. It calls `computerKeys.releaseAll()` *first* so those notes leave `input.pressedKeys` before
  the sweep over what's left, then `audio.allNotesOff()` as the backstop for anything `pressedKeys` never
  knew about. Deliberately **not** a run boundary: it records the note-offs, so held durations finalize
  honestly and the run continues — `practice.randomize()` stays the only thing that ends a run. Esc closes
  the settings drawer when it's open and only panics otherwise.

## Key conventions worth knowing

- Pitch classes are integers 0–11 (0 = C) per `ROOT_NAMES`; MIDI note numbers are absolute (36–96 covers the
  rendered keyboard range). These are distinct `type PitchClass = number` / `type MidiNote = number` aliases
  in `src/lib/types.ts` — the type system won't stop you mixing them up, but the names document intent.
- All input sources (MIDI, mic, on-screen mouse) are normalized to the same `onNoteOn(midi, velocity)` /
  `onNoteOff(midi)` callback shape so `App.svelte` doesn't need per-source logic.
- CSS custom properties (`--color-scale`, `--color-root`, `--color-pressed`, `--color-characteristic`,
  defined once in `src/app.css`) drive the SVG key fill colors via classes (`.is-scale`, `.is-root`,
  `.is-pressed`, `.is-characteristic`) in `Keyboard.svelte`; `.is-root` and `.is-pressed` use `!important` to
  always win over the scale/characteristic tint. `.key.white.is-characteristic`/`.key.black.is-characteristic`
  must come after the `.is-scale` rules in the stylesheet — same (0,3,0) specificity, so a note that's both
  scale and characteristic needs source order to pick the right one.
- Cross-module reactive state (`src/state/*.svelte.ts`) is exported as a singleton class instance, not a bare
  `export let x = $state(...)` — plain-module consumers can read/call into an object but can't reassign an
  imported binding, so mutation has to go through methods.
- `plans.md` is the original design/spec document for this project (phased build plan + scope decisions from
  the pre-Svelte vanilla-JS era). It's useful background for *why* things are structured this way but is not
  kept in sync with the code as features evolve — treat it as historical design intent, not current source
  of truth.
