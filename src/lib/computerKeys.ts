// src/lib/computerKeys.ts — the computer keyboard as a playable input device.
//
// Deliberately mirrors midi.ts / microphone.ts's (onNoteOn, onNoteOff, ...) signature so App.svelte
// can treat it like any other input source. Always active — it isn't gated on "no MIDI device", so a
// controller hot-plugging mid-phrase never yanks the keys out from under you.
//
// Layout is the tracker/FL two-row one, two octaves stacked so you can actually improvise across a
// scale without shifting:
//
//    2 3   5 6 7   9 0
//   Q W E R T Y U I O P      <- octave n+1
//    S D   G H J   L ;
//   Z X C V B N M , . /      <- octave n
//
//   -  octave down     =  octave up
//
// Everything below is keyed by `KeyboardEvent.code` (physical key position), never `.key`: on a
// QWERTZ or AZERTY layout `.key` swaps Z/Y and moves every punctuation key, which would scramble the
// picture above. `.code` keeps the physical shape of the keyboard, which is what a player looks at.

import type { MidiNote, NoteOffHandler, NoteOnHandler } from './types';

export interface ComputerKeysController {
  /** Release every key currently held, firing onNoteOff for each. Used by the app-wide panic. */
  releaseAll: () => void;
  stop: () => void;
}

/** Fixed note-on velocity (of 127). tracker.ts records velocity but doesn't score on it. */
export const KEY_VELOCITY = 100;

export const OCTAVE_DOWN_CODE = 'Minus';
export const OCTAVE_UP_CODE = 'Equal';

/** Semitone offsets of the white keys within an octave. */
const WHITE_STEPS = [0, 2, 4, 5, 7, 9, 11];

/** Left-to-right white keys of each row; the upper row starts an octave above the lower. */
const LOWER_WHITE_CODES = ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash'];
const UPPER_WHITE_CODES = ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP'];

/**
 * Black key sitting just above each white key, or null where there is none (E and B). Positionally
 * aligned with the *_WHITE_CODES arrays above, which is also how they read on a real keyboard.
 */
const LOWER_BLACK_CODES = ['KeyS', 'KeyD', null, 'KeyG', 'KeyH', 'KeyJ', null, 'KeyL', 'Semicolon', null];
const UPPER_BLACK_CODES = ['Digit2', 'Digit3', null, 'Digit5', 'Digit6', 'Digit7', null, 'Digit9', 'Digit0', null];

function buildRow(
  whiteCodes: readonly (string | null)[],
  blackCodes: readonly (string | null)[],
  octaveOffset: number,
): Record<string, number> {
  const row: Record<string, number> = {};
  whiteCodes.forEach((code, i) => {
    const semitone = octaveOffset + 12 * Math.floor(i / 7) + WHITE_STEPS[i % 7];
    if (code) row[code] = semitone;
    const black = blackCodes[i];
    if (black) row[black] = semitone + 1;
  });
  return row;
}

/** `KeyboardEvent.code` -> semitones above the current octave base. */
export const KEY_TO_SEMITONE: Record<string, number> = {
  ...buildRow(LOWER_WHITE_CODES, LOWER_BLACK_CODES, 0),
  ...buildRow(UPPER_WHITE_CODES, UPPER_BLACK_CODES, 12),
};

/** Highest offset in the map — the span the octave clamp below has to keep on-screen. */
const MAX_SEMITONE = Math.max(...Object.values(KEY_TO_SEMITONE));

/**
 * Octave base bounds. Both are C's, and shifting moves a whole octave, so the base is always a C —
 * the row picture above then reads the same at every setting. The top is the highest C that keeps
 * every mapped note inside the 36–96 range Keyboard.svelte renders, since a note off the end of the
 * strip would sound with no visual feedback.
 */
export const MIN_BASE_MIDI = 36; // C2
export const MAX_BASE_MIDI = Math.floor((96 - MAX_SEMITONE) / 12) * 12; // C4, i.e. top note B5
/** C3: puts the two rows in the middle of the rendered keyboard. */
export const DEFAULT_BASE_MIDI = 48;

/** True if the event targets a text field or form control that should keep the keystroke. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/**
 * Wire the computer keyboard to note callbacks. Returns a controller so the caller can detach.
 */
export function initComputerKeys(
  onNoteOn: NoteOnHandler,
  onNoteOff: NoteOffHandler,
  onOctaveChange: (baseMidi: MidiNote) => void,
): ComputerKeysController {
  let baseMidi = DEFAULT_BASE_MIDI;

  /**
   * Which note each physically-held key actually started. Releases go through this map rather than
   * recomputing from `baseMidi`, so shifting octave while a key is held still releases the note that
   * was sounded — otherwise the old note rings forever and the new one never stops.
   */
  const sounding = new Map<string, MidiNote>();

  function releaseAll(): void {
    for (const midi of sounding.values()) onNoteOff(midi);
    sounding.clear();
  }

  function shiftOctave(delta: number): void {
    // Refuse an out-of-range shift rather than clamping to it — clamping would land the base on a
    // non-C and silently change which physical key plays which note name.
    const next = baseMidi + delta;
    if (next < MIN_BASE_MIDI || next > MAX_BASE_MIDI) return;
    baseMidi = next;
    onOctaveChange(baseMidi);
  }

  function handleKeyDown(e: KeyboardEvent): void {
    // Auto-repeat would machine-gun note-ons for a single held key.
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (isTypingTarget(e.target)) return;

    if (e.code === OCTAVE_DOWN_CODE || e.code === OCTAVE_UP_CODE) {
      e.preventDefault(); // browser zoom
      shiftOctave(e.code === OCTAVE_UP_CODE ? 12 : -12);
      return;
    }

    const semitone = KEY_TO_SEMITONE[e.code];
    if (semitone === undefined || sounding.has(e.code)) return;
    e.preventDefault(); // page scroll, Firefox quick-find on '/'
    const midi = baseMidi + semitone;
    sounding.set(e.code, midi);
    onNoteOn(midi, KEY_VELOCITY);
  }

  function handleKeyUp(e: KeyboardEvent): void {
    const midi = sounding.get(e.code);
    if (midi === undefined) return;
    sounding.delete(e.code);
    onNoteOff(midi);
  }

  // No keyup arrives once focus leaves the page, so anything held at that moment would ring forever.
  function handleBlur(): void {
    releaseAll();
  }

  function handleVisibility(): void {
    if (document.hidden) releaseAll();
  }

  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  window.addEventListener('blur', handleBlur);
  document.addEventListener('visibilitychange', handleVisibility);

  return {
    releaseAll,
    stop(): void {
      releaseAll();
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibility);
    },
  };
}
