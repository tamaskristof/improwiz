// src/state/quiz.svelte.ts — "Find the Scale" quiz mode: blind keyboard, reveal-on-hit

import type { PitchClass } from '../lib/types';

class QuizState {
  active = $state(false);
  foundNotes = $state<Set<PitchClass>>(new Set());
  /** Diatonic chords the player has played whole, keyed by the strip's chip key. */
  foundChords = $state<Set<string>>(new Set());

  setActive(active: boolean): void {
    if (this.active === active) return;
    this.active = active;
    this.reset();
  }

  /** No-op when inactive or already found — called from Keyboard's held-key effect. */
  noteFound(pc: PitchClass): void {
    if (!this.active || this.foundNotes.has(pc)) return;
    this.foundNotes = new Set(this.foundNotes).add(pc);
  }

  /** No-op when inactive or already found — called when a whole diatonic chord is held. */
  chordFound(key: string): void {
    if (!this.active || this.foundChords.has(key)) return;
    this.foundChords = new Set(this.foundChords).add(key);
  }

  /** Called on every "next scale" (the run boundary), active or not. */
  reset(): void {
    this.foundNotes = new Set();
    this.foundChords = new Set();
  }
}

export const quiz = new QuizState();
