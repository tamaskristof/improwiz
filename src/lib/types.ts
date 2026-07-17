// src/lib/types.ts — shared domain types

/** 0–11, 0 = C. Distinct from MidiNote — the two are easy to mix up since both are plain numbers. */
export type PitchClass = number;

/** Absolute MIDI note number. The rendered keyboard covers 36–96 (C2–C7). */
export type MidiNote = number;

/**
 * Name of an entry in SCALE_DEFS. Not a literal union: 21 of the 31 scales are
 * generated at load time by rotating a parent's interval array (see scales.ts),
 * so the full set of valid names isn't known statically without hand-listing
 * them, which is exactly what that generation avoids.
 */
export type ScaleName = string;

export type NoteOnHandler = (midi: MidiNote, velocity: number) => void;
export type NoteOffHandler = (midi: MidiNote) => void;
export type StatusHandler = (status: string | null) => void;

export interface Triad {
  label: string;
  notes: PitchClass[];
}

export interface Chord {
  label: string;
  notes: PitchClass[];
}

export interface KeyAndMode {
  rootPitchClass: PitchClass;
  rootName: string;
  modeName: ScaleName;
  scaleNotes: Set<PitchClass>;
  triads: Triad[];
}

export interface ScaleInfo {
  alias?: string;
  feel: string;
  genres: string[];
  tip: string;
  /** Only set for the 3 odd-cardinality scales (pentatonics, blues) — see getBrightness. */
  brightness?: number;
}

export interface DegreeMove {
  degree: number;
  delta: number;
}

interface DerivationBase {
  refName: ScaleName;
  refLabel: string;
  degreeIndices: number[];
}

export interface AlterationDerivation extends DerivationBase {
  kind: 'alteration';
  moves: DegreeMove[];
}

export interface SubsetDerivation extends DerivationBase {
  kind: 'subset';
  missingDegreeNames: string[];
}

export interface SupersetDerivation extends DerivationBase {
  kind: 'superset';
  addedDegreeNames: string[];
}

export type Derivation = AlterationDerivation | SubsetDerivation | SupersetDerivation;

export interface Sibling {
  rootName: string;
  modeName: ScaleName;
  noteChange: string;
}

export interface RelatedScale {
  rootName: string;
  modeName: ScaleName;
}

export interface RunContext {
  scaleNotes: Set<PitchClass>;
  rootPitchClass: PitchClass;
  chordNotes: PitchClass[];
}

export interface RunSummary {
  accuracy: number;
  totalNotes: number;
  strayNotes: number;
  passingNotes: number;
  chordToneRatio: number | null;
  varietyRatio: number;
  degreesUsed: number;
  scaleSize: number;
  graded: boolean;
  notesToGrade: number;
  score: number | null;
  grade: string | null;
}
