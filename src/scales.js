// src/scales.js — Scale/mode data and logic

/** Interval arrays (semitones from root) for each supported mode/scale. */
const SCALE_DEFS = {
  // Church modes
  'Ionian':      [0, 2, 4, 5, 7, 9, 11],
  'Dorian':      [0, 2, 3, 5, 7, 9, 10],
  'Phrygian':    [0, 1, 3, 5, 7, 8, 10],
  'Lydian':      [0, 2, 4, 6, 7, 9, 11],
  'Mixolydian':  [0, 2, 4, 5, 7, 9, 10],
  'Aeolian':     [0, 2, 3, 5, 7, 8, 10],
  'Locrian':     [0, 1, 3, 5, 6, 8, 10],
  // Pentatonics
  'Major Pentatonic': [0, 2, 4, 7, 9],
  'Minor Pentatonic': [0, 3, 5, 7, 10],
  // Blues
  'Blues':       [0, 3, 5, 6, 7, 10],
};

/** 12 pitch-class display names (0 = C). */
const ROOT_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

/**
 * Musical knowledge cards for each scale/mode.
 * brightness: 1 (very dark) – 5 (very bright)
 */
const SCALE_INFO = {
  'Ionian': {
    brightness: 6,
    alias: '= Major scale',
    feel: 'Bright, happy and resolved. The archetypal Western major scale — familiar and uplifting without tension.',
    genres: ['Pop', 'Classical', 'Country', 'Gospel'],
    tip: 'Try ending phrases on the major 7th (leading tone) to create a strong pull back to the root.',
  },
  'Dorian': {
    brightness: 4,
    feel: 'Minor but optimistic — a "cool" minor with a raised 6th that adds a subtle sweetness. Soulful and groove-friendly.',
    genres: ['Jazz', 'Funk', 'Rock', 'Celtic'],
    tip: 'The raised 6th makes II a major chord — lean into the II–V movement for a jazzy flavour over minor.',
  },
  'Phrygian': {
    brightness: 2,
    feel: 'Dark and tense with a distinctly Spanish or Middle-Eastern flavour. The flat 2nd creates immediate drama.',
    genres: ['Flamenco', 'Metal', 'Film Score', 'World'],
    tip: 'The bII chord (the "Phrygian chord") resolves powerfully to I — great for dramatic cadences.',
  },
  'Lydian': {
    brightness: 7,
    feel: 'Dreamy, floating and ethereal. The raised 4th gives it an otherworldly, suspended quality unlike any other major mode.',
    genres: ['Film Score', 'Ambient', 'Prog Rock', 'Jazz'],
    tip: 'Linger on the #4 over a I major chord for that signature "Lydian shimmer" heard in countless film soundtracks.',
  },
  'Mixolydian': {
    brightness: 5,
    feel: 'Major with a bluesy edge — the flat 7th adds earthiness and swagger. Feels natural and unresolved in a satisfying way.',
    genres: ['Blues-Rock', 'Folk', 'Funk', 'Classic Rock'],
    tip: 'Alternate between the I and bVII chords to instantly evoke that anthemic, modal rock sound.',
  },
  'Aeolian': {
    brightness: 3,
    alias: '= Natural minor scale',
    feel: 'Melancholic and expressive — the natural minor. Emotionally rich, cathartic, and universally understood as "sad".',
    genres: ['Rock', 'Metal', 'Classical', 'Pop'],
    tip: 'Raise the 7th to a leading tone (borrowing from harmonic minor) for stronger V–I cadences when you want resolution.',
  },
  'Locrian': {
    brightness: 1,
    feel: 'Deeply unstable and unsettling — the diminished 5th on I makes it avoid functioning as a tonic. Pure tension.',
    genres: ['Metal', 'Avant-garde', 'Film Score'],
    tip: 'Rather than treating it as a home key, use Locrian over a half-diminished (ø7) chord in jazz for the full Locrian colour.',
  },
  'Major Pentatonic': {
    brightness: 5,
    feel: 'Open, spacious and universally singable. Five notes with no semitone tension — everything sounds good.',
    genres: ['Country', 'Folk', 'Gospel', 'Pop'],
    tip: 'Play it starting on the 6th degree and you get the relative minor pentatonic — one shape, two scales for free.',
  },
  'Minor Pentatonic': {
    brightness: 3,
    feel: 'Earthy, soulful and instantly recognisable. The workhorse of rock and blues — raw and direct.',
    genres: ['Blues', 'Rock', 'R&B', 'Hip-Hop'],
    tip: 'Add the b5 "blue note" between 4 and 5 to turn this into the full blues scale for extra grit.',
  },
  'Blues': {
    brightness: 3,
    feel: 'Gritty and expressive. The added blue note (b5) creates a delicious clash that sits between major and minor emotions.',
    genres: ['Blues', 'Jazz', 'Soul', 'Rock'],
    tip: 'Bend into the blue note (b5) from the 4th for maximum expression — that microtonal slide is the heart of blues phrasing.',
  },
};

/**
 * Returns a Set of pitch classes (0–11) belonging to the scale.
 * @param {number} rootPitchClass  0–11
 * @param {string} modeName
 * @returns {Set<number>}
 */
function getScaleNotes(rootPitchClass, modeName) {
  const intervals = SCALE_DEFS[modeName];
  if (!intervals) throw new Error(`Unknown mode: ${modeName}`);
  return new Set(intervals.map(i => (rootPitchClass + i) % 12));
}

/**
 * Returns diatonic triads for 7-note modes (stacked thirds within the scale).
 * For pentatonic/blues scales returns an empty array — no conventional triads.
 * @param {number} rootPitchClass
 * @param {string} modeName
 * @returns {Array<{label: string, notes: number[]}>}
 */
function getDiatonicTriads(rootPitchClass, modeName) {
  const intervals = SCALE_DEFS[modeName];
  if (!intervals || intervals.length !== 7) return [];

  const triads = [];
  const degreeNames = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

  for (let d = 0; d < 7; d++) {
    // Root, third, fifth of triad (scale degrees d, d+2, d+4)
    const r = (rootPitchClass + intervals[d]) % 12;
    const t = (rootPitchClass + intervals[(d + 2) % 7]) % 12;
    const f = (rootPitchClass + intervals[(d + 4) % 7]) % 12;

    // Determine quality from interval between root and third
    const thirdInterval = (t - r + 12) % 12;
    const fifthInterval = (f - r + 12) % 12;

    let quality = '';
    if (thirdInterval === 4 && fifthInterval === 7) quality = '';        // major
    else if (thirdInterval === 3 && fifthInterval === 7) quality = 'm';  // minor
    else if (thirdInterval === 3 && fifthInterval === 6) quality = '°';  // diminished
    else if (thirdInterval === 4 && fifthInterval === 8) quality = '+';  // augmented

    const rootName = ROOT_NAMES[r];
    triads.push({
      label: `${degreeNames[d]} — ${rootName}${quality}`,
      notes: [r, t, f],
    });
  }
  return triads;
}

/**
 * Returns the semitone step sizes between consecutive scale degrees,
 * including the wrap-around step back to the next octave root.
 * @param {number[]} intervals  — sorted interval array from SCALE_DEFS
 * @returns {number[]}
 */
function getStepSizes(intervals) {
  const steps = [];
  for (let i = 0; i < intervals.length; i++) {
    const next = i + 1 < intervals.length ? intervals[i + 1] : 12;
    steps.push(next - intervals[i]);
  }
  return steps;
}

/**
 * Finds all (root, mode) combinations whose pitch-class set is identical
 * to the given scale, excluding the input scale itself.
 * @param {number} rootPitchClass
 * @param {string} modeName
 * @returns {Array<{rootName: string, modeName: string}>}
 */
function findRelatedScales(rootPitchClass, modeName) {
  const target = getScaleNotes(rootPitchClass, modeName);
  const results = [];
  for (let r = 0; r < 12; r++) {
    for (const mode of Object.keys(SCALE_DEFS)) {
      if (r === rootPitchClass && mode === modeName) continue;
      const candidate = getScaleNotes(r, mode);
      if (candidate.size === target.size && [...target].every(n => candidate.has(n))) {
        results.push({ rootName: ROOT_NAMES[r], modeName: mode });
      }
    }
  }
  return results.sort((a, b) => {
    const ra = ROOT_NAMES.indexOf(a.rootName);
    const rb = ROOT_NAMES.indexOf(b.rootName);
    return ra !== rb ? ra - rb : a.modeName.localeCompare(b.modeName);
  });
}

/**
 * Picks a random key and mode and returns everything the UI needs.
 * @param {string[]|null} enabledModes  Optional list of mode names to pick from.
 * @returns {{ rootPitchClass: number, rootName: string, modeName: string,
 *             scaleNotes: Set<number>, triads: Array }}
 */
function randomKeyAndMode(enabledModes = null) {
  const modeNames = (enabledModes && enabledModes.length > 0)
    ? enabledModes
    : Object.keys(SCALE_DEFS);
  const modeName  = modeNames[Math.floor(Math.random() * modeNames.length)];
  const rootPitchClass = Math.floor(Math.random() * 12);
  const rootName = ROOT_NAMES[rootPitchClass];
  const scaleNotes = getScaleNotes(rootPitchClass, modeName);
  const triads     = getDiatonicTriads(rootPitchClass, modeName);
  return { rootPitchClass, rootName, modeName, scaleNotes, triads };
}

/**
 * Picks one random triad from the triads array.
 * Falls back to a tonic triad placeholder when triads is empty (pentatonic/blues).
 * @param {Array<{label: string, notes: number[]}>} triads
 * @param {number} rootPitchClass  used for fallback
 * @returns {{ label: string, notes: number[] }}
 */
function pickRandomChord(triads, rootPitchClass = 0) {
  if (triads.length === 0) {
    return { label: `${ROOT_NAMES[rootPitchClass]} (root)`, notes: [rootPitchClass] };
  }
  return triads[Math.floor(Math.random() * triads.length)];
}
