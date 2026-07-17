// src/state/score.svelte.ts — live/last-run score summaries

import { endRun, getRunScore, hasHeldNotes, startRun } from '../lib/tracker';
import type { RunContext, RunSummary } from '../lib/types';

/**
 * The card tracks the run in progress. Between a Randomize press and the first note
 * of the new run there's nothing live to show, so it falls back to the run that just
 * ended — otherwise hitting Randomize would wipe the grade you just earned.
 */
class ScoreState {
  currentLabel = $state<string | null>(null);
  liveSummary = $state<RunSummary | null>(null);
  lastSummary = $state<RunSummary | null>(null);
  lastLabel   = $state<string | null>(null);

  /** Re-reads the run in progress — call after any note event or on the held-note tick. */
  refresh(): void {
    this.liveSummary = getRunScore();
  }

  /**
   * Banks the previous run (only if it reached a grade — a stray note or two
   * shouldn't leave a bogus letter up) and starts a fresh one.
   */
  beginRun(label: string, context: RunContext): void {
    const finished = endRun();
    this.lastSummary = finished && finished.graded ? finished : null;
    this.lastLabel   = this.currentLabel;

    this.currentLabel = label;
    startRun(context);
    this.refresh();
  }
}

export const score = new ScoreState();

// Note events cover most of the card's movement, but a note being *held* keeps changing
// the duration-weighted score with no event to hang off — so tick while keys are down.
setInterval(() => { if (hasHeldNotes()) score.refresh(); }, 250);
