// src/lib/tracker.ts — practice run tracking and scoring

/**
 * Tracks the notes played during a "run" (one randomized key/mode) and grades it.
 * Pure logic — no DOM. A run starts on startRun() and ends on endRun(); the app
 * bookends every randomize() with the two, and polls getRunScore() to display the
 * run in progress live.
 *
 * Only MIDI input is recorded. Mic input is monophonic and emits spurious notes
 * during attack transients, and on-screen clicks are for exploring rather than
 * playing — scoring either would blame the player for something they didn't do.
 */

import type { MidiNote, PitchClass, RunContext, RunSummary } from './types';

// ── Tuned constants ──────────────────────────────────────────
const PASSING_MAX_MS     = 200;   // an out-of-scale note longer than this is never a passing tone
const MAX_NOTE_MS        = 2000;  // cap per-note scored duration, so a held key can't dominate a run
const MIN_SCORED_MS      = 1;     // floor, so a just-pressed note scores as itself rather than 0/0
const LANDING_MIN_MS     = 400;   // notes at least this long count as "landed on" (chord-tone bonus)
const MIN_NOTES_TO_GRADE = 8;     // below this there isn't enough playing to put a letter on

// Score weights. Accuracy dominates: the chord here is a single suggested triad held
// for the whole run rather than a progression playing in time, so chord-tone emphasis
// is a real exercise but a much weaker signal. Keep its weight low.
const W_ACCURACY = 70;
const W_CHORD    = 15;
const W_VARIETY  = 15;

/** score threshold → letter, highest first. */
const GRADE_TABLE: [number, string][] = [
  [97, 'A+'], [93, 'A'], [90, 'A-'],
  [87, 'B+'], [83, 'B'], [80, 'B-'],
  [77, 'C+'], [73, 'C'], [70, 'C-'],
  [60, 'D'],  [0,  'F'],
];

interface HeldNote {
  onTime: number;
  velocity: number;
}

interface TrackedNote {
  midi: MidiNote;
  pc: PitchClass;
  onTime: number;
  duration: number;
  velocity: number;
}

// ── Run state ────────────────────────────────────────────────
const heldNotes: Map<MidiNote, HeldNote> = new Map();
let finishedNotes: TrackedNote[] = [];
let runContext: RunContext | null = null;

/**
 * Begins a new run. Discards anything tracked so far.
 */
export function startRun(context: RunContext): void {
  heldNotes.clear();
  finishedNotes = [];
  runContext    = context;
}

/**
 * Records a key press. A repeat press without an intervening release
 * (retrigger) finalizes the previous one first.
 */
export function recordNoteOn(midi: MidiNote, velocity = 0): void {
  if (!runContext) return;
  const now = performance.now();
  if (heldNotes.has(midi)) finalizeNote(midi, now);
  heldNotes.set(midi, { onTime: now, velocity });
}

/**
 * Records a key release. Releases for notes we aren't holding are ignored —
 * that's a key held down across a Randomize, whose note-off lands in the new run.
 */
export function recordNoteOff(midi: MidiNote): void {
  if (!runContext) return;
  if (!heldNotes.has(midi)) return;
  finalizeNote(midi, performance.now());
}

/**
 * Scores the run in progress without disturbing it — safe to poll for live display.
 * @returns score summary, or null if no run is active or nothing has been played
 */
export function getRunScore(): RunSummary | null {
  if (!runContext) return null;
  const notes = snapshotNotes(performance.now());
  return notes.length === 0 ? null : scoreRun(notes, runContext);
}

/** True while at least one key is down — i.e. while durations are still growing. */
export function hasHeldNotes(): boolean {
  return heldNotes.size > 0;
}

/**
 * Ends the run and grades it. Notes still held are counted as of now.
 * @returns score summary, or null if the run wasn't started or nothing was played
 */
export function endRun(): RunSummary | null {
  if (!runContext) return null;

  const notes   = snapshotNotes(performance.now());
  const context = runContext;

  runContext    = null;
  finishedNotes = [];
  heldNotes.clear();

  return notes.length === 0 ? null : scoreRun(notes, context);
}

/**
 * Every note played so far, including keys still down (measured up to `now`).
 * Copies rather than mutates, so live polling doesn't disturb the run.
 * Sorted by onset: note-offs arrive in release order, which isn't onset order when
 * notes overlap, and the passing-tone rule reads "the next note to start".
 */
function snapshotNotes(now: number): TrackedNote[] {
  const notes = finishedNotes.slice();
  for (const [midi, held] of heldNotes) {
    notes.push({
      midi,
      pc:       midi % 12,
      onTime:   held.onTime,
      duration: now - held.onTime,
      velocity: held.velocity,
    });
  }
  return notes.sort((a, b) => a.onTime - b.onTime);
}

function finalizeNote(midi: MidiNote, offTime: number): void {
  const held = heldNotes.get(midi)!;
  heldNotes.delete(midi);
  finishedNotes.push({
    midi,
    pc:       midi % 12,
    onTime:   held.onTime,
    duration: offTime - held.onTime,
    velocity: held.velocity,
  });
}

/**
 * A brief out-of-scale note that resolves by a semitone into a scale note is a
 * chromatic passing/approach tone, not a mistake.
 * @param notes  sorted by onTime
 */
function isPassingTone(notes: TrackedNote[], i: number, scaleNotes: Set<PitchClass>): boolean {
  const note = notes[i];
  if (note.duration > PASSING_MAX_MS) return false;
  const next = notes[i + 1];
  if (!next) return false;
  return scaleNotes.has(next.pc) && Math.abs(next.midi - note.midi) === 1;
}

function gradeFor(score: number): string {
  for (const [min, letter] of GRADE_TABLE) {
    if (score >= min) return letter;
  }
  return 'F';
}

/**
 * @param notes  sorted by onTime
 */
function scoreRun(notes: TrackedNote[], { scaleNotes, chordNotes }: RunContext): RunSummary {
  const chordSet = new Set(chordNotes || []);

  let inScaleTime      = 0;
  let totalTime        = 0;
  let strayNotes       = 0;
  let passingNotes     = 0;
  let landedNotes      = 0;
  let landedChordTones = 0;
  const degreesUsed    = new Set<PitchClass>();

  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];
    const dur  = Math.min(Math.max(note.duration, MIN_SCORED_MS), MAX_NOTE_MS);
    totalTime += dur;

    if (scaleNotes.has(note.pc)) {
      inScaleTime += dur;
      degreesUsed.add(note.pc);
    } else if (isPassingTone(notes, i, scaleNotes)) {
      inScaleTime += dur;
      passingNotes++;
    } else {
      strayNotes++;
    }

    if (dur >= LANDING_MIN_MS) {
      landedNotes++;
      if (chordSet.has(note.pc)) landedChordTones++;
    }
  }

  const accuracy       = totalTime > 0 ? inScaleTime / totalTime : 0;
  const varietyRatio   = scaleNotes.size > 0 ? degreesUsed.size / scaleNotes.size : 0;
  const chordToneRatio = landedNotes > 0 ? landedChordTones / landedNotes : null;

  // A run of nothing but fast notes has no landed notes to judge chord emphasis by.
  // Drop the chord weight from the total rather than scoring it zero, which would
  // penalise fast playing for something it never had the chance to demonstrate.
  let weighted    = accuracy * W_ACCURACY + varietyRatio * W_VARIETY;
  let totalWeight = W_ACCURACY + W_VARIETY;
  if (chordToneRatio !== null) {
    weighted    += chordToneRatio * W_CHORD;
    totalWeight += W_CHORD;
  }
  const score = Math.round((weighted / totalWeight) * 100);

  // Accuracy is meaningful from the very first note, but a grade off two notes isn't.
  // Report both, and let `graded` say which parts are worth showing.
  const graded = notes.length >= MIN_NOTES_TO_GRADE;

  return {
    accuracy,
    totalNotes: notes.length,
    strayNotes,
    passingNotes,
    chordToneRatio,
    varietyRatio,
    degreesUsed: degreesUsed.size,
    scaleSize:   scaleNotes.size,
    graded,
    notesToGrade: Math.max(0, MIN_NOTES_TO_GRADE - notes.length),
    score: graded ? score : null,
    grade: graded ? gradeFor(score) : null,
  };
}
