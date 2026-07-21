import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BASE_MIDI,
  KEY_TO_SEMITONE,
  MAX_BASE_MIDI,
  MIN_BASE_MIDI,
} from '../src/lib/computerKeys';

const LOWER_WHITES = ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash'];
const UPPER_WHITES = ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP'];

describe('computer keyboard layout', () => {
  it('maps the lower row to a major scale starting on the base note', () => {
    expect(LOWER_WHITES.map(c => KEY_TO_SEMITONE[c])).toEqual([0, 2, 4, 5, 7, 9, 11, 12, 14, 16]);
  });

  it('starts the upper row exactly an octave above the lower', () => {
    UPPER_WHITES.forEach((code, i) => {
      expect(KEY_TO_SEMITONE[code]).toBe(KEY_TO_SEMITONE[LOWER_WHITES[i]] + 12);
    });
  });

  it('places each black key a semitone above its white key', () => {
    // E and B (indices 2, 6, 9 of the row) have no black key above them.
    expect(KEY_TO_SEMITONE.KeyS).toBe(KEY_TO_SEMITONE.KeyZ + 1); // C#
    expect(KEY_TO_SEMITONE.KeyJ).toBe(KEY_TO_SEMITONE.KeyN + 1); // A#
    expect(KEY_TO_SEMITONE.Digit2).toBe(KEY_TO_SEMITONE.KeyQ + 1);
    expect(KEY_TO_SEMITONE.Digit0).toBe(KEY_TO_SEMITONE.KeyO + 1);
    expect(KEY_TO_SEMITONE.KeyK).toBeUndefined(); // above M/B — correctly unmapped
    expect(KEY_TO_SEMITONE.Digit4).toBeUndefined(); // above E
  });

  it('keeps every note on the rendered 36–96 keyboard at both octave extremes', () => {
    const semitones = Object.values(KEY_TO_SEMITONE);
    expect(MIN_BASE_MIDI + Math.min(...semitones)).toBeGreaterThanOrEqual(36);
    expect(MAX_BASE_MIDI + Math.max(...semitones)).toBeLessThanOrEqual(96);
  });

  it('only ever puts the octave base on a C, so the row picture holds at any setting', () => {
    for (const base of [MIN_BASE_MIDI, DEFAULT_BASE_MIDI, MAX_BASE_MIDI]) {
      expect(base % 12).toBe(0);
    }
    expect(DEFAULT_BASE_MIDI).toBeGreaterThanOrEqual(MIN_BASE_MIDI);
    expect(DEFAULT_BASE_MIDI).toBeLessThanOrEqual(MAX_BASE_MIDI);
    // The range has to be reachable in whole-octave steps from the default.
    expect((MAX_BASE_MIDI - MIN_BASE_MIDI) % 12).toBe(0);
  });
});
