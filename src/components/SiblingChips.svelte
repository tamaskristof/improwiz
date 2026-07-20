<script lang="ts">
  import type { Sibling } from '../lib/types';

  interface Props {
    siblings: Sibling[];
  }

  let { siblings }: Props = $props();
</script>

{#if siblings.length > 0}
  <div class="sibling-scales">
    <span class="label">Siblings</span>
    <div class="sibling-chips">
      {#each siblings as s (s.rootName + s.modeName)}
        <span class="sibling-chip">{s.rootName} {s.modeName} <span class="sibling-chip-change">{s.noteChange}</span></span>
      {/each}
    </div>
  </div>
{/if}

<style>
  .sibling-scales {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .label {
    font: 700 12px var(--font-body);
    color: var(--faint);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .sibling-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  .sibling-chip {
    font: 600 13px var(--font-body);
    letter-spacing: 0.03em;
    padding: 0.15em 0.6em;
    border-radius: 999px;
    border: 1px solid var(--border);
    color: var(--muted);
    background: color-mix(in srgb, var(--n-tension) 12%, transparent);
  }

  .sibling-chip-change {
    color: var(--n-tension);
    font-weight: 700;
    margin-left: 0.3em;
  }
</style>
