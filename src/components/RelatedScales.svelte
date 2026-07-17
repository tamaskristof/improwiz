<script lang="ts">
  import type { RelatedScale } from '../lib/types';

  interface Props {
    related: RelatedScale[];
  }

  let { related }: Props = $props();
</script>

{#if related.length > 0}
  <div class="related-scales">
    <span class="label">Also:</span>
    <span class="related-scales-list">{related.map(r => `${r.rootName} ${r.modeName}`).join(', ')}</span>
  </div>
{/if}

<style>
  .related-scales {
    font-size: 0.9rem;
    color: #b0bec5;
    display: flex;
    justify-content: center;
    gap: 0.5em;
    flex-wrap: wrap;
  }

  .related-scales-list {
    color: #78909c;
    font-size: 0.85rem;
  }
</style>
