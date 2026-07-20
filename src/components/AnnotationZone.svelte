<script lang="ts">
  import ScaleIdentityColumn from './ScaleIdentityColumn.svelte';
  import ScaleNotesColumn from './ScaleNotesColumn.svelte';
  import WhereNextColumn from './WhereNextColumn.svelte';
</script>

<section class="annotation-zone" aria-label="Scale details">
  <ScaleNotesColumn />
  <ScaleIdentityColumn />
  <WhereNextColumn />
</section>

<style>
  .annotation-zone {
    flex-shrink: 0;
    display: grid;
    grid-template-columns: 300px 1fr 320px;
    border-bottom: 1px solid var(--border);
  }
</style>
