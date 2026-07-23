import { describe, expect, it } from 'vitest';
import { getDiatonicChords, identifyChord } from '../src/lib/chords';
import { SCALE_DEFS } from '../src/lib/scales';

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

describe('getDiatonicChords', () => {
  const labels = (root: number, mode: string, voicing?: 'triads' | 'sevenths') =>
    getDiatonicChords(root, mode, voicing).map(c => c.label);
  const numerals = (root: number, mode: string, voicing?: 'triads' | 'sevenths') =>
    getDiatonicChords(root, mode, voicing).map(c => c.numeral);

  it('builds the triads of C Ionian', () => {
    expect(labels(0, 'Ionian')).toEqual(['C', 'Dm', 'Em', 'F', 'G', 'Am', 'B°']);
  });

  it('builds the sevenths of C Ionian', () => {
    expect(labels(0, 'Ionian', 'sevenths'))
      .toEqual(['Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G7', 'Am7', 'Bm7♭5']);
  });

  it('cases the numerals by quality, and keeps the case across voicings', () => {
    expect(numerals(0, 'Ionian')).toEqual(['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']);
    // Same degrees, same cases — the vii becomes half-diminished rather than diminished.
    expect(numerals(0, 'Ionian', 'sevenths')).toEqual(['I', 'ii', 'iii', 'IV', 'V', 'vi', 'viiø']);
  });

  it('labels each triad quality for colour coding', () => {
    const qualities = (root: number, mode: string, voicing?: 'triads' | 'sevenths') =>
      getDiatonicChords(root, mode, voicing).map(c => c.quality);
    expect(qualities(0, 'Ionian'))
      .toEqual(['major', 'minor', 'minor', 'major', 'major', 'minor', 'dim']);
    // Quality is the triad's, so it survives the seventh voicing unchanged.
    expect(qualities(0, 'Ionian', 'sevenths'))
      .toEqual(['major', 'minor', 'minor', 'major', 'major', 'minor', 'dim']);
    // Harmonic minor's III is augmented.
    expect(qualities(0, 'Harmonic Minor')[2]).toBe('aug');
  });

  it('gives each mode the chord that carries its flavour', () => {
    // Lydian's #4 makes II major, where Ionian has ii minor.
    expect(labels(0, 'Lydian')[1]).toBe('D');
    // Mixolydian's b7 makes bVII major.
    expect(labels(0, 'Mixolydian')[6]).toBe('B♭');
    // Dorian's natural 6 makes IV major, where Aeolian has iv minor.
    expect(labels(0, 'Dorian')[3]).toBe('F');
    expect(labels(0, 'Aeolian')[3]).toBe('Fm');
  });

  it('prettifies accidentals in chord roots', () => {
    expect(labels(6, 'Ionian')[0]).toBe('F♯');
    expect(labels(10, 'Ionian')[0]).toBe('B♭');
  });

  it('stacks by index, so a rotation containing both a 3 and a 4 picks the right third', () => {
    // Phrygian b4 has a b3 and a b4; a pitch-class search for "a third above" would
    // grab the b4. Its tonic chord must still be the minor triad on degrees 1-3-5.
    const tonic = getDiatonicChords(0, 'Phrygian b4')[0];
    expect(tonic.notes).toEqual([0, 3, 7]);
    expect(tonic.label).toBe('Cm');
  });

  it('returns nothing for the odd-cardinality scales', () => {
    for (const mode of ['Major Pentatonic', 'Minor Pentatonic', 'Blues']) {
      expect(getDiatonicChords(0, mode)).toEqual([]);
      expect(getDiatonicChords(0, mode, 'sevenths')).toEqual([]);
    }
  });

  it('names every chord of every scale in every key', () => {
    const unnamed = new Set<string>();
    for (const mode of Object.keys(SCALE_DEFS)) {
      for (let root = 0; root < 12; root++) {
        for (const voicing of ['triads', 'sevenths'] as const) {
          for (const chord of getDiatonicChords(root, mode, voicing)) {
            if (chord.suffix === null) {
              const rel = chord.notes.map(pc => (pc - chord.notes[0] + 12) % 12);
              unnamed.add(`${mode} ${chord.numeral} [${rel.join(',')}]`);
            }
            expect(['major', 'minor', 'dim', 'aug']).toContain(chord.quality);
          }
        }
      }
    }
    expect([...unnamed].sort()).toEqual([]);
  });
});
