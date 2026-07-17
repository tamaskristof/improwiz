<script lang="ts">
  import { ROOT_NAMES, SCALE_INFO, formatDerivation } from '../lib/scales';
  import { practice } from '../state/practice.svelte';
  import FlavorCard from './FlavorCard.svelte';
  import RelatedScales from './RelatedScales.svelte';
  import RunScoreCard from './RunScoreCard.svelte';
  import ScaleDisplay from './ScaleDisplay.svelte';
  import ScaleSettings from './ScaleSettings.svelte';
  import SiblingChips from './SiblingChips.svelte';

  let alias = $derived(SCALE_INFO[practice.modeName]?.alias ?? null);
  // Hidden for the anchors (Ionian/Aeolian), which already show an alias.
  let derivationText = $derived(formatDerivation(practice.derivation));
  let chordNotesText = $derived(
    practice.chord.notes.length > 0
      ? `(${practice.chord.notes.map(pc => ROOT_NAMES[pc]).join(' – ')})`
      : '—',
  );
</script>

<section class="info-panel" aria-label="Current key and mode">
  <div class="key-mode-display">
    <span class="root-name">{practice.rootName}</span>
    <span class="mode-name">{practice.modeName}</span>
  </div>
  {#if alias}<div class="mode-alias">{alias}</div>{/if}
  {#if derivationText}<div class="mode-derivation">= {derivationText}</div>{/if}

  <ScaleDisplay
    rootPitchClass={practice.rootPitchClass}
    modeName={practice.modeName}
    derivation={practice.derivation}
  />

  <div class="chord-info">
    <span class="label">Chord:</span>
    <span class="chord-label">{practice.chord.label}</span>
    <span class="chord-notes">{chordNotesText}</span>
  </div>

  <FlavorCard modeName={practice.modeName} />

  <RelatedScales related={practice.related} />
  <SiblingChips siblings={practice.siblings} />

  <ScaleSettings />

  <RunScoreCard />

  <button class="randomize-btn" type="button" onclick={() => practice.randomize()}>Randomize</button>
</section>

<style>
  .info-panel {
    background: var(--color-panel-bg);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 1.5rem 2rem;
    text-align: center;
    width: 100%;
    max-width: 640px;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .key-mode-display {
    font-size: 2.8rem;
    font-weight: 800;
    color: #ffffff;
    letter-spacing: 0.04em;
    line-height: 1.1;
  }

  .key-mode-display .root-name {
    color: var(--color-root);
    margin-right: 0.3em;
  }

  .chord-info {
    font-size: 1rem;
    color: #b0bec5;
    display: flex;
    justify-content: center;
    gap: 0.5em;
    flex-wrap: wrap;
  }

  .chord-info .label {
    color: #78909c;
    font-weight: 600;
    text-transform: uppercase;
    font-size: 0.75rem;
    letter-spacing: 0.08em;
    align-self: center;
  }

  .chord-label {
    font-weight: 700;
    color: #e0e0e0;
  }

  .mode-alias,
  .mode-derivation {
    font-size: 0.85rem;
    color: #78909c;
    letter-spacing: 0.04em;
    margin-top: -0.3rem;
  }

  .randomize-btn {
    margin-top: 0.5rem;
    align-self: center;
    padding: 0.55rem 2rem;
    font-size: 1rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    border: none;
    border-radius: 6px;
    background: var(--color-root);
    color: #1a1a2e;
    cursor: pointer;
    transition: filter 0.15s;
  }

  .randomize-btn:hover  { filter: brightness(1.15); }
  .randomize-btn:active { filter: brightness(0.9); }
</style>
