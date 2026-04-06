# ImproWiz — WebMIDI Piano Improvisation Tool

## Goals
A single-page vanilla HTML/CSS/JS app (no build step) that:
- Connects to a MIDI keyboard via the WebMIDI API
- Displays an SVG piano keyboard that lights up keys as you press them
- Randomly generates a key + mode (church modes, pentatonics, blues) for improvisation
- Highlights scale notes and a random diatonic chord on the keyboard display

---

## File Structure
```
index.html        — app shell, layout
style.css         — CSS variables, layout, key color states
src/
  app.js          — ES module entry point, wires everything together
  scales.js       — scale/mode/chord data and logic
  keyboard.js     — SVG piano keyboard renderer and state manager
  midi.js         — WebMIDI initialization and message parsing
```

---

## Phase 1 — Project Skeleton

**`index.html`**
- Header with app title
- Info panel: large key+mode display, scale note names, suggested chord, Randomize button
- Piano keyboard container (SVG injected here)
- MIDI status bar (device name or "No MIDI device detected")
- Unsupported-browser fallback banner (hidden by default)
- `<script type="module" src="src/app.js">`

**`style.css`**
- CSS variables:
  - `--color-scale` — light tint for scale notes
  - `--color-root` — accent for the root note
  - `--color-chord` — contrasting highlight for chord tones
  - `--color-pressed` — bright active state when key is physically pressed
- Standard piano key shapes (white/black proportions)
- Responsive: keyboard scales to container width
- State classes: `.is-scale`, `.is-root`, `.is-chord`, `.is-pressed`

---

## Phase 2 — Scale & Mode Engine (`src/scales.js`)

**Scales supported:**
- Church modes: Ionian, Dorian, Phrygian, Lydian, Mixolydian, Aeolian, Locrian
- Major pentatonic, Minor pentatonic
- Blues (minor blues: root, b3, 4, #4, 5, b7)

**Exports:**
- `SCALE_DEFS` — map of mode name → interval array (semitones from root)
- `ROOT_NAMES` — 12 root names with display-friendly spellings (C, C#, D, Eb, …)
- `getScaleNotes(rootPitchClass, modeName)` → `Set` of pitch classes (0–11) in the scale
- `getDiatonicTriads(rootPitchClass, modeName)` → array of `{ label, notes[] }` (pitch classes)
- `randomKeyAndMode()` → `{ rootPitchClass, rootName, modeName, scaleNotes, triads }`
- `pickRandomChord(triads)` → one `{ label, notes[] }` entry

---

## Phase 3 — SVG Piano Keyboard (`src/keyboard.js`)

**Range:** MIDI 36–96 (C2–C7, 5 octaves)

**`buildKeyboard(containerEl)`**
- Generates SVG with white and black key `<rect>` elements
- Each key has `data-midi` attribute and CSS classes `key white` or `key black`
- White keys render first (full height), black keys on top (z-order via DOM order)

**`applyKeyHighlights(scaleNotes, rootPitchClass, chordNotes)`**
- Clears all `.is-scale`, `.is-root`, `.is-chord` from all keys
- Adds `.is-scale` to all keys whose `midi % 12` is in `scaleNotes`
- Adds `.is-root` to keys whose `midi % 12 === rootPitchClass`
- Adds `.is-chord` to keys whose `midi % 12` is in `chordNotes`

**`setPressedState(midi, isPressed)`**
- Adds/removes `.is-pressed` on the matching key element

---

## Phase 4 — MIDI Input (`src/midi.js`)

**`initMidi(onNoteOn, onNoteOff, onStatusChange)`**
- Calls `navigator.requestMIDIAccess({ sysex: false })`
- Attaches `midimessage` listeners on all available MIDI inputs
- Handles `onstatechange` for device connect/disconnect — reattaches listeners automatically
- Parses messages:
  - `0x90` + velocity > 0 → `onNoteOn(midi, velocity)`
  - `0x80` or `0x90` + velocity 0 → `onNoteOff(midi)`
- Calls `onStatusChange(deviceName | null)` on changes
- Returns `{ getInputs }` for future use

**Fallback:** If `navigator.requestMIDIAccess` is undefined, show the unsupported-browser banner.

---

## Phase 5 — UI Wiring (`src/app.js`)

**On load:**
1. Call `buildKeyboard(container)`
2. Call `initMidi(...)` — update MIDI status bar on status change
3. Call `randomize()` immediately to set the first key/mode/chord

**`randomize()`:**
1. `randomKeyAndMode()` → get root, mode, scale, triads
2. `pickRandomChord(triads)` → get suggested chord
3. Update info panel: mode name (large), scale note names (list), chord label + notes
4. `applyKeyHighlights(scaleNotes, rootPitchClass, chordNotes)`

**MIDI callbacks:**
- `onNoteOn(midi)` → `setPressedState(midi, true)`
- `onNoteOff(midi)` → `setPressedState(midi, false)`

**Randomize button:** click → `randomize()`

---

## Visual Design Notes
- Dark background (#1a1a2e) with light keyboard
- Pressed keys: bright yellow/white glow
- Scale notes: subtle blue tint on white keys, darker blue on black keys
- Root note: orange/amber accent
- Chord tones: green accent (distinct from scale tint)
- Info panel: large bold mode name, smaller scale degree list, chord section

---

## Scope Decisions
- No build tools — pure ES modules, open `index.html` directly in Chrome/Edge
- 5 octaves C2–C7 (MIDI 36–96) — covers main piano improvisation range
- Chord is re-randomized on each Randomize press (not always the tonic)
- Blues = minor blues (6-note) — standard "improv" blues scale
- All MIDI channels listened to simultaneously

---

## Verification Checklist
- [ ] Open `index.html` in Chrome — no console errors
- [ ] Click Randomize → info panel and keyboard highlights update
- [ ] C Ionian shows C D E F G A B highlighted on all octaves
- [ ] Chord tones show distinct color from scale tint
- [ ] Connect MIDI keyboard → device name appears in status bar
- [ ] Press keys → correct keys light up on SVG keyboard in real time
- [ ] Disconnect/reconnect MIDI device → auto-reconnect works
- [ ] Open in Firefox → unsupported-browser banner appears gracefully
