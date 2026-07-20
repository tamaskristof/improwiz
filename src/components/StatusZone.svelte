<script lang="ts">
  import { SCALE_INFO } from '../lib/scales';
  import { practice } from '../state/practice.svelte';
  import { score } from '../state/score.svelte';

  let alias = $derived(SCALE_INFO[practice.modeName]?.alias ?? null);

  // Score ring reads the run in progress, falling back to the last graded run.
  let summary = $derived(score.liveSummary ?? score.lastSummary);
  let ringValue = $derived(
    summary ? (summary.score ?? Math.round(summary.accuracy * 100)) : null,
  );
  let ringStyle = $derived(
    ringValue === null
      ? 'background: var(--track)'
      : `background: conic-gradient(var(--n-chord) 0 ${ringValue}%, var(--track) ${ringValue}% 100%)`,
  );
</script>

<section class="status-zone" aria-label="Current selection">
  <div class="scale-name-block">
    <span class="scale-name">{practice.rootName} {practice.modeName}</span>
    {#if alias}<span class="scale-alias">{alias}</span>{/if}
  </div>

  <div class="right">
    <div class="score-ring" style={ringStyle} aria-label="Overall score">
      <div class="score-ring-inner"><span class="score-ring-num">{ringValue ?? '—'}</span></div>
    </div>
  </div>
</section>

<style>
  .status-zone {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 13px 26px;
    border-bottom: 1px solid var(--border);
  }

  .scale-name-block {
    display: flex;
    align-items: baseline;
    gap: 14px;
    min-width: 0;
  }

  .scale-name {
    font: 700 46px var(--font-display);
    letter-spacing: -0.02em;
    line-height: 1;
  }

  .scale-alias {
    font: 600 14px var(--font-body);
    color: var(--muted);
  }

  .right {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 22px;
  }

  .score-ring {
    position: relative;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .score-ring-inner {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    background: var(--bg);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .score-ring-num {
    font: 700 16px var(--font-display);
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
</style>
