// src/lib/chords.ts — pure, DOM-free chord logic, in both directions.
//
// Backward (identifyChord): given the notes currently held (collapsed to pitch
// classes, so voicing/octave doesn't matter), name the chord they form. Covers
// triads, 6ths, sus2/sus4, and the common 7th chords — the shapes a practicing
// player actually holds.
//
// Forward (getDiatonicChords): given a scale, build the chords it contains.
//
// Both directions share one naming table (CHORD_TEMPLATES, via suffixForIntervals),
// so a chord is spelled the same whether you played it or read it off the strip.
// This lives here rather than in scales.ts because scales.ts is the dependency —
// importing the naming table the other way would make the two modules circular.

import { ROOT_NAMES, SCALE_DEFS, prettifyAccidental } from './scales';
import type { PitchClass, ScaleName } from './types';

export interface DetectedChord {
  /** Display string, e.g. "Cm7", "F♯sus4", "C♯ + E" (partial). */
  label: string;
  /** Prettified root name when a full chord is recognized, else null. */
  rootName: string | null;
  rootPitchClass: PitchClass | null;
  /** Sorted, de-duped pitch classes actually held. */
  notes: PitchClass[];
  /** true = fully recognized chord; false = partial (1–2 notes) or unrecognized. */
  full: boolean;
}

// Interval sets are semitones above the root (root = 0), sorted. They must be kept
// sorted/unique so the exact set-equality match below works. Order matters only for
// tie-breaking within the same interval set — none overlap here, so it's irrelevant.
interface ChordTemplate {
  intervals: number[];
  suffix: string;
}

const CHORD_TEMPLATES: ChordTemplate[] = [
  // Triads
  { intervals: [0, 4, 7], suffix: '' },      // major
  { intervals: [0, 3, 7], suffix: 'm' },     // minor
  { intervals: [0, 3, 6], suffix: '°' },     // diminished
  { intervals: [0, 4, 8], suffix: '+' },     // augmented
  // Suspended / added-sixth
  { intervals: [0, 2, 7], suffix: 'sus2' },
  { intervals: [0, 5, 7], suffix: 'sus4' },
  { intervals: [0, 4, 7, 9], suffix: '6' },
  { intervals: [0, 3, 7, 9], suffix: 'm6' },
  // Sevenths
  { intervals: [0, 4, 7, 11], suffix: 'maj7' },
  { intervals: [0, 4, 7, 10], suffix: '7' },
  { intervals: [0, 3, 7, 10], suffix: 'm7' },
  { intervals: [0, 3, 6, 10], suffix: 'm7♭5' },
  { intervals: [0, 3, 6, 9], suffix: '°7' },
  { intervals: [0, 3, 7, 11], suffix: 'm(maj7)' },
  // Augmented major seventh. Rare to hold deliberately, but it's the *only* seventh
  // shape the 31 scales produce that the list above didn't already cover — it turns up
  // on the augmented degree of every harmonic-minor/harmonic-major/melodic-minor mode
  // (Ionian #5's own tonic, Harmonic Minor's III+, and so on).
  { intervals: [0, 4, 8, 11], suffix: 'maj7♯5' },
];

function sortedUnique(pcs: PitchClass[]): PitchClass[] {
  return [...new Set(pcs.map(pc => ((pc % 12) + 12) % 12))].sort((a, b) => a - b);
}

function noteName(pc: PitchClass): string {
  return prettifyAccidental(ROOT_NAMES[pc]);
}

function arraysEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * Names an interval set measured from its own root, e.g. [0,3,7] → "m".
 * Returns null when nothing matches, which callers must render as *something other
 * than a chord name* — an empty suffix would silently spell an unrecognized stack
 * as a plain major triad.
 *
 * @param intervals semitones above the root; need not be sorted or de-duped.
 */
export function suffixForIntervals(intervals: number[]): string | null {
  const normalized = sortedUnique(intervals);
  for (const template of CHORD_TEMPLATES) {
    if (arraysEqual(normalized, template.intervals)) return template.suffix;
  }
  return null;
}

/**
 * Identifies the chord formed by the given pitch classes.
 *
 * @param pitchClasses   the held notes as pitch classes 0–11 (duplicates/octaves fine).
 * @param bassPitchClass the lowest sounding note's pitch class, used to disambiguate
 *   inversions and rotationally-symmetric chords (°7, +). Optional.
 * @returns a DetectedChord, or null when nothing is held.
 */
export function identifyChord(
  pitchClasses: PitchClass[],
  bassPitchClass?: PitchClass,
): DetectedChord | null {
  const notes = sortedUnique(pitchClasses);

  if (notes.length === 0) return null;

  // 1 note — nothing to name, just echo it back.
  if (notes.length === 1) {
    return {
      label: noteName(notes[0]),
      rootName: null,
      rootPitchClass: null,
      notes,
      full: false,
    };
  }

  // 2 notes — a dyad is ambiguous; show both names as a partial reading.
  if (notes.length === 2) {
    return {
      label: `${noteName(notes[0])} + ${noteName(notes[1])}`,
      rootName: null,
      rootPitchClass: null,
      notes,
      full: false,
    };
  }

  // 3+ notes — try each held note as the root and match against the templates.
  const matches: { root: PitchClass; suffix: string }[] = [];
  for (const root of notes) {
    const suffix = suffixForIntervals(notes.map(pc => (pc - root + 12) % 12));
    if (suffix !== null) matches.push({ root, suffix });
  }

  if (matches.length > 0) {
    // Prefer the interpretation whose root is the bass note (fixes inversions and the
    // symmetric °7/+ chords, which match at several roots); else take the first match.
    const chosen =
      (bassPitchClass !== undefined &&
        matches.find(m => m.root === (((bassPitchClass % 12) + 12) % 12))) ||
      matches[0];
    return {
      label: `${noteName(chosen.root)}${chosen.suffix}`,
      rootName: noteName(chosen.root),
      rootPitchClass: chosen.root,
      notes,
      full: true,
    };
  }

  // No template matched (unusual voicing, or 5+ notes) — list the notes as a partial.
  return {
    label: notes.map(noteName).join(' '),
    rootName: null,
    rootPitchClass: null,
    notes,
    full: false,
  };
}

// ── Forward: scale → the chords it contains ───────────────────

export type ChordVoicing = 'triads' | 'sevenths';

export type ChordQuality = 'major' | 'minor' | 'dim' | 'aug';

export interface DiatonicChord {
  /** Roman numeral, cased by quality and carrying its symbol: 'I', 'ii', 'vii°', 'iiø'. */
  numeral: string;
  /** Prettified root, e.g. 'F♯'. */
  rootName: string;
  /** Quality suffix from CHORD_TEMPLATES, or null when the stack matches no known chord. */
  suffix: string | null;
  /** rootName + suffix, or the bare note names when suffix is null. */
  label: string;
  /** Triad quality of the underlying chord — drives colour coding in the UI. Aug shares the
   *  major accent hue (it has a major third); its '+' symbol carries the distinction. */
  quality: ChordQuality;
  /** Pitch classes in stacked order (root, third, fifth[, seventh]) — 3 or 4 of them. */
  notes: PitchClass[];
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

/**
 * Builds the diatonic chords of a 7-note scale by stacking thirds on each degree.
 *
 * Returns [] for the 3 odd-cardinality scales (the pentatonics and blues) — they skip
 * degrees, so stacking thirds on them produces chords the scale doesn't actually imply.
 * Callers should say so rather than showing an empty row.
 *
 * Stacking is **by index** (degrees d, d+2, d+4[, d+6]), not by searching for a pitch
 * class a third above the root: rotations like `Phrygian b4` contain both a 3 and a 4,
 * and a pitch-class search picks the wrong one. Same reasoning as getTonicChordTones
 * in scales.ts.
 */
export function getDiatonicChords(
  rootPitchClass: PitchClass,
  modeName: ScaleName,
  voicing: ChordVoicing = 'triads',
): DiatonicChord[] {
  const intervals = SCALE_DEFS[modeName];
  if (!intervals || intervals.length !== 7) return [];

  const size = voicing === 'sevenths' ? 4 : 3;
  const chords: DiatonicChord[] = [];

  for (let d = 0; d < 7; d++) {
    const notes: PitchClass[] = [];
    for (let s = 0; s < size; s++) {
      notes.push((rootPitchClass + intervals[(d + s * 2) % 7]) % 12);
    }

    const chordRoot = notes[0];
    const relative = notes.map(pc => (pc - chordRoot + 12) % 12);
    const suffix = suffixForIntervals(relative);
    const rootName = noteName(chordRoot);

    // Numeral case comes from the triad underneath, so a seventh chord keeps the same
    // case as its triad — 'ii' and 'ii7' read as the same degree, which is the point.
    const [, third, fifth] = relative;
    const minorish = third === 3;
    const symbol =
        suffix === 'm7♭5'          ? 'ø'                  // half-diminished, per convention
      : third === 3 && fifth === 6 ? '°'
      : third === 4 && fifth === 8 ? '+'
      : '';
    const roman = minorish ? ROMAN[d].toLowerCase() : ROMAN[d];

    const quality: ChordQuality =
        fifth === 6 ? 'dim'
      : fifth === 8 ? 'aug'
      : third === 3 ? 'minor'
      : 'major';

    chords.push({
      numeral: roman + symbol,
      rootName,
      suffix,
      label: suffix === null ? notes.map(noteName).join(' ') : rootName + suffix,
      quality,
      notes,
    });
  }

  return chords;
}
