// src/keyboard.js — SVG piano keyboard renderer and state manager

const MIDI_LOW  = 36;   // C2
const MIDI_HIGH = 96;   // C7

// Key geometry (px)
const W_W = 34;   // white key width
const W_H = 160;  // white key height
const B_W = 22;   // black key width
const B_H = 100;  // black key height

// Pitch class → is black key?
const IS_BLACK = new Set([1, 3, 6, 8, 10]);

// Lookup: midi → SVG <rect> element
const keyElements = new Map();

/**
 * Returns the x-offset of a black key relative to the left edge of its
 * preceding white key (so it visually overlaps the white boundary).
 */
function blackKeyOffset(pitchClass) {
  // offsets are tuned so black keys sit between their flanking white keys
  const offsets = { 1: 22, 3: 22, 6: 22, 8: 22, 10: 22 };
  return offsets[pitchClass] ?? 22;
}

/**
 * Builds the SVG keyboard and injects it into `containerEl`.
 * Call once on page load.
 * @param {HTMLElement} containerEl
 */
function buildKeyboard(containerEl, onNoteOn, onNoteOff) {
  keyElements.clear();

  const SVG_NS = 'http://www.w3.org/2000/svg';

  // ── Count white keys to determine SVG width ──────────────────
  let whiteKeyCount = 0;
  for (let midi = MIDI_LOW; midi <= MIDI_HIGH; midi++) {
    if (!IS_BLACK.has(midi % 12)) whiteKeyCount++;
  }

  const svgW = whiteKeyCount * W_W;
  const svgH = W_H;

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`);
  svg.setAttribute('width',  `${svgW}`);
  svg.setAttribute('height', `${svgH}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Piano keyboard C2 to C7');

  // ── Pass 1: white keys ────────────────────────────────────────
  let whiteIndex = 0;
  for (let midi = MIDI_LOW; midi <= MIDI_HIGH; midi++) {
    const pc = midi % 12;
    if (IS_BLACK.has(pc)) continue;

    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', whiteIndex * W_W);
    rect.setAttribute('y', 0);
    rect.setAttribute('width',  W_W - 1);   // 1px gap between white keys
    rect.setAttribute('height', W_H);
    rect.setAttribute('rx', 2);
    rect.setAttribute('data-midi', midi);
    rect.classList.add('key', 'white');
    rect.style.cursor = 'pointer';
    rect.addEventListener('mousedown',  (e) => { e.preventDefault(); if (onNoteOn)  onNoteOn(midi); });
    rect.addEventListener('mouseup',    ()  => { if (onNoteOff) onNoteOff(midi); });
    rect.addEventListener('mouseleave', ()  => { if (onNoteOff) onNoteOff(midi); });

    svg.appendChild(rect);
    keyElements.set(midi, rect);
    whiteIndex++;
  }

  // ── Pass 2: black keys (rendered on top) ──────────────────────
  whiteIndex = 0;
  for (let midi = MIDI_LOW; midi <= MIDI_HIGH; midi++) {
    const pc = midi % 12;

    if (IS_BLACK.has(pc)) {
      // Find the preceding white key's x position
      const prevWhiteX = (whiteIndex - 1) * W_W;
      const x = prevWhiteX + W_W - Math.floor(B_W / 2);

      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('x', x);
      rect.setAttribute('y', 0);
      rect.setAttribute('width',  B_W);
      rect.setAttribute('height', B_H);
      rect.setAttribute('rx', 2);
      rect.setAttribute('data-midi', midi);
      rect.classList.add('key', 'black');
      rect.style.cursor = 'pointer';
      rect.addEventListener('mousedown',  (e) => { e.preventDefault(); if (onNoteOn)  onNoteOn(midi); });
      rect.addEventListener('mouseup',    ()  => { if (onNoteOff) onNoteOff(midi); });
      rect.addEventListener('mouseleave', ()  => { if (onNoteOff) onNoteOff(midi); });

      svg.appendChild(rect);
      keyElements.set(midi, rect);
    } else {
      whiteIndex++;
    }
  }

  containerEl.innerHTML = '';
  containerEl.appendChild(svg);
}

/**
 * Clears scale/root/chord highlights and reapplies them for the current key.
 * @param {Set<number>} scaleNotes   pitch classes in the scale
 * @param {number}      rootPitchClass
 * @param {number[]}    chordNotes   pitch classes of the suggested chord
 */
function applyKeyHighlights(scaleNotes, rootPitchClass) {
  for (const [midi, el] of keyElements) {
    el.classList.remove('is-scale', 'is-root');
    const pc = midi % 12;
    if (scaleNotes.has(pc))    el.classList.add('is-scale');
    if (pc === rootPitchClass) el.classList.add('is-root');
  }
}

/**
 * Adds or removes the `.is-pressed` class for a given MIDI note.
 * @param {number}  midi
 * @param {boolean} isPressed
 */
function setPressedState(midi, isPressed) {
  const el = keyElements.get(midi);
  if (!el) return;
  el.classList.toggle('is-pressed', isPressed);
}
