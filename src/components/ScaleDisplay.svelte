<script lang="ts">
  import { ROOT_NAMES, SCALE_DEFS, getStepSizes } from '../lib/scales';
  import type { Derivation, PitchClass, ScaleName } from '../lib/types';

  interface Props {
    rootPitchClass: PitchClass;
    modeName: ScaleName;
    derivation: Derivation | null;
  }

  let { rootPitchClass, modeName, derivation }: Props = $props();

  let intervals = $derived(SCALE_DEFS[modeName] ?? []);
  let characteristicIndices = $derived(new Set(derivation ? derivation.degreeIndices : []));
  let steps = $derived(getStepSizes(intervals));
</script>

<div class="scale-display">
  <span class="label">Scale</span>
  <div class="scale-grid-area">
    <div class="scale-notes-row">
      {#each intervals as interval, idx (idx)}<span class="scale-note-item" class:is-characteristic={characteristicIndices.has(idx)}>{ROOT_NAMES[(rootPitchClass + interval) % 12]}</span>{/each}
    </div>
    <div class="scale-steps-row">
      {#each steps as step, idx (idx)}<span class="scale-step-item">{step}</span>{/each}
    </div>
  </div>
</div>

<style>
  .scale-display {
    font-size: 1rem;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    gap: 0.5em;
  }

  .scale-grid-area {
    display: flex;
    flex-direction: column;
  }

  .scale-notes-row,
  .scale-steps-row {
    display: flex;
  }

  .scale-note-item {
    width: 2.4em;
    text-align: center;
    color: #b0bec5;
  }

  .scale-note-item.is-characteristic {
    color: var(--color-characteristic);
    font-weight: 700;
  }

  .scale-steps-row {
    padding-left: 1.2em; /* half of 2.4em — offsets steps to sit between notes */
  }

  .scale-step-item {
    width: 2.4em;
    text-align: center;
    font-size: 0.85rem;
    color: #606870;
    font-variant-numeric: tabular-nums;
  }

  .label {
    color: #78909c;
    font-weight: 600;
    text-transform: uppercase;
    font-size: 0.75rem;
    letter-spacing: 0.08em;
    align-self: center;
  }
</style>
