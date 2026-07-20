<script lang="ts">
  import { identifyChord } from '../lib/chords';
  import { input } from '../state/input.svelte';

  // Reactive read of the SvelteSet — recomputes on every press/release.
  let held = $derived([...input.pressedKeys]);
  let pcs = $derived(held.map(m => m % 12));
  let bassPc = $derived(held.length ? Math.min(...held) % 12 : undefined);
  let chord = $derived(identifyChord(pcs, bassPc));
</script>

<div class="chord-display" aria-live="polite">
  <span class="chord-label">Playing</span>
  {#if chord}
    <span class="chord-name" class:partial={!chord.full}>{chord.label}</span>
  {:else}
    <span class="chord-name empty">—</span>
  {/if}
</div>

<style>
  .chord-display {
    display: flex;
    align-items: baseline;
    gap: 10px;
    min-width: 0;
  }

  .chord-label {
    font: 700 10px var(--font-body);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--faint);
  }

  .chord-name {
    font: 700 22px var(--font-display);
    line-height: 1;
    color: var(--n-root);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Partial (1–2 notes or unrecognized) reads as tentative. */
  .chord-name.partial {
    color: var(--muted);
    font-weight: 600;
  }

  .chord-name.empty {
    color: var(--faint);
  }
</style>
