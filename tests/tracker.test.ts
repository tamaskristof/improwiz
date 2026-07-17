import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { endRun, getRunScore, hasHeldNotes, recordNoteOff, recordNoteOn, startRun } from '../src/lib/tracker';
import type { RunContext } from '../src/lib/types';

const C_MAJOR: RunContext = {
  scaleNotes: new Set([0, 2, 4, 5, 7, 9, 11]),
  rootPitchClass: 0,
  chordNotes: [0, 4, 7],
};

let now: number;
function mockNow(t: number) {
  now = t;
  return now;
}

beforeEach(() => {
  vi.spyOn(performance, 'now').mockImplementation(() => now);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('passing tone forgiveness', () => {
  it('forgives a brief out-of-scale note that resolves a semitone into a scale note', () => {
    startRun(C_MAJOR);
    mockNow(0);
    recordNoteOn(61); // C#, pc 1 — out of scale
    mockNow(50);
    recordNoteOff(61); // held 50ms, well under PASSING_MAX_MS
    mockNow(50);
    recordNoteOn(62); // D, pc 2 — in scale, one semitone above the C#
    mockNow(550);
    recordNoteOff(62); // held 500ms

    const summary = endRun()!;
    expect(summary.strayNotes).toBe(0);
    expect(summary.passingNotes).toBe(1);
    expect(summary.accuracy).toBe(1);
  });

  it('does not forgive an out-of-scale note held too long to be a passing tone', () => {
    startRun(C_MAJOR);
    mockNow(0);
    recordNoteOn(61); // C#, pc 1
    mockNow(300);
    recordNoteOff(61); // held 300ms, over PASSING_MAX_MS(200) even though the next note resolves
    mockNow(300);
    recordNoteOn(62); // D, pc 2
    mockNow(800);
    recordNoteOff(62); // held 500ms

    const summary = endRun()!;
    expect(summary.strayNotes).toBe(1);
    expect(summary.passingNotes).toBe(0);
    expect(summary.accuracy).toBeCloseTo(500 / 800);
  });
});

describe('grading threshold', () => {
  it('withholds a grade below MIN_NOTES_TO_GRADE notes', () => {
    startRun(C_MAJOR);
    mockNow(0);
    recordNoteOn(60);
    mockNow(200);
    recordNoteOff(60);

    const summary = endRun()!;
    expect(summary.totalNotes).toBe(1);
    expect(summary.graded).toBe(false);
    expect(summary.score).toBeNull();
    expect(summary.grade).toBeNull();
    expect(summary.notesToGrade).toBe(7);
  });

  it('grades once at least MIN_NOTES_TO_GRADE notes have been played', () => {
    startRun(C_MAJOR);
    const scalePcsAsMidi = [60, 62, 64, 65, 67, 69, 71, 72]; // 8 in-scale notes
    let t = 0;
    for (const midi of scalePcsAsMidi) {
      mockNow(t);
      recordNoteOn(midi);
      mockNow(t + 300);
      recordNoteOff(midi);
      t += 300;
    }

    const summary = endRun()!;
    expect(summary.totalNotes).toBe(8);
    expect(summary.graded).toBe(true);
    expect(summary.accuracy).toBe(1);
    expect(summary.score).not.toBeNull();
    expect(summary.grade).not.toBeNull();
  });
});

describe('getRunScore (live polling)', () => {
  it('scores the held note in progress without finalizing it', () => {
    startRun(C_MAJOR);
    mockNow(0);
    recordNoteOn(60); // C, in scale
    mockNow(150);

    expect(hasHeldNotes()).toBe(true);
    const live = getRunScore()!;
    expect(live.totalNotes).toBe(1);
    expect(live.accuracy).toBe(1);

    // Still held — the run isn't disturbed by having polled it.
    mockNow(400);
    recordNoteOff(60);
    const finished = endRun()!;
    expect(finished.totalNotes).toBe(1);
    expect(hasHeldNotes()).toBe(false);
  });

  it('returns null when no run is active or nothing has been played', () => {
    expect(getRunScore()).toBeNull();
    startRun(C_MAJOR);
    expect(getRunScore()).toBeNull();
  });
});

describe('chord-tone bonus', () => {
  it('only counts notes held at least LANDING_MIN_MS toward the chord-tone ratio', () => {
    startRun(C_MAJOR);
    mockNow(0);
    recordNoteOn(60); // C — chord tone, held long enough to "land"
    mockNow(500);
    recordNoteOff(60);
    mockNow(500);
    recordNoteOn(62); // D — in scale but not a chord tone, also landed
    mockNow(1000);
    recordNoteOff(62);
    mockNow(1000);
    recordNoteOn(64); // E — chord tone, but brushed too briefly to "land"
    mockNow(1050);
    recordNoteOff(64);

    const summary = endRun()!;
    // Two landed notes (C, D); one of them (C) is a chord tone.
    expect(summary.chordToneRatio).toBeCloseTo(0.5);
  });

  it('reports a null chord-tone ratio when nothing was held long enough to land', () => {
    startRun(C_MAJOR);
    mockNow(0);
    recordNoteOn(60);
    mockNow(50);
    recordNoteOff(60);

    const summary = endRun()!;
    expect(summary.chordToneRatio).toBeNull();
  });
});

describe('startRun/endRun boundaries', () => {
  it('endRun returns null when nothing was played', () => {
    startRun(C_MAJOR);
    expect(endRun()).toBeNull();
  });

  it('a new startRun discards a prior unfinished run', () => {
    startRun(C_MAJOR);
    mockNow(0);
    recordNoteOn(60);
    // Randomize fires before note-off ever arrives.
    startRun(C_MAJOR);
    expect(hasHeldNotes()).toBe(false);
    expect(getRunScore()).toBeNull();
  });
});
