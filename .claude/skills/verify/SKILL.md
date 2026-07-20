---
name: verify
description: Build, launch, and drive the ImproWiz app to observe a change working end-to-end in a real browser.
---

# Verifying ImproWiz

ImproWiz is a client-side Vite + Svelte 5 app. Its real surface is the **browser DOM**:
an SVG keyboard whose keys light up and drive the same `onNoteOn`/`onNoteOff` path as
MIDI. No hardware is needed — clicking keys (dispatching `mousedown`) feeds
`input.pressedKeys` exactly like MIDI does.

## Launch

```bash
npm run dev   # Vite; note the printed port (often 5173, or 5174 if busy). Base path is /improwiz/
```
Full URL: `http://localhost:<port>/improwiz/`.

## Drive it (headless, Playwright)

Playwright is available but the **system lacks browser deps** (`libnspr4`, `libcups`,
etc.). The **`chrome-headless-shell`** build needs far fewer libs than full chromium
(no cairo/X/gtk) and launches cleanly once NSS/NSPR libs are on `LD_LIBRARY_PATH`.
Extracted deps from prior sessions live under other `/tmp/claude-*/.../scratchpad`
dirs — locate with `find / -name 'libnspr4.so*'` and `find / -name 'libcups.so*'`,
then set `LD_LIBRARY_PATH` to the dir(s) containing them. Point Playwright at the shell:

```js
import pw from '<npx-cache>/node_modules/playwright/index.js'; // find via: find / -path '*node_modules/playwright' -type d
const browser = await pw.chromium.launch({
  executablePath: '<home>/.cache/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell',
});
```
Do NOT use the full `chromium-*/chrome-linux64/chrome` — it pulls cairo, which needs
real `libxcb-shm`/`libxcb-render` that aren't present (stubs fail on `xcb_shm_id`).

### Holding a chord

Real pointer movement fires `mouseleave` → releases keys. To hold multiple keys,
dispatch synthetic events on the key elements instead of using `page.mouse`:

```js
// map MIDI note -> element: whites are .key.white in MIDI order (36..96 skipping
// black pcs 1,3,6,8,10); blacks are .key.black in their own order.
el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })); // press
el.dispatchEvent(new MouseEvent('mouseup',   { bubbles: true, cancelable: true })); // release
```

### What to read

- Chord-you're-playing readout: `.chord-display .chord-name` (above the keyboard).
- Keyboard key states are classes on `.key`: `is-scale`/`is-root`/`is-pressed` etc.

A working example driver lives in this session's scratchpad (`drive.mjs`): starts the
dev server, presses C–E–G etc., reads the chord label, screenshots.

## Flows worth driving

- Chord detection: hold C-E-G → `C`; add Bb → `C7`; C-Eb-G → `Cm`; inversions resolve
  the root from the bass note.
- Scale randomize: click "Next scale" and confirm the scale name / note roles update.
