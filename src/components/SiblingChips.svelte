<script lang="ts">
  import type { Sibling } from '../lib/types';

  interface Props {
    siblings: Sibling[];
  }

  let { siblings }: Props = $props();
</script>

{#if siblings.length > 0}
  <div class="sibling-scales">
    <span class="label">Siblings:</span>
    <div class="sibling-chips">
      {#each siblings as s (s.rootName + s.modeName)}
        <span class="sibling-chip">{s.rootName} {s.modeName} <span class="sibling-chip-change">{s.noteChange}</span></span>
      {/each}
    </div>
  </div>
{/if}

<style>
  .sibling-scales {
    font-size: 0.9rem;
    color: #b0bec5;
    display: flex;
    justify-content: center;
    align-items: baseline;
    gap: 0.5em;
    flex-wrap: wrap;
  }

  .sibling-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  .sibling-chip {
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.03em;
    padding: 0.15em 0.6em;
    border-radius: 999px;
    border: 1px solid var(--color-border);
    color: #90a4ae;
    background: rgba(176, 106, 217, 0.12);
  }

  .sibling-chip-change {
    color: var(--color-characteristic);
    font-weight: 700;
    margin-left: 0.3em;
  }
</style>
