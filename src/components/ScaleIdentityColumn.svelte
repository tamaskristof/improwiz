<script lang="ts">
  import { SCALE_INFO } from '../lib/scales';
  import { practice } from '../state/practice.svelte';
  import { quiz } from '../state/quiz.svelte';
  import { score } from '../state/score.svelte';

  let feel = $derived(SCALE_INFO[practice.modeName]?.feel ?? '');

  // Real run metrics (v5's Resolution/Rhythm/Phrasing have no engine yet; these
  // are the tracker fields that actually exist). Percent, or null before there's
  // anything to grade.
  let summary = $derived(score.liveSummary ?? score.lastSummary);

  // In quiz mode the free-improv accuracy metrics don't mean anything — you're
  // deliberately testing wrong notes — so swap the whole grid for one readout.
  let metrics = $derived(
    quiz.active
      ? [{
          label: 'Notes found',
          pct: practice.scaleNotes.size ? Math.round((quiz.foundNotes.size / practice.scaleNotes.size) * 100) : 0,
          text: `${quiz.foundNotes.size} / ${practice.scaleNotes.size}`,
        }]
      : [
          { label: 'In-key', pct: summary ? Math.round(summary.accuracy * 100) : null, text: null },
          { label: 'Variety', pct: summary ? Math.round(summary.varietyRatio * 100) : null, text: null },
          { label: 'Coverage', pct: summary ? Math.round((summary.degreesUsed / summary.scaleSize) * 100) : null, text: null },
        ],
  );
</script>

<div class="column identity-column">
  <span class="eyebrow">Scale identity · score</span>
  <div class="body">
    <span class="feel">{feel}</span>
    <div class="metrics">
      {#each metrics as m (m.label)}
        <div class="metric">
          <div class="metric-head">
            <span>{m.label}</span>
            <span class="metric-val">{m.text ?? m.pct ?? '—'}</span>
          </div>
          <div class="metric-track"><div class="metric-fill" style="width: {m.pct ?? 0}%"></div></div>
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .column {
    padding: 16px 26px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    text-align: left;
  }

  .identity-column {
    border-right: 1px solid var(--border);
  }

  .eyebrow {
    font: 700 12px var(--font-body);
    color: var(--faint);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .body {
    display: flex;
    align-items: flex-start;
    gap: 28px;
  }

  .feel {
    font: 500 16px/1.5 var(--font-body);
    color: var(--muted);
    max-width: 340px;
    flex-shrink: 0;
  }

  .metrics {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 24px;
  }

  .metric {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .metric-head {
    display: flex;
    justify-content: space-between;
    font: 600 14px var(--font-body);
  }

  .metric-val {
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }

  .metric-track {
    height: 5px;
    border-radius: 99px;
    background: var(--track);
  }

  .metric-fill {
    height: 100%;
    border-radius: 99px;
    background: var(--meter);
    transition: width 0.25s;
  }
</style>
