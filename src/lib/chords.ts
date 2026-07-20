// src/lib/chords.ts — pure, DOM-free chord identification from held pitch classes.
//
// The rest of the app only ever reasons about chords *forward* (scale → diatonic
// triads, see getDiatonicTriads in scales.ts). This module goes the other way:
// given the notes currently held (collapsed to pitch classes, so voicing/octave
// doesn't matter), name the chord they form. Covers triads, 6ths, sus2/sus4, and
// the common 7th chords — the shapes a practicing player actually holds.

import { ROOT_NAMES, prettifyAccidental } from './scales';
import type { PitchClass } from './types';

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
    const intervals = notes
      .map(pc => (pc - root + 12) % 12)
      .sort((a, b) => a - b);
    for (const template of CHORD_TEMPLATES) {
      if (arraysEqual(intervals, template.intervals)) {
        matches.push({ root, suffix: template.suffix });
      }
    }
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
