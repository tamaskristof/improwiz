<script lang="ts">
  import { ROOT_NAMES, getNoteRole, prettifyAccidental, type NoteRole } from '../lib/scales';
  import type { MidiNote, PitchClass } from '../lib/types';
  import { input } from '../state/input.svelte';
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
    onNoteOn: (midi: MidiNote) => void;
    onNoteOff: (midi: MidiNote) => void;
  }

  let { scaleNotes, rootPitchClass, characteristicNotes, pressedKeys, onNoteOn, onNoteOff }: Props = $props();

  function roleColor(role: NoteRole): string {
    return role === 'root'           ? 'var(--n-root)'
         : role === 'characteristic' ? 'var(--n-tension)'
         : role === 'scale'          ? 'var(--n-chord)'
         : 'transparent';
  }

  // The computer-keyboard base is always a C (see lib/computerKeys.ts), so its octave names it.
  let keyboardOctaveLabel = $derived(`C${Math.floor(input.keyboardOctaveBase / 12) - 1}`);

  function handleDown(e: MouseEvent, midi: MidiNote) {
    e.preventDefault();
    onNoteOn(midi);
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

  <div class="keyboard-strip" role="img" aria-label="Piano keyboard C2 to C7">
    {#each whites as key (key.midi)}
      {@const role = getNoteRole(key.pc, rootPitchClass, characteristicNotes, scaleNotes)}
      {@const held = pressedKeys.has(key.midi)}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="key white"
        style="left: {key.left}%; width: {key.width}%"
        onmousedown={(e) => handleDown(e, key.midi)}
        onmouseup={() => onNoteOff(key.midi)}
        onmouseleave={() => onNoteOff(key.midi)}
      >
        {#if key.isC}<span class="octave-label">{key.octaveLabel}</span>{/if}
        {#if held && role}
          <div class="fill held" style="background: {roleColor(role)}"><span class="held-label">{key.noteName}</span></div>
        {:else if role}
          <div class="fill cap" style="background: {roleColor(role)}"></div>
        {/if}
      </div>
    {/each}
    {#each blacks as key (key.midi)}
      {@const role = getNoteRole(key.pc, rootPitchClass, characteristicNotes, scaleNotes)}
      {@const held = pressedKeys.has(key.midi)}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="key black"
        style="left: {key.left}%; width: {key.width}%"
        onmousedown={(e) => handleDown(e, key.midi)}
        onmouseup={() => onNoteOff(key.midi)}
        onmouseleave={() => onNoteOff(key.midi)}
      >
        {#if held && role}
          <div class="fill held" style="background: {roleColor(role)}"><span class="held-label black-label">{key.noteName}</span></div>
        {:else if role}
          <div class="fill cap cap-black" style="background: {roleColor(role)}"></div>
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
