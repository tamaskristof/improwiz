<script lang="ts">
  import type { DiatonicChord } from '../lib/chords';
  import type { MidiNote, PitchClass } from '../lib/types';
  import { audio } from '../state/audio.svelte';
  import { input } from '../state/input.svelte';
  import { practice } from '../state/practice.svelte';
  import { quiz } from '../state/quiz.svelte';

  interface Props {
    /** Voiced MIDI notes to light on the keyboard (one instance from C3), or null to clear. */
    onHover: (notes: Set<MidiNote> | null) => void;
  }

  let { onHover }: Props = $props();

  // Stable per-chip identity, matching the {#each} key below.
  const chipKey = (chord: DiatonicChord) => chord.numeral + chord.label;

  // Quiz mode: naming every chord up front would hand over the whole scale, so the strip starts
  // blind — but a chip reveals itself the moment the player *plays that whole chord* (all of its
  // pitch classes held, nothing extra), the chord analogue of note-by-note reveal-on-hit. Exact
  // set-equality means partial/one-at-a-time presses don't count; the full chord does.
  $effect(() => {
    if (!quiz.active) return;
    const heldPcs = new Set([...input.pressedKeys].map(m => m % 12));
    for (const chord of practice.chords) {
      if (quiz.foundChords.has(chipKey(chord))) continue;
      const chordPcs = new Set(chord.notes);
      if (heldPcs.size === chordPcs.size && [...chordPcs].every(pc => heldPcs.has(pc))) {
        quiz.chordFound(chipKey(chord));
      }
    }
  });

  // A chip is hidden only while quiz is active *and* its chord hasn't been played yet.
  const isRevealed = (chord: DiatonicChord) => !quiz.active || quiz.foundChords.has(chipKey(chord));

  // Voice the chord in close position, with its root placed at the chord's own scale-degree
  // position *above the tonic* (tonic anchored in the C3 octave). Anchoring by degree rather
  // than by raw pitch class keeps the diatonic strip rising monotonically left-to-right:
  // otherwise a chord whose root pitch class sits below the tonic's (e.g. the C chord in D
  // Dorian) would drop an octave and jump backwards. Each upper note is then the next instance
  // of its pitch class above the previous one, so the stack stays a real close-position voicing.
  // Both the sounded chord (press) and the keyboard highlight (enter) use this, so what lights
  // is exactly what plays.
  function voice(notes: PitchClass[]): MidiNote[] {
    const tonic = practice.rootPitchClass;
    const degreeSemitones = ((notes[0] - tonic) % 12 + 12) % 12; // 0..11 above the tonic
    const voiced: MidiNote[] = [48 + tonic + degreeSemitones];
    for (const pc of notes.slice(1)) {
      const prev = voiced[voiced.length - 1];
      voiced.push(prev + ((pc - prev) % 12 + 12) % 12);
    }
    return voiced;
  }

  let sounding: MidiNote[] = [];

  // Pressing a chord is exploring, not playing: like the on-screen piano keys, it never
  // reaches recordNoteOn/recordNoteOff, so it can't inflate a run's score. Press-and-hold
  // sustains the chord until release — via Pointer Events, so it works identically for
  // mouse, touch, and pen (a plain mousedown/up never fires on a touchscreen).
  function press(chord: DiatonicChord, e: PointerEvent) {
    if (!isRevealed(chord)) return;
    // Suppress the native long-press artefacts on touch (text selection + the iOS/Android
    // callout menu) so a held chip just sounds the chord.
    e.preventDefault();
    release();
    // Capture the pointer so the eventual release still lands here even if the finger/cursor
    // drifts off the chip mid-hold — the chord sustains until the pointer actually lifts.
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    sounding = voice(chord.notes);
    for (const midi of sounding) audio.noteOn(midi, 0.7);
    onHover(new Set(sounding)); // light the same voicing on the keyboard while held
  }

  function release(e?: PointerEvent) {
    for (const midi of sounding) audio.noteOff(midi);
    sounding = [];
    // Touch/pen leave no lingering hover, so clear the keyboard highlight on release. For a
    // mouse the cursor is still over the chip, so the highlight persists until mouseleave —
    // keeping the old hover-preview behaviour.
    if (e && e.pointerType !== 'mouse') onHover(null);
  }

  function enter(chord: DiatonicChord) {
    if (isRevealed(chord)) onHover(new Set(voice(chord.notes)));
  }

  function leave() {
    onHover(null);
    release();
  }

  function isTonic(chord: DiatonicChord): boolean {
    return chord.notes[0] === practice.rootPitchClass;
  }
</script>

<section class="chord-strip" aria-label="Chords in the scale">
  <div class="head">
    <span class="eyebrow">Chords in the scale</span>
    <div class="voicing-toggle" role="group" aria-label="Chord voicing">
      <button
        class="voicing-option"
        class:active={practice.chordVoicing === 'triads'}
        aria-pressed={practice.chordVoicing === 'triads'}
        onclick={() => practice.setChordVoicing('triads')}
      >Triads</button>
      <button
        class="voicing-option"
        class:active={practice.chordVoicing === 'sevenths'}
        aria-pressed={practice.chordVoicing === 'sevenths'}
        onclick={() => practice.setChordVoicing('sevenths')}
      >7ths</button>
    </div>
    <div class="quality-legend" aria-hidden="true">
      <span class="legend-item"><span class="legend-swatch minor"></span>minor</span>
      <span class="legend-item"><span class="legend-swatch major"></span>major</span>
      <span class="legend-item"><span class="legend-swatch dim"></span>dim</span>
    </div>
  </div>

  {#if practice.chords.length === 0}
    <span class="empty">Pentatonic and blues scales skip degrees — no diatonic chords to stack.</span>
  {:else}
    <div class="chips" style="grid-template-columns: repeat({practice.chords.length}, 1fr)">
      {#each practice.chords as chord (chord.numeral + chord.label)}
        {@const revealed = isRevealed(chord)}
        <button
          class="chord-chip q-{chord.quality}"
          class:is-tonic={isTonic(chord)}
          class:masked={!revealed}
          disabled={!revealed}
          onmouseenter={() => enter(chord)}
          onmouseleave={leave}
          onpointerdown={(e) => press(chord, e)}
          onpointerup={release}
          onpointercancel={release}
          oncontextmenu={(e) => e.preventDefault()}
        >
          <span class="numeral">{revealed ? chord.numeral : '?'}</span>
          <span class="name">{revealed ? chord.label : '?'}</span>
        </button>
      {/each}
    </div>
  {/if}
</section>

<style>
  .chord-strip {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px 26px;
    border-bottom: 1px solid var(--border);
  }

  .head {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .quality-legend {
    margin-left: auto;
    display: flex;
    gap: 14px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 5px;
    font: 600 11px var(--font-body);
    color: var(--muted);
  }

  .legend-swatch {
    width: 9px;
    height: 9px;
    border-radius: 2px;
  }

  .legend-swatch.minor { background: var(--n-chord); }
  .legend-swatch.major { background: var(--ink); }
  .legend-swatch.dim   { background: var(--n-tension); }

  .eyebrow {
    font: 700 12px var(--font-body);
    color: var(--faint);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .voicing-toggle {
    display: flex;
    gap: 2px;
    padding: 2px;
    border-radius: 999px;
    background: var(--track);
  }

  .voicing-option {
    font: 700 11px var(--font-body);
    letter-spacing: 0.04em;
    padding: 0.2em 0.8em;
    border: none;
    border-radius: 999px;
    background: transparent;
    color: var(--faint);
    cursor: pointer;
  }

  .voicing-option.active {
    background: var(--bg);
    color: var(--ink);
  }

  /* Full-width row split into equal columns by hairline dividers, rather than wrapped
     pills — matches the annotation grid width above and reads as one row. */
  .chips {
    display: grid;
  }

  .chord-chip {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    padding: 0.5em 0.4em;
    border: none;
    border-left: 1px solid var(--border);
    border-top: 2px solid transparent;
    background: transparent;
    cursor: pointer;
    font-family: var(--font-body);
    /* Press-and-hold to sustain a chord: stop the browser claiming the gesture for scroll,
       text selection, or the long-press callout menu, so a held chip just sounds. */
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
  }

  .chord-chip:first-child {
    border-left: none;
  }

  .chord-chip:hover:not(:disabled) {
    background: color-mix(in srgb, var(--ink) 6%, transparent);
  }

  .chord-chip:disabled {
    cursor: default;
  }

  /* The tonic column carries a brass top accent, independent of the quality colour below. */
  .chord-chip.is-tonic {
    border-top-color: var(--primary);
  }

  .numeral {
    font: 700 11px var(--font-body);
    letter-spacing: 0.06em;
    color: var(--faint);
  }

  .chord-chip.is-tonic .numeral { color: var(--primary); }

  /* Chord name coloured by triad quality — the minor/major/dim legend in the head. Aug shares
     the major hue (major third); its '+' symbol carries the distinction. No fourth accent hue. */
  .name {
    font: 700 17px var(--font-display);
    line-height: 1.1;
    white-space: nowrap;
  }

  .q-minor .name { color: var(--n-chord); }
  .q-major .name,
  .q-aug   .name { color: var(--ink); }
  .q-dim   .name { color: var(--n-tension); }

  .chord-chip.masked .name { color: var(--faint); }

  .empty {
    font: 500 15px var(--font-body);
    color: var(--muted);
  }
</style>
