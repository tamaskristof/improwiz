# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

ImproWiz is a single-page vanilla HTML/CSS/JS app (no build step, no bundler, no package.json) for piano
improvisation practice. It connects to a MIDI keyboard via WebMIDI, renders an SVG piano that lights up as
you play, and randomly picks a key + mode/scale for you to improvise over, highlighting scale/root notes
on the keyboard.

## Running / developing

There is no build step and no test suite. To work on this app:
- Open `index.html` directly in Chrome or Edge (WebMIDI is not supported in Firefox/Safari — the app shows
  an `#unsupported-banner` fallback when `navigator.requestMIDIAccess` is missing).
- Scripts are loaded as plain (non-module) `<script>` tags in `index.html`, in dependency order:
  `scales.js` → `tracker.js` → `keyboard.js` → `midi.js` → `sound.js` → `microphone.js` → `app.js`.
  Everything lives in global scope (no imports/exports, no bundler) — if you add a new file, add a
  `<script>` tag for it in that same load order in `index.html`.
- No MIDI hardware needed to test manually — the SVG keyboard keys are clickable and fire the same
  `onNoteOn`/`onNoteOff` callbacks as real MIDI/microphone input. The exception is run scoring, which is
  MIDI-only by design; because every script is a plain global, drive it from the DevTools console instead
  (`startRun({scaleNotes: getScaleNotes(0,'Ionian'), rootPitchClass: 0, chordNotes: [0,4,7]})`, then
  `recordNoteOn`/`recordNoteOff`/`endRun`). `scales.js` and `tracker.js` are pure and DOM-free, so they can
  also be loaded into Node with a mocked `performance.now()` for deterministic timing tests.
- Microphone-based note detection can be tested with a real instrument/voice through the "🎤 Mic" button.

## Architecture

Each `src/*.js` file is a self-contained "module" (plain script, global functions) with one responsibility.
`app.js` is the only file that wires them together:

- **`scales.js`** — pure data/logic, no DOM. `SCALE_DEFS` is a flat name → interval-array map, 31 scales
  total: the 7 church modes plus 3 pentatonic/blues are still hand-typed; the other 21 (melodic minor,
  harmonic minor, and harmonic major modes, 7 each) are generated at load time by rotating each family's
  parent interval array (`SCALE_PARENTS`, `FAMILY_MODE_NAMES`, `rotateIntervals`) rather than hand-typed —
  don't hand-type new modes, add/rotate a parent instead. `SCALE_FAMILIES` groups mode names for the
  settings-panel UI and as the derivation reference pool; `DEFAULT_ENABLED_SCALES` (the original 10) is what
  a fresh install picks from before the user opts into the new families. `SCALE_INFO` carries musical
  "flavor" descriptions (feel, genres, tip, optional alias) for all 31 — `randomize()` in `app.js` assumes
  every enabled mode has an entry, so a new scale needs one too. `getBrightness(modeName)` replaces the old
  hand-picked `brightness` field for every 7-note scale: it's `sum(intervals) - 30`, a formula that
  reproduces the original hand-authored 1–7 values (as `sum - 32`) once rescaled to fit the wider 1–11 range
  the new families need; only the 3 odd-cardinality scales (pentatonics, blues) still hand-pin `brightness`
  in `SCALE_INFO` since sums aren't comparable across different note counts. `getDerivation(modeName)` finds
  the closest known scale and what changed (e.g. "Lydian = Major with #4"), via `diffScales` (an index-wise
  diff exploiting that every interval array here is sorted starting at 0, so degree N is always index N-1)
  and a tiered reference choice: Ionian/Aeolian are anchors with no derivation; other church modes derive
  from {Ionian, Aeolian}, fewest alterations; the 21 new modes prefer a church mode named inside their own
  name (`Lydian Dominant` → Lydian) else fewest alterations tie-broken by a fixed familiarity rank; the 3
  odd-cardinality scales are handled as explicit subset/superset cases in `deriveOtherCardinality`. Don't
  replace this tiered logic with a flat "fewest alterations" rule — it produces backwards/wrong answers
  (e.g. deriving Ionian from Mixolydian). `formatDerivation()` renders the object to text; `alterationSymbol`
  spells a raised-off-Aeolian degree with a natural sign (♮) rather than a sharp, since un-flattening a
  minor-scale degree reads as "natural" in standard usage, not "sharp". `getSiblings(root, modeName)` finds
  same-cardinality scales one degree apart (`diffScales(...).length === 1`) on the same root, searched
  across all 31 scales regardless of which are enabled; `alterName` respells the moving note (raise: drop a
  flat else add a sharp; lower: drop a sharp else add a flat) so e.g. a raised D shows as D♯, not the
  fixed-spelling `ROOT_NAMES` Eb. Also: `getScaleNotes`, `getDiatonicTriads`, `randomKeyAndMode`,
  `pickRandomChord`, `findRelatedScales` (scales that share the same pitch-class set as the current one,
  e.g. modal relatives — orthogonal to siblings: related scales are the same notes on a different root,
  siblings are a different note on the same root), `getStepSizes`.
- **`tracker.js`** — pure logic, no DOM. Records what was played during a "run" (one randomized key/mode)
  and grades it: `startRun()` / `recordNoteOn()` / `recordNoteOff()` / `endRun()`, plus `getRunScore()`,
  which scores the run *in progress* without disturbing it so the card can update live. `randomize()` in
  `app.js` is the run boundary — it banks the previous run's grade, then starts a new one. Summaries carry
  a `graded` flag rather than being withheld: accuracy is meaningful from the first note, but a letter grade
  off two notes isn't, so `score`/`grade` are null until `MIN_NOTES_TO_GRADE`. **Only MIDI feeds the
  tracker**; mic and on-screen clicks light keys but don't score, because mic pitch detection emits spurious
  notes on attack transients and clicking is for exploring, not playing. Scoring is duration-weighted
  in-scale accuracy (a held wrong note hurts, a brushed one barely does) with chromatic passing tones
  forgiven, plus low-weight chord-tone and note-variety bonuses. The tuned constants at the top
  (`PASSING_MAX_MS`, `MAX_NOTE_MS`, `LANDING_MIN_MS`, `MIN_NOTES_TO_GRADE`) and the score weights encode
  deliberate tradeoffs — read the comments before changing them.
- **`keyboard.js`** — owns the SVG piano (MIDI range 36–96, i.e. C2–C7). `buildKeyboard()` draws white keys
  first then black keys on top, wiring mouse events to the same `onNoteOn`/`onNoteOff` callback shape used
  by MIDI/mic input. Keeps a `midi → <rect>` map (`keyElements`) used by `applyKeyHighlights()` (scale/root/
  characteristic-note tint) and `setPressedState()` (physical press glow). Note: `keyElements` is
  module-level state rebuilt each time `buildKeyboard()` runs — there's only ever one keyboard instance.
- **`midi.js`** — `initMidi()` wraps `navigator.requestMIDIAccess`, attaches `midimessage` listeners to all
  inputs, re-attaches on `onstatechange` (hot-plug), and parses raw MIDI bytes (0x90/0x80) into
  note-on/note-off calls.
- **`microphone.js`** — `initMic()` implements real-time pitch detection from the mic using the **McLeod
  Pitch Method** (normalized square difference function, not raw autocorrelation, to avoid octave errors).
  Deliberately mirrors midi.js's `(onNoteOn, onNoteOff, onStatusChange)` signature so `app.js` can treat mic
  and MIDI input interchangeably. Has hand-tuned constants for silence/onset/stability detection
  (`AMPLITUDE_THRESHOLD`, `ATTACK_HOLDOFF_MS`, `NOTE_HOLD_MS`, `NSDF_THRESHOLD`) — read the header comment
  before touching these, they encode specific tradeoffs about attack transients vs. note-decay grace
  periods.
- **`sound.js`** — tiny Web Audio synth (`playNote`) so clicking the on-screen keyboard produces audible
  feedback; not used for MIDI/mic-triggered notes (those come from a real instrument).
- **`app.js`** — the composition root. Holds all DOM refs, builds the scale-selection checkboxes grouped by
  `SCALE_FAMILIES` with a per-family toggle (persisted to `localStorage` under `improwiz_enabled_scales` as
  a flat array of mode names, defaulting to `DEFAULT_ENABLED_SCALES` on first run; at least one scale must
  stay enabled), and defines `randomize()` which is the single function that updates the entire info panel
  (root/mode name, scale notes/steps with the characteristic note bolded, derivation line, siblings chips,
  related scales, chord, flavor card) and keyboard highlights together. `renderScoreCard()`
  paints the live run, falling back to the last completed run's grade in the gap between a Randomize press
  and the first note of the new run, so Randomize doesn't wipe the grade you just earned. It's driven by the
  MIDI note callbacks plus a 250ms tick that only fires while keys are held — a held note keeps changing the
  duration-weighted score with no event to hang off. MIDI, mic, and the
  on-screen keyboard's mouse handlers all funnel into the same `setPressedState`/`playNote` calls. The
  status bar shows either MIDI status or mic status (mic takes over the display while active, MIDI status
  is restored when mic stops — see `lastMidiStatus`/`micController` in `app.js`).

## Key conventions worth knowing

- Pitch classes are integers 0–11 (0 = C) per `ROOT_NAMES`; MIDI note numbers are absolute (36–96 covers
  the rendered keyboard range).
- All three input sources (MIDI, mic, on-screen mouse) are normalized to the same
  `onNoteOn(midi, velocity)` / `onNoteOff(midi)` callback shape so `app.js` doesn't need per-source logic.
- CSS custom properties in `style.css` (`--color-scale`, `--color-root`, `--color-pressed`,
  `--color-characteristic`) drive the SVG key fill colors via classes (`.is-scale`, `.is-root`,
  `.is-pressed`, `.is-characteristic`); `.is-root` and `.is-pressed` use `!important` to always win over the
  scale/characteristic tint. `.key.white.is-characteristic`/`.key.black.is-characteristic` must come after
  the `.is-scale` rules in the stylesheet — same (0,3,0) specificity, so a note that's both scale and
  characteristic needs source order to pick the right one.
- `plans.md` is the original design/spec document for this project (phased build plan + scope decisions).
  It's useful background for *why* things are structured this way but is not kept in sync with the code as
  features evolve — treat it as historical design intent, not current source of truth.
