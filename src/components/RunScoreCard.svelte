<script lang="ts">
  import { score } from '../state/score.svelte';
  import type { RunSummary } from '../lib/types';

  // Falls back to the last completed run's grade in the gap between a Randomize press
  // and the first note of the new run, so Randomize doesn't wipe the grade just earned.
  let view = $derived.by(() => {
    if (score.liveSummary) return { summary: score.liveSummary, label: score.currentLabel, heading: 'This run', isLive: true };
    if (score.lastSummary) return { summary: score.lastSummary, label: score.lastLabel, heading: 'Last run', isLive: false };
    return null;
  });

  // Spells out what moved the grade, so it doesn't read as an arbitrary letter.
  function detailText(summary: RunSummary): string {
    const detail = [`${summary.strayNotes} stray / ${summary.totalNotes} played`];
    if (summary.passingNotes > 0) {
      detail.push(`${summary.passingNotes} passing tone${summary.passingNotes === 1 ? '' : 's'}`);
    }
    detail.push(`${summary.degreesUsed} of ${summary.scaleSize} degrees`);
    if (summary.chordToneRatio !== null) {
      detail.push(`${Math.round(summary.chordToneRatio * 100)}% chord tones`);
    }
    if (!summary.graded) {
      detail.push(`${summary.notesToGrade} more note${summary.notesToGrade === 1 ? '' : 's'} for a grade`);
    }
    return detail.join(' · ');
  }
</script>

{#if view}
  <div class="run-score" class:is-live={view.isLive}>
    <div class="run-score-head">
      <span class="label">{view.heading}</span>
      <span class="run-score-live-dot" aria-hidden="true"></span>
      <span class="run-score-scale">{view.label ?? ''}</span>
      <span class="run-score-grade">{view.summary.grade ?? ''}</span>
    </div>
    <div class="run-score-accuracy"><span class="run-score-pct">{Math.round(view.summary.accuracy * 100)}%</span> in scale</div>
    <p class="run-score-detail">{detailText(view.summary)}</p>
  </div>
{/if}

<style>
  .run-score {
    border-top: 1px solid var(--color-border);
    padding-top: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    text-align: left;
  }

  .run-score-head {
    display: flex;
    align-items: center;
    gap: 0.5em;
  }

  .run-score-head .label {
    color: #78909c;
    font-weight: 600;
    text-transform: uppercase;
    font-size: 0.7rem;
    letter-spacing: 0.08em;
  }

  .run-score-scale {
    font-size: 0.9rem;
    color: #b0bec5;
    font-weight: 600;
  }

  /* Live indicator — only while the current run is being played */
  .run-score-live-dot {
    display: none;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--color-root);
    animation: mic-pulse 1.6s ease-in-out infinite;
  }

  .run-score.is-live .run-score-live-dot { display: inline-block; }

  .run-score-grade {
    margin-left: auto;
    font-size: 1.5rem;
    font-weight: 800;
    line-height: 1;
    color: var(--color-root);
    font-variant-numeric: tabular-nums;
  }

  .run-score-accuracy {
    font-size: 0.9rem;
    color: #90a4ae;
  }

  .run-score-pct {
    font-size: 1.5rem;
    font-weight: 700;
    color: #e0e0e0;
    margin-right: 0.15em;
    font-variant-numeric: tabular-nums;
  }

  .run-score-detail {
    font-size: 0.78rem;
    color: #607d8b;
    margin: 0;
    line-height: 1.5;
  }
</style>
