<script lang="ts">
  import { SCALE_INFO } from '../lib/scales';
  import { audio } from '../state/audio.svelte';
  import { practice } from '../state/practice.svelte';
  import { quiz } from '../state/quiz.svelte';
  import { score } from '../state/score.svelte';

  let alias = $derived(SCALE_INFO[practice.modeName]?.alias ?? null);

  // Score ring reads the run in progress, falling back to the last graded run — except in quiz
  // mode, where the free-improv score is meaningless and the ring tracks notes found instead.
  let summary = $derived(score.liveSummary ?? score.lastSummary);
  let ringPct = $derived(
    quiz.active
      ? (practice.scaleNotes.size ? Math.round((quiz.foundNotes.size / practice.scaleNotes.size) * 100) : 0)
      : (summary ? (summary.score ?? Math.round(summary.accuracy * 100)) : null),
  );
  let ringText = $derived(
    quiz.active ? `${quiz.foundNotes.size}/${practice.scaleNotes.size}` : (ringPct ?? '—'),
  );
  let ringStyle = $derived(
    ringPct === null
      ? 'background: var(--track)'
      : `background: conic-gradient(var(--n-chord) 0 ${ringPct}%, var(--track) ${ringPct}% 100%)`,
  );
</script>

<section class="status-zone" aria-label="Current selection">
  <div class="scale-name-block">
    <span class="scale-name">{practice.rootName} {practice.modeName}</span>
    {#if alias}<span class="scale-alias">{alias}</span>{/if}
  </div>

  <div class="right">
    <div class="controller-status" aria-label="Pedal, mod wheel and pitch bend state">
      <span class="pedal-badge" class:active={audio.sustainDown} title="Sustain pedal">Sus</span>
      <span class="pedal-badge" class:active={audio.sostenutoDown} title="Sostenuto pedal">Sos</span>
      <span class="pedal-badge" class:active={audio.softDown} title="Soft pedal">Soft</span>
      <div class="wheel-meter" title="Mod wheel">
        <div class="wheel-meter-fill" style={`width: ${audio.modWheel * 100}%`}></div>
      </div>
      <div class="bend-meter" title="Pitch bend">
        <div class="bend-meter-center"></div>
        <div class="bend-meter-fill" style={`left: ${50 + audio.pitchBend * 50}%`}></div>
      </div>
    </div>
    <div class="score-ring" style={ringStyle} aria-label="Overall score">
      <div class="score-ring-inner"><span class="score-ring-num">{ringText}</span></div>
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

  .controller-status {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .pedal-badge {
    font: 700 0.68rem var(--font-body);
    color: var(--faint);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.15rem 0.4rem;
    line-height: 1.4;
  }

  .pedal-badge.active {
    color: var(--ink);
    border-color: var(--n-root);
    background: color-mix(in srgb, var(--n-root) 20%, transparent);
  }

  .wheel-meter,
  .bend-meter {
    position: relative;
    width: 36px;
    height: 6px;
    border-radius: 3px;
    background: var(--track);
    overflow: hidden;
  }

  .wheel-meter-fill {
    position: absolute;
    inset: 0 auto 0 0;
    height: 100%;
    background: var(--n-root);
    border-radius: 3px;
  }

  .bend-meter-center {
    position: absolute;
    left: 50%;
    top: 0;
    bottom: 0;
    width: 1px;
    background: var(--border);
  }

  .bend-meter-fill {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 3px;
    margin-left: -1.5px;
    background: var(--n-root);
    border-radius: 2px;
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
