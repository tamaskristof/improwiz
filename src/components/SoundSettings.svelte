<script lang="ts">
  import { audio, VELOCITY_LABELS, VELOCITY_OPTIONS } from '../state/audio.svelte';
</script>

<div class="sound-settings">
  <div class="field">
    <span class="field-label">Velocity layers</span>
    <div class="velocity-options" role="radiogroup" aria-label="Velocity layers">
      {#each VELOCITY_OPTIONS as v (v)}
        <label class="velocity-option" class:selected={audio.velocities === v}>
          <input
            type="radio"
            name="velocities"
            value={v}
            checked={audio.velocities === v}
            onchange={() => audio.setVelocities(v)}
          />
          {VELOCITY_LABELS[v]}
        </label>
      {/each}
    </div>
    <p class="field-hint">
      More layers = the piano responds to how hard you play, at the cost of a larger sample download.
      {#if !audio.loaded}<span class="loading">Loading samples…</span>{/if}
    </p>
  </div>
</div>

<style>
  .sound-settings {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    text-align: left;
  }

  .field-label {
    display: block;
    font: 700 0.85rem var(--font-body);
    color: var(--ink);
    margin-bottom: 0.5rem;
  }

  .velocity-options {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
  }

  .velocity-option {
    display: inline-flex;
    align-items: center;
    gap: 0.35em;
    font: 500 0.9rem var(--font-body);
    color: var(--muted);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 0.3rem 0.6rem;
    cursor: pointer;
  }

  .velocity-option.selected {
    color: var(--ink);
    border-color: var(--n-root);
  }

  .velocity-option input[type="radio"] {
    accent-color: var(--n-root);
    cursor: pointer;
  }

  .field-hint {
    font: 500 0.75rem var(--font-body);
    color: var(--faint);
    margin-top: 0.5rem;
  }

  .loading {
    color: var(--muted);
    font-style: italic;
  }
</style>
