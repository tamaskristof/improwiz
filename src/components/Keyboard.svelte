<script lang="ts">
  import { ROOT_NAMES, getNoteRole, prettifyAccidental, type NoteRole } from '../lib/scales';
  import type { MidiNote, PitchClass } from '../lib/types';
  import { input } from '../state/input.svelte';
  import { quiz } from '../state/quiz.svelte';
  import ChordDisplay from './ChordDisplay.svelte';

  // MIDI range 36–96, i.e. C2–C7 (unchanged from the SVG version).
  const MIDI_LOW  = 36;
  const MIDI_HIGH = 96;

  const IS_BLACK = new Set([1, 3, 6, 8, 10]);

  interface KeyGeom {
    midi: MidiNote;
    pc: PitchClass;
    left: number;   // % from left edge of the strip
    width: number;  // % of strip width
    isC: boolean;
    octaveLabel: string; // e.g. "C4", only meaningful on C keys
    noteName: string;    // prettified letter name shown when held
  }

  // Full-width geometry: white keys are equal-width flex-style columns, black
  // keys are absolutely positioned on top at each white boundary (v5 §4).
  function buildGeometry() {
    const whites: KeyGeom[] = [];
    const blacks: KeyGeom[] = [];

    let whiteCount = 0;
    for (let midi = MIDI_LOW; midi <= MIDI_HIGH; midi++) {
      if (!IS_BLACK.has(midi % 12)) whiteCount++;
    }
    const whiteW = 100 / whiteCount;
    const blackW = whiteW * 0.62;

    let placed = 0; // whites placed so far — also the boundary for the next black
    for (let midi = MIDI_LOW; midi <= MIDI_HIGH; midi++) {
      const pc = midi % 12;
      const octave = Math.floor(midi / 12) - 1;
      const meta = {
        midi, pc,
        isC: pc === 0,
        octaveLabel: `C${octave}`,
        noteName: prettifyAccidental(ROOT_NAMES[pc]),
      };
      if (IS_BLACK.has(pc)) {
        blacks.push({ ...meta, left: placed * whiteW - blackW / 2, width: blackW });
      } else {
        whites.push({ ...meta, left: placed * whiteW, width: whiteW });
        placed++;
      }
    }
    return { whites, blacks };
  }

  const { whites, blacks } = buildGeometry();

  interface Props {
    scaleNotes: Set<PitchClass>;
    rootPitchClass: PitchClass;
    characteristicNotes: Set<PitchClass>;
    pressedKeys: Set<MidiNote>;
    /** MIDI notes to light at full saturation — one voicing of a chord previewed from the strip
     *  above. While any are set, every other resting fill drops to a whisper. */
    highlightNotes?: Set<MidiNote>;
    onNoteOn: (midi: MidiNote) => void;
    onNoteOff: (midi: MidiNote) => void;
  }

  let {
    scaleNotes, rootPitchClass, characteristicNotes, pressedKeys,
    highlightNotes, onNoteOn, onNoteOff,
  }: Props = $props();

  // Suppressed in quiz mode: lighting a chord's notes would reveal scale tones the
  // player is meant to be hunting for.
  let highlighted = $derived(quiz.active ? new Set<MidiNote>() : (highlightNotes ?? new Set()));
  // While a chord is previewed, resting role fills drop to a whisper so only the voiced chord reads.
  let previewing = $derived(highlighted.size > 0);

  // A held note outside the scale gets the neutral --n-avoid grey rather than a fourth accent hue
  // (app.css forbids one) — it reads as "off the map", not as an error. Only ever seen on `.held`;
  // the unheld `.cap` branch is gated on `role` being non-null.
  function roleColor(role: NoteRole): string {
    return role === 'root'           ? 'var(--n-root)'
         : role === 'characteristic' ? 'var(--n-tension)'
         : role === 'scale'          ? 'var(--n-chord)'
         : 'var(--n-avoid)';
  }

  // The computer-keyboard base is always a C (see lib/computerKeys.ts), so its octave names it.
  let keyboardOctaveLabel = $derived(`C${Math.floor(input.keyboardOctaveBase / 12) - 1}`);

  // Quiz mode's reveal-on-hit: mark a scale pitch class "found" the moment it's held, from any
  // input source (MIDI, computer keyboard, mouse) — they all flow through pressedKeys alike.
  $effect(() => {
    if (!quiz.active) return;
    for (const midi of pressedKeys) {
      const pc = midi % 12;
      if (scaleNotes.has(pc)) quiz.noteFound(pc);
    }
  });

  // Pointer events unify mouse + touch + pen in one path. Capturing the pointer on down means the
  // matching up/cancel is guaranteed to fire on this same key element even if the finger drifts off it,
  // so the note always releases (the emulated-mouse path couldn't guarantee that — press-and-hold on
  // touch dropped a stray note-off). Each finger is a distinct pointerId captured by its own key, so
  // multiple keys sound at once (multi-touch chords).
  function handlePointerDown(e: PointerEvent, midi: MidiNote) {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    onNoteOn(midi);
  }

  function handlePointerUp(midi: MidiNote) {
    onNoteOff(midi);
  }
</script>

<section class="keyboard-section" aria-label="Piano keyboard">
  <div class="keyboard-header">
    <ChordDisplay />
    <div class="legend">
      <span class="legend-item" title="Play with your computer keyboard: Z X C V B N M and Q W E R T Y U">
        ⌨ {keyboardOctaveLabel}<span class="legend-hint">− / = octave</span>
      </span>
      <span class="legend-item"><span class="legend-swatch" style="background: var(--n-root)"></span>Root</span>
      <span class="legend-item"><span class="legend-swatch" style="background: var(--n-tension)"></span>Characteristic</span>
      <span class="legend-item"><span class="legend-swatch" style="background: var(--n-chord)"></span>Scale</span>
    </div>
  </div>

  <!-- Suppress the long-press context menu / text-selection popup on touch (Android Chrome fires a
       contextmenu event on long-press that touch-action/user-select don't cover). -->
  <div
    class="keyboard-strip"
    role="img"
    aria-label="Piano keyboard C2 to C7"
    oncontextmenu={(e) => e.preventDefault()}
  >
    {#each whites as key (key.midi)}
      {@const role = getNoteRole(key.pc, rootPitchClass, characteristicNotes, scaleNotes)}
      {@const held = pressedKeys.has(key.midi)}
      {@const previewed = highlighted.has(key.midi)}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="key white"
        style="left: {key.left}%; width: {key.width}%"
        onpointerdown={(e) => handlePointerDown(e, key.midi)}
        onpointerup={() => handlePointerUp(key.midi)}
        onpointercancel={() => handlePointerUp(key.midi)}
      >
        {#if key.isC}<span class="octave-label">{key.octaveLabel}</span>{/if}
        {#if held}
          <div class="fill held" class:avoid={!role} style="background: {roleColor(role)}"><span class="held-label">{key.noteName}</span></div>
        {:else if previewed}
          <div class="fill preview" class:avoid={!role} style="background: {roleColor(role)}"><span class="held-label">{key.noteName}</span></div>
        {:else if role && (!quiz.active || quiz.foundNotes.has(key.pc))}
          <div class="fill cap" class:dimmed={previewing} style="background: {roleColor(role)}"></div>
        {/if}
      </div>
    {/each}
    {#each blacks as key (key.midi)}
      {@const role = getNoteRole(key.pc, rootPitchClass, characteristicNotes, scaleNotes)}
      {@const held = pressedKeys.has(key.midi)}
      {@const previewed = highlighted.has(key.midi)}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="key black"
        style="left: {key.left}%; width: {key.width}%"
        onpointerdown={(e) => handlePointerDown(e, key.midi)}
        onpointerup={() => handlePointerUp(key.midi)}
        onpointercancel={() => handlePointerUp(key.midi)}
      >
        {#if held}
          <div class="fill held" class:avoid={!role} style="background: {roleColor(role)}"><span class="held-label black-label">{key.noteName}</span></div>
        {:else if previewed}
          <div class="fill preview" class:avoid={!role} style="background: {roleColor(role)}"><span class="held-label black-label">{key.noteName}</span></div>
        {:else if role && (!quiz.active || quiz.foundNotes.has(key.pc))}
          <div class="fill cap cap-black" class:dimmed={previewing} style="background: {roleColor(role)}"></div>
        {/if}
      </div>
    {/each}
  </div>
</section>

<style>
  .keyboard-section {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    justify-content: flex-end; /* keyboard pinned to the bottom edge */
  }

  .keyboard-header {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    padding: 0 24px 6px;
  }

  .legend {
    display: flex;
    gap: 16px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 5px;
    font: 600 11px var(--font-body);
    color: var(--muted);
  }

  .legend-hint {
    color: var(--faint);
    font-weight: 600;
  }

  .legend-swatch {
    width: 9px;
    height: 9px;
    border-radius: 2px;
  }

  /* Full-bleed strip: edge-to-edge, no outer margin/padding, hairline top only. */
  .keyboard-strip {
    flex-shrink: 0;
    position: relative;
    height: 155px;
    width: 100%;
    border-top: 1px solid var(--border);
  }

  .key {
    position: absolute;
    top: 0;
    height: 100%;
    box-sizing: border-box;
    cursor: pointer;
    /* Touch: never treat a press as scroll/pinch (also kills tap-delay + synthetic mouse events),
       and never let a held key select text or raise the iOS long-press callout. */
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
  }

  .key.white {
    background: var(--key-white);
    border-right: 1px solid var(--key-border);
  }

  .key.black {
    height: 62%;
    background: var(--key-black);
    border-radius: 0 0 4px 4px;
    z-index: 3;
  }

  /* Role coloring is fully edge-to-edge — no rounded insets or padding. */
  .fill {
    position: absolute;
    inset: 0;
  }

  .cap { opacity: 0.55; }
  .cap-black { opacity: 0.7; }

  /* Chord preview from the strip: the voiced chord (one instance from C4) reads at full
     saturation while every other resting fill drops to a whisper, so only the chord stands out.
     The preview fill uses the same role colour + note label as a held key — the difference is
     it's driven by hover, not a keypress. */
  .cap.dimmed { opacity: 0.07; }

  .preview {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding-bottom: 10px;
    z-index: 5;
  }

  .black .preview { padding-bottom: 8px; }

  /* Out-of-scale: present and readable, but quieter than a scale tone so it never out-shouts the
     colouring you're actually practising against. */
  .held.avoid { opacity: 0.8; }

  .held {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding-bottom: 10px;
  }

  .held-label {
    color: #fff;
    font: 700 14px var(--font-display);
  }

  .black .held { padding-bottom: 8px; }
  .black-label { font-size: 10px; }

  .octave-label {
    position: absolute;
    top: 6px;
    left: 50%;
    transform: translateX(-50%);
    font: 700 10px var(--font-body);
    color: var(--faint);
    z-index: 4;
    pointer-events: none;
  }
</style>
