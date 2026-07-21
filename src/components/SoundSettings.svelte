<script lang="ts">
  import { audio, REVERB_SPACES, VELOCITY_LABELS, VELOCITY_OPTIONS } from '../state/audio.svelte';
</script>

<div class="sound-settings">
  <div class="field">
    <span class="field-label">Velocity layers</span>
    <div class="chip-options" role="radiogroup" aria-label="Velocity layers">
      {#each VELOCITY_OPTIONS as v (v)}
        <label class="chip" class:selected={audio.velocities === v}>
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

  <div class="field">
    <label class="field-label" for="volume">Volume</label>
    <input
      id="volume"
      class="slider"
      type="range"
      min="0"
      max="1"
      step="0.01"
      value={audio.volume}
      oninput={(e) => audio.setVolume(e.currentTarget.valueAsNumber)}
    />
    <p class="field-hint">
      The piano is deliberately quiet so chords stay clean. Turning this past halfway gets louder but
      starts to saturate dense chords.
    </p>
  </div>

  <div class="field">
    <span class="field-label">Reverb</span>
    <div class="chip-options" role="radiogroup" aria-label="Reverb space">
      {#each REVERB_SPACES as space (space.id)}
        <label class="chip" class:selected={audio.reverbSpace === space.id}>
          <input
            type="radio"
            name="reverb-space"
            value={space.id}
            checked={audio.reverbSpace === space.id}
            onchange={() => audio.setReverbSpace(space.id)}
          />
          {space.label}
        </label>
      {/each}
    </div>
    <label class="field-label amount-label" for="reverb-amount">Amount</label>
    <input
      id="reverb-amount"
      class="slider"
      type="range"
      min="0"
      max="1"
      step="0.01"
      value={audio.reverbAmount}
      disabled={audio.reverbSpace === 'off'}
      oninput={(e) => audio.setReverbAmount(e.currentTarget.valueAsNumber)}
    />
    <p class="field-hint">
      The space sets the size of the room; amount sets how much of it you hear.
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

  .chip-options {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
  }

  .chip {
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

  .chip.selected {
    color: var(--ink);
    border-color: var(--n-root);
  }

  .chip input[type="radio"] {
    accent-color: var(--n-root);
    cursor: pointer;
  }

  .slider {
    width: 100%;
    accent-color: var(--n-root);
    cursor: pointer;
  }

  .slider:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .amount-label {
    margin-top: 0.6rem;
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
