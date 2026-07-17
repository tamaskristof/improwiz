import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ENABLED_SCALES,
  ROOT_NAMES,
  SCALE_DEFS,
  SCALE_FAMILIES,
  findRelatedScales,
  formatDerivation,
  getBrightness,
  getDerivation,
  getSiblings,
  getStepSizes,
} from '../src/lib/scales';

describe('getDerivation', () => {
  it('treats Ionian and Aeolian as anchors with no derivation', () => {
    expect(getDerivation('Ionian')).toBeNull();
    expect(getDerivation('Aeolian')).toBeNull();
  });

  it('derives Lydian as Major with a raised 4th', () => {
    const derivation = getDerivation('Lydian');
    expect(derivation).not.toBeNull();
    expect(derivation!.refName).toBe('Ionian');
    expect(formatDerivation(derivation)).toBe('Major with ♯4');
  });

  it('derives Mixolydian as Major with a flattened 7th', () => {
    const derivation = getDerivation('Mixolydian');
    expect(derivation!.refName).toBe('Ionian');
    expect(formatDerivation(derivation)).toBe('Major with ♭7');
  });

  it('derives Dorian from Aeolian using a natural sign, not a sharp', () => {
    // Dorian raises Aeolian's flat 6th back to natural — spelled "natural 6", not "#6".
    const derivation = getDerivation('Dorian');
    expect(derivation!.refName).toBe('Aeolian');
    expect(formatDerivation(derivation)).toBe('Minor with ♮6');
  });

  it('prefers a church mode named inside a generated mode\'s own name', () => {
    // Lydian Dominant should derive from Lydian (named in its own name), not a fewest-alterations
    // scan across all church modes that might land somewhere else.
    const derivation = getDerivation('Lydian Dominant');
    expect(derivation!.refName).toBe('Lydian');
    expect(formatDerivation(derivation)).toBe('Lydian with ♭7');
  });

  it('handles the odd-cardinality scales as explicit subset/superset', () => {
    const majPent = getDerivation('Major Pentatonic');
    expect(majPent).toMatchObject({ kind: 'subset', refName: 'Ionian' });
    expect(formatDerivation(majPent)).toBe('Major without 4 and 7');

    const blues = getDerivation('Blues');
    expect(blues).toMatchObject({ kind: 'superset', refName: 'Minor Pentatonic' });
    expect(formatDerivation(blues)).toBe('Minor Pentatonic plus ♭5');
  });
});

describe('getSiblings', () => {
  it('finds same-root, one-degree-moved scales, respelling the moved note', () => {
    const siblings = getSiblings(0, 'Ionian'); // C Ionian
    expect(siblings).toContainEqual({ rootName: 'C', modeName: 'Lydian', noteChange: 'F→F#' });
    expect(siblings).toContainEqual({ rootName: 'C', modeName: 'Mixolydian', noteChange: 'B→Bb' });
  });

  it('respells a lowered note by adding a flat, not a double-sharp reduction', () => {
    const siblings = getSiblings(0, 'Ionian');
    const mixo = siblings.find(s => s.modeName === 'Mixolydian')!;
    expect(mixo.noteChange).toBe('B→Bb');
  });
});

describe('getBrightness', () => {
  it('matches the interval-sum formula for 7-note scales', () => {
    // sum(intervals) - 30, per the rescale documented in scales.ts
    expect(getBrightness('Locrian')).toBe(3);   // sum 33
    expect(getBrightness('Ionian')).toBe(8);    // sum 38
    expect(getBrightness('Lydian')).toBe(9);    // sum 39
    expect(getBrightness('Aeolian')).toBe(5);   // sum 35
  });

  it('falls back to the hand-picked value for odd-cardinality scales', () => {
    expect(getBrightness('Major Pentatonic')).toBe(5);
    expect(getBrightness('Minor Pentatonic')).toBe(3);
    expect(getBrightness('Blues')).toBe(3);
  });
});

describe('rotation-generated SCALE_DEFS', () => {
  it('generates Lydian Dominant correctly from the Melodic Minor parent', () => {
    expect(SCALE_DEFS['Lydian Dominant']).toEqual([0, 2, 4, 6, 7, 9, 10]);
  });

  it('generates Altered (Super Locrian) correctly from the Melodic Minor parent', () => {
    expect(SCALE_DEFS['Altered']).toEqual([0, 1, 3, 4, 6, 8, 10]);
  });

  it('produces 31 total scales across all families', () => {
    expect(Object.keys(SCALE_DEFS)).toHaveLength(31);
  });
});

describe('findRelatedScales', () => {
  it('finds the modal relatives of C Ionian sharing the same pitch-class set', () => {
    const related = findRelatedScales(0, 'Ionian');
    expect(related).toContainEqual({ rootName: 'D', modeName: 'Dorian' });
    expect(related).toContainEqual({ rootName: 'E', modeName: 'Phrygian' });
    expect(related).toContainEqual({ rootName: 'F', modeName: 'Lydian' });
    expect(related).toContainEqual({ rootName: 'G', modeName: 'Mixolydian' });
    expect(related).toContainEqual({ rootName: 'A', modeName: 'Aeolian' });
    expect(related).toContainEqual({ rootName: 'B', modeName: 'Locrian' });
    // Excludes the input scale itself
    expect(related).not.toContainEqual({ rootName: 'C', modeName: 'Ionian' });
  });
});

describe('getStepSizes', () => {
  it('computes step sizes including the wrap-around to the octave', () => {
    expect(getStepSizes(SCALE_DEFS['Ionian'])).toEqual([2, 2, 1, 2, 2, 2, 1]);
  });
});

describe('sanity checks on static data', () => {
  it('has 12 root names', () => {
    expect(ROOT_NAMES).toHaveLength(12);
  });

  it('default-enabled scales are the original 10 (church modes + pentatonic/blues)', () => {
    expect(DEFAULT_ENABLED_SCALES).toHaveLength(10);
    expect(DEFAULT_ENABLED_SCALES).toEqual([
      ...SCALE_FAMILIES['Church Modes'],
      ...SCALE_FAMILIES['Pentatonic & Blues'],
    ]);
  });
});
