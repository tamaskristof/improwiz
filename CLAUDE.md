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
- `npm test` runs the Vitest suite (`tests/scales.test.ts`, `tests/tracker.test.ts`) against the pure logic
  in `src/lib/scales.ts` and `src/lib/tracker.ts` — both are DOM-free and fully unit-tested.
- `npm run check` runs `svelte-check` (type-checks `.svelte` + `.ts` files, including rune syntax) —
  use this over a bare `tsc`, which doesn't understand `$state`/`$derived`/`$props`.
- `npm run build` / `npm run preview` — production build (base path `/improwiz/` for GitHub Pages) and a
  local server to test it. `.github/workflows/deploy.yml` builds and deploys `dist/` to GitHub Pages on
  every push to `main` (repo Pages source must be set to "GitHub Actions").
- No MIDI hardware needed to test manually — the SVG keyboard keys are clickable and fire the same
  `onNoteOn`/`onNoteOff` callback shape as real MIDI/microphone input. The exception is run scoring, which
  is MIDI-only by design; drive it from the DevTools console via the dev-only debug handle in `src/main.ts`
  (`window.improwiz`): `improwiz.startRun({scaleNotes: improwiz.getScaleNotes(0,'Ionian'), rootPitchClass: 0,
  chordNotes: [0,4,7]})`, then `improwiz.recordNoteOn`/`recordNoteOff`/`endRun`.
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
  `score`/`grade` are null until `MIN_NOTES_TO_GRADE`. **Only MIDI feeds the tracker**; mic and on-screen
  clicks light keys but don't score, because mic pitch detection emits spurious notes on attack transients
  and clicking is for exploring, not playing. Scoring is duration-weighted in-scale accuracy (a held wrong
  note hurts, a brushed one barely does) with chromatic passing tones forgiven, plus low-weight chord-tone
  and note-variety bonuses. The tuned constants at the top (`PASSING_MAX_MS`, `MAX_NOTE_MS`,
  `LANDING_MIN_MS`, `MIN_NOTES_TO_GRADE`) and the score weights encode deliberate tradeoffs — read the
  comments before changing them. Covered by `tests/tracker.test.ts` (mocks `performance.now()`).
- **`src/lib/midi.ts`** — `initMidi()` wraps `navigator.requestMIDIAccess`, attaches `midimessage` listeners
  to all inputs, re-attaches on `onstatechange` (hot-plug), and parses raw MIDI bytes (0x90/0x80) into
  note-on/note-off calls. Unsupported-browser detection is the caller's job now (`App.svelte` checks
  `'requestMIDIAccess' in navigator` directly and renders the banner reactively).
- **`src/lib/microphone.ts`** — `initMic()` implements real-time pitch detection from the mic using the
  **McLeod Pitch Method** (normalized square difference function, not raw autocorrelation, to avoid octave
  errors). Deliberately mirrors midi.ts's `(onNoteOn, onNoteOff, onStatusChange)` signature so callers can
  treat mic and MIDI input interchangeably. Has hand-tuned constants for silence/onset/stability detection
  (`AMPLITUDE_THRESHOLD`, `ATTACK_HOLDOFF_MS`, `NOTE_HOLD_MS`, `NSDF_THRESHOLD`) — read the header comment
  before touching these, they encode specific tradeoffs about attack transients vs. note-decay grace periods.
- **`src/lib/sound.ts`** — tiny Web Audio synth (`playNote`) so clicking the on-screen keyboard produces
  audible feedback; not used for MIDI/mic-triggered notes (those come from a real instrument).
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
  element↔state binding).
- **`src/components/InfoPanel.svelte`** + children (`ScaleDisplay`, `FlavorCard`, `SiblingChips`,
  `RelatedScales`, `ScaleSettings`, `RunScoreCard`) — each owns its own scoped `<style>` block carved out of
  the old single `style.css`; some small rules (e.g. a `.label` style) are intentionally duplicated
  per-component rather than hoisted into a shared global class, to preserve the original CSS exactly (a few
  visually-similar `.label` usages in the original actually had different font sizes depending on context —
  check before "deduplicating" any of these).
- **`src/App.svelte`** — the composition root: wires `initMidi`/`initMic` callbacks into `input`/`score`
  state, mounts `InfoPanel` + `Keyboard` + `StatusBar`, and calls `practice.randomize()` once on mount. Only
  MIDI feeds the tracker — mouse clicks and mic input light keys via `input.press`/`release` but never call
  `recordNoteOn`/`recordNoteOff`.

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
