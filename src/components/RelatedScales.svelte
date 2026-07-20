<script lang="ts">
  import type { RelatedScale } from '../lib/types';

  interface Props {
    related: RelatedScale[];
  }

  let { related }: Props = $props();
</script>

{#if related.length > 0}
  <div class="related-scales">
    <span class="label">Related</span>
    <span class="related-scales-list">{related.map(r => `${r.rootName} ${r.modeName}`).join(' · ')}</span>
  </div>
{/if}

<style>
  .related-scales {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .label {
    font: 700 12px var(--font-body);
    color: var(--faint);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .related-scales-list {
    font: 600 15px var(--font-body);
    color: var(--muted);
    line-height: 1.4;
  }
</style>
