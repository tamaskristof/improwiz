import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ENABLED_SCALES,
  ROOT_NAMES,
  SCALE_DEFS,
  SCALE_FAMILIES,
  findRelatedScales,
  formatDerivation,
  getBrightness,
  getDegreeLabel,
  getDerivation,
  getNoteRole,
  getSiblings,
  getStabilityRole,
  getStepSizes,
  getTensionNotes,
  getTonicChordTones,
  prettifyAccidental,
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

describe('getNoteRole', () => {
  // C Dorian: scale {0,2,3,5,7,9,10}; its characteristic note is the natural 6 (A = 9).
  const scale = new Set([0, 2, 3, 5, 7, 9, 10]);
  const characteristic = new Set([9]);

  it('marks the root before anything else', () => {
    expect(getNoteRole(0, 0, characteristic, scale)).toBe('root');
  });

  it('marks characteristic notes as characteristic', () => {
    expect(getNoteRole(9, 0, characteristic, scale)).toBe('characteristic');
  });

  it('marks other scale tones as scale', () => {
    expect(getNoteRole(2, 0, characteristic, scale)).toBe('scale');
    expect(getNoteRole(3, 0, characteristic, scale)).toBe('scale');
    expect(getNoteRole(10, 0, characteristic, scale)).toBe('scale');
  });

  it('returns null for notes outside the scale', () => {
    expect(getNoteRole(1, 0, characteristic, scale)).toBeNull();
  });
});

describe('getTonicChordTones', () => {
  const sorted = (s: Set<number>) => [...s].sort((a, b) => a - b);

  it('stacks degrees 1/3/5 by index for 7-note scales', () => {
    expect(sorted(getTonicChordTones(0, 'Ionian'))).toEqual([0, 4, 7]);
    expect(sorted(getTonicChordTones(0, 'Aeolian'))).toEqual([0, 3, 7]);
  });

  it('gives Locrian its diminished tonic triad rather than inventing a perfect fifth', () => {
    expect(sorted(getTonicChordTones(0, 'Locrian'))).toEqual([0, 3, 6]);
  });

  it('picks the third by degree index when the scale contains both a 3 and a 4', () => {
    // Phrygian b4 is [0,1,3,4,7,8,10] — a pitch-class search would grab the 4.
    expect(SCALE_DEFS['Phrygian b4']).toEqual([0, 1, 3, 4, 7, 8, 10]);
    expect(sorted(getTonicChordTones(0, 'Phrygian b4'))).toEqual([0, 3, 7]);
  });

  it('falls back to a pitch-class search for the odd-cardinality scales', () => {
    expect(sorted(getTonicChordTones(0, 'Major Pentatonic'))).toEqual([0, 4, 7]);
    expect(sorted(getTonicChordTones(0, 'Minor Pentatonic'))).toEqual([0, 3, 7]);
  });

  it('prefers the natural 5 over the ♭5, so the blue note stays a colour tone', () => {
    // Blues is [0,3,5,6,7,10] — both 6 and 7 are present.
    expect(sorted(getTonicChordTones(0, 'Blues'))).toEqual([0, 3, 7]);
  });

  it('transposes with the root', () => {
    expect(sorted(getTonicChordTones(2, 'Dorian'))).toEqual([2, 5, 9]); // D F A
  });
});

describe('getTensionNotes', () => {
  const sorted = (s: Set<number>) => [...s].sort((a, b) => a - b);

  it('flags the 4th in Ionian — the textbook avoid note', () => {
    expect(sorted(getTensionNotes(0, 'Ionian'))).toEqual([5]); // F, a semitone above E
  });

  it('finds none in Lydian, which is exactly why players reach for it', () => {
    expect(sorted(getTensionNotes(0, 'Lydian'))).toEqual([]);
  });

  it('finds none in Dorian', () => {
    expect(sorted(getTensionNotes(2, 'Dorian'))).toEqual([]);
  });

  it('flags the ♭6 in Aeolian', () => {
    expect(sorted(getTensionNotes(0, 'Aeolian'))).toEqual([8]); // Ab, a semitone above G
  });

  it('flags both the ♭2 and the ♭6 in Phrygian', () => {
    expect(sorted(getTensionNotes(0, 'Phrygian'))).toEqual([1, 8]);
  });

  it('leaves the Blues ♭5 alone — it sits below the fifth, not above it', () => {
    expect(sorted(getTensionNotes(0, 'Blues'))).toEqual([]);
  });
});

describe('getStabilityRole', () => {
  // C Ionian: tonic triad C E G, F is the avoid note, no characteristic notes
  // (Ionian is a derivation anchor).
  const scale = new Set([0, 2, 4, 5, 7, 9, 11]);
  const chordTones = getTonicChordTones(0, 'Ionian');
  const tensions = getTensionNotes(0, 'Ionian');
  const role = (pc: number, characteristic = new Set<number>()) =>
    getStabilityRole(pc, 0, chordTones, tensions, characteristic, scale);

  it('ranks the tonic above the other chord tones', () => {
    expect(role(0)).toBe('tonic');
    expect(role(4)).toBe('stable');
    expect(role(7)).toBe('stable');
  });

  it('marks the avoid note as a tension', () => {
    expect(role(5)).toBe('tension');
  });

  it('marks ordinary non-chord scale tones as colour', () => {
    expect(role(2)).toBe('colour');
    expect(role(9)).toBe('colour');
    expect(role(11)).toBe('colour');
  });

  it('lets tension outrank characteristic when a note is both', () => {
    // C Phrygian's ♭2 is its characteristic note and also an avoid note; the
    // warning is the more actionable of the two, and the left column still shows
    // characteristic notes in rose + bold so neither fact is lost.
    const phrygian = new Set([0, 1, 3, 5, 7, 8, 10]);
    expect(getStabilityRole(
      1, 0, getTonicChordTones(0, 'Phrygian'), getTensionNotes(0, 'Phrygian'),
      new Set([1]), phrygian,
    )).toBe('tension');
  });

  it('ranks characteristic above plain colour tones', () => {
    expect(role(9, new Set([9]))).toBe('characteristic');
  });

  it('returns null for notes outside the scale', () => {
    expect(role(1)).toBeNull();
    expect(role(6)).toBeNull();
  });
});

describe('getDegreeLabel', () => {
  it('labels chord tones and extensions relative to the root', () => {
    expect(getDegreeLabel(0)).toBe('1');
    expect(getDegreeLabel(3)).toBe('♭3');
    expect(getDegreeLabel(7)).toBe('5');
    expect(getDegreeLabel(10)).toBe('♭7');
    expect(getDegreeLabel(2)).toBe('9');
    expect(getDegreeLabel(5)).toBe('11');
    expect(getDegreeLabel(9)).toBe('13');
  });

  it('normalizes out-of-range semitone counts mod 12', () => {
    expect(getDegreeLabel(12)).toBe('1');
    expect(getDegreeLabel(14)).toBe('9');
    expect(getDegreeLabel(-2)).toBe('♭7');
  });
});

describe('prettifyAccidental', () => {
  it('swaps ascii accidentals for unicode glyphs', () => {
    expect(prettifyAccidental('Eb')).toBe('E♭');
    expect(prettifyAccidental('F#')).toBe('F♯');
    expect(prettifyAccidental('C')).toBe('C');
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
