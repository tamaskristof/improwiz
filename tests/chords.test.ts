import { describe, expect, it } from 'vitest';
import { identifyChord } from '../src/lib/chords';

describe('identifyChord — full chords', () => {
  it('names the four triad qualities from C', () => {
    expect(identifyChord([0, 4, 7]).label).toBe('C');
    expect(identifyChord([0, 3, 7]).label).toBe('Cm');
    expect(identifyChord([0, 3, 6]).label).toBe('C°');
    expect(identifyChord([0, 4, 8]).label).toBe('C+');
  });

  it('names sus and sixth chords', () => {
    expect(identifyChord([0, 2, 7]).label).toBe('Csus2');
    expect(identifyChord([0, 5, 7]).label).toBe('Csus4');
    expect(identifyChord([0, 4, 7, 9]).label).toBe('C6');
    expect(identifyChord([0, 3, 7, 9]).label).toBe('Cm6');
  });

  it('names the common seventh chords', () => {
    expect(identifyChord([0, 4, 7, 11]).label).toBe('Cmaj7');
    expect(identifyChord([0, 4, 7, 10]).label).toBe('C7');
    expect(identifyChord([0, 3, 7, 10]).label).toBe('Cm7');
    expect(identifyChord([0, 3, 6, 10]).label).toBe('Cm7♭5');
    expect(identifyChord([0, 3, 6, 9]).label).toBe('C°7');
    expect(identifyChord([0, 3, 7, 11]).label).toBe('Cm(maj7)');
  });

  it('names chords rooted off C, with prettified accidentals', () => {
    // F# major: F#-A#-C# = pcs 6, 10, 1
    expect(identifyChord([6, 10, 1]).label).toBe('F♯');
    // Bb7: Bb-D-F-Ab = pcs 10, 2, 5, 8
    expect(identifyChord([10, 2, 5, 8]).label).toBe('B♭7');
  });

  it('sets rootPitchClass and full=true on a recognized chord', () => {
    const c = identifyChord([0, 3, 7, 10]);
    expect(c!.full).toBe(true);
    expect(c!.rootPitchClass).toBe(0);
    expect(c!.rootName).toBe('C');
    expect(c!.notes).toEqual([0, 3, 7, 10]);
  });
});

describe('identifyChord — order & inversions', () => {
  it('ignores input order and duplicate octaves', () => {
    expect(identifyChord([7, 0, 4, 4, 12].map(n => n % 12)).label).toBe('C');
  });

  it('resolves the root from the bass note on an inverted triad', () => {
    // C major held in first inversion (E in the bass): notes E-G-C, bass = E (pc 4).
    // Without a bass hint it still matches C major (only one template fits).
    expect(identifyChord([4, 7, 0], 4).label).toBe('C');
  });
});

describe('identifyChord — symmetric chords use the bass', () => {
  it('names a diminished seventh from whichever note is in the bass', () => {
    // C°7 = C-Eb-Gb-A (pcs 0,3,6,9) is rotationally symmetric: every note is a
    // valid root. The bass note decides the spelling.
    const notes = [0, 3, 6, 9];
    expect(identifyChord(notes, 0).label).toBe('C°7');
    expect(identifyChord(notes, 3).label).toBe('E♭°7');
    expect(identifyChord(notes, 6).label).toBe('F♯°7');
    expect(identifyChord(notes, 9).label).toBe('A°7');
  });

  it('names an augmented triad from the bass note', () => {
    // C+ = C-E-G# (0,4,8) is symmetric across its three notes.
    const notes = [0, 4, 8];
    expect(identifyChord(notes, 0).label).toBe('C+');
    expect(identifyChord(notes, 4).label).toBe('E+');
    expect(identifyChord(notes, 8).label).toBe('A♭+');
  });
});

describe('identifyChord — partial and empty states', () => {
  it('returns null when nothing is held', () => {
    expect(identifyChord([])).toBeNull();
  });

  it('echoes a single note as a partial', () => {
    const c = identifyChord([4]);
    expect(c!.full).toBe(false);
    expect(c!.label).toBe('E');
    expect(c!.rootPitchClass).toBeNull();
  });

  it('shows a two-note dyad as a partial', () => {
    const c = identifyChord([0, 7]);
    expect(c!.full).toBe(false);
    expect(c!.label).toBe('C + G');
  });

  it('falls back to listing notes for an unrecognized set', () => {
    // Five adjacent chromatic notes — no template matches.
    const c = identifyChord([0, 1, 2, 3, 4]);
    expect(c!.full).toBe(false);
    expect(c!.rootPitchClass).toBeNull();
    expect(c!.label).toBe('C C♯ D E♭ E');
  });
});
