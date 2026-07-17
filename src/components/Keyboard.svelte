<script lang="ts">
  import type { MidiNote, PitchClass } from '../lib/types';

  // MIDI range 36–96, i.e. C2–C7.
  const MIDI_LOW  = 36;
  const MIDI_HIGH = 96;

  // Key geometry (px)
  const W_W = 34;   // white key width
  const W_H = 160;  // white key height
  const B_W = 22;   // black key width
  const B_H = 100;  // black key height

  const IS_BLACK = new Set([1, 3, 6, 8, 10]);

  interface KeyGeom {
    midi: MidiNote;
    pc: PitchClass;
    x: number;
    width: number;
    height: number;
  }

  function buildGeometry() {
    const whiteKeys: KeyGeom[] = [];
    const blackKeys: KeyGeom[] = [];

    // Pass 1: white keys, left to right.
    let whiteIndex = 0;
    for (let midi = MIDI_LOW; midi <= MIDI_HIGH; midi++) {
      const pc = midi % 12;
      if (IS_BLACK.has(pc)) continue;
      whiteKeys.push({ midi, pc, x: whiteIndex * W_W, width: W_W - 1, height: W_H }); // 1px gap between white keys
      whiteIndex++;
    }

    // Pass 2: black keys, positioned relative to the preceding white key so they
    // visually overlap the white boundary. Rendered after white keys so they sit on top.
    whiteIndex = 0;
    for (let midi = MIDI_LOW; midi <= MIDI_HIGH; midi++) {
      const pc = midi % 12;
      if (IS_BLACK.has(pc)) {
        const prevWhiteX = (whiteIndex - 1) * W_W;
        const x = prevWhiteX + W_W - Math.floor(B_W / 2);
        blackKeys.push({ midi, pc, x, width: B_W, height: B_H });
      } else {
        whiteIndex++;
      }
    }

    return { whiteKeys, blackKeys, svgWidth: whiteIndex * W_W, svgHeight: W_H };
  }

  const { whiteKeys, blackKeys, svgWidth, svgHeight } = buildGeometry();

  interface Props {
    scaleNotes: Set<PitchClass>;
    rootPitchClass: PitchClass;
    characteristicNotes: Set<PitchClass>;
    pressedKeys: Set<MidiNote>;
    onNoteOn: (midi: MidiNote) => void;
    onNoteOff: (midi: MidiNote) => void;
  }

  let { scaleNotes, rootPitchClass, characteristicNotes, pressedKeys, onNoteOn, onNoteOff }: Props = $props();

  function handleDown(e: MouseEvent, midi: MidiNote) {
    e.preventDefault();
    onNoteOn(midi);
  }
</script>

<section class="keyboard-section" aria-label="Piano keyboard">
  <div class="keyboard-container">
    <svg
      viewBox="0 0 {svgWidth} {svgHeight}"
      width={svgWidth}
      height={svgHeight}
      role="img"
      aria-label="Piano keyboard C2 to C7"
    >
      {#each whiteKeys as key (key.midi)}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <rect
          x={key.x} y={0} width={key.width} height={key.height} rx={2}
          class="key white"
          class:is-scale={scaleNotes.has(key.pc)}
          class:is-root={key.pc === rootPitchClass}
          class:is-characteristic={characteristicNotes.has(key.pc)}
          class:is-pressed={pressedKeys.has(key.midi)}
          style="cursor: pointer"
          onmousedown={(e) => handleDown(e, key.midi)}
          onmouseup={() => onNoteOff(key.midi)}
          onmouseleave={() => onNoteOff(key.midi)}
        />
      {/each}
      {#each blackKeys as key (key.midi)}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <rect
          x={key.x} y={0} width={key.width} height={key.height} rx={2}
          class="key black"
          class:is-scale={scaleNotes.has(key.pc)}
          class:is-root={key.pc === rootPitchClass}
          class:is-characteristic={characteristicNotes.has(key.pc)}
          class:is-pressed={pressedKeys.has(key.midi)}
          style="cursor: pointer"
          onmousedown={(e) => handleDown(e, key.midi)}
          onmouseup={() => onNoteOff(key.midi)}
          onmouseleave={() => onNoteOff(key.midi)}
        />
      {/each}
    </svg>
  </div>
</section>

<style>
  .keyboard-section {
    width: 100%;
    overflow-x: auto;
    display: flex;
    justify-content: center;
  }

  .keyboard-container svg {
    display: block;
  }

  /* White keys — base */
  .key.white { fill: var(--white-key-bg); stroke: #888; stroke-width: 1; }

  /* Black keys — base */
  .key.black { fill: var(--black-key-bg); stroke: #333; stroke-width: 1; }

  /* Scale highlight */
  .key.white.is-scale { fill: color-mix(in srgb, var(--color-scale) 30%, var(--white-key-bg)); }
  .key.black.is-scale { fill: color-mix(in srgb, var(--color-scale) 55%, var(--black-key-bg)); }

  /* Characteristic note — the degree that differs from the closest known scale.
     Needs the .white/.black qualifier to match .is-scale's (0,3,0) specificity,
     and must come after .is-scale so it wins on a note that's both. */
  .key.white.is-characteristic { fill: color-mix(in srgb, var(--color-characteristic) 45%, var(--white-key-bg)); }
  .key.black.is-characteristic { fill: color-mix(in srgb, var(--color-characteristic) 65%, var(--black-key-bg)); }

  /* Root — always overrides scale tint */
  .key.is-root { fill: var(--color-root) !important; }

  /* Pressed state — always brightest */
  .key.is-pressed { fill: var(--color-pressed) !important; filter: drop-shadow(0 0 6px #fffde7cc); }
</style>
