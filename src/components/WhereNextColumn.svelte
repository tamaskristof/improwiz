<script lang="ts">
  import { SCALE_INFO } from '../lib/scales';
  import { practice } from '../state/practice.svelte';
  import RelatedScales from './RelatedScales.svelte';
  import SiblingChips from './SiblingChips.svelte';

  let tip = $derived(SCALE_INFO[practice.modeName]?.tip ?? null);
</script>

<div class="column next-column">
  <span class="eyebrow">Where to go next</span>

  <RelatedScales related={practice.related} />
  <SiblingChips siblings={practice.siblings} />

  {#if tip}
    <div class="hairline"></div>
    <span class="coach"><b class="coach-tag">Coach:</b> {tip}</span>
  {/if}
</div>

<style>
  .column {
    padding: 16px 26px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    text-align: left;
    min-width: 0;
  }

  .eyebrow {
    font: 700 12px var(--font-body);
    color: var(--faint);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .hairline {
    height: 1px;
    background: var(--border);
    margin: 2px 0;
  }

  .coach {
    font: 500 15px/1.4 var(--font-body);
    color: var(--muted);
  }

  .coach-tag {
    color: var(--ink);
  }
</style>
