// src/state/practice.svelte.ts — current key/mode selection, scale settings, randomize()

import {
  DEFAULT_ENABLED_SCALES,
  SCALE_DEFS,
  SCALE_FAMILIES,
  findRelatedScales,
  getDerivation,
  getSiblings,
  randomKeyAndMode,
} from '../lib/scales';
import { score } from './score.svelte';
import type {
  Derivation,
  PitchClass,
  RelatedScale,
  ScaleName,
  Sibling,
} from '../lib/types';

const LS_KEY = 'improwiz_enabled_scales';

function loadEnabledScales(): ScaleName[] {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY) ?? 'null');
    if (Array.isArray(saved) && saved.length > 0) return saved;
  } catch {
    // fall through to default
  }
  return DEFAULT_ENABLED_SCALES;
}

class PracticeState {
  enabledScales = $state<ScaleName[]>(loadEnabledScales());

  rootPitchClass    = $state<PitchClass>(0);
  rootName          = $state('—');
  modeName          = $state<ScaleName>('—');
  scaleNotes        = $state<Set<PitchClass>>(new Set());
  derivation        = $state<Derivation | null>(null);
  characteristicNotes = $state<Set<PitchClass>>(new Set());
  siblings          = $state<Sibling[]>([]);
  related           = $state<RelatedScale[]>([]);

  isEnabled(name: ScaleName): boolean {
    return this.enabledScales.includes(name);
  }

  /** True when `name` is the sole enabled scale left — the UI disables its checkbox so it can't be unchecked. */
  isOnlyEnabled(name: ScaleName): boolean {
    return this.enabledScales.length === 1 && this.enabledScales[0] === name;
  }

  setModeEnabled(name: ScaleName, enabled: boolean): void {
    if (this.isEnabled(name) === enabled) return;
    if (!enabled && this.enabledScales.length === 1) return; // at least one scale must stay enabled
    this.enabledScales = enabled
      ? [...this.enabledScales, name]
      : this.enabledScales.filter(n => n !== name);
    this.save();
  }

  setFamilyEnabled(family: string, enabled: boolean): void {
    const names = SCALE_FAMILIES[family];
    if (enabled) {
      this.enabledScales = [...new Set([...this.enabledScales, ...names])];
    } else {
      const remaining = this.enabledScales.filter(n => !names.includes(n));
      if (remaining.length === 0) return; // would disable every scale — refuse
      this.enabledScales = remaining;
    }
    this.save();
  }

  private save(): void {
    localStorage.setItem(LS_KEY, JSON.stringify(this.enabledScales));
  }

  /** Randomize is the run boundary: bank what was just played, then start fresh. */
  randomize(): void {
    const { rootPitchClass, rootName, modeName, scaleNotes } =
      randomKeyAndMode(this.enabledScales);

    const intervals = SCALE_DEFS[modeName];
    const derivation = getDerivation(modeName);
    const characteristicIndices = new Set(derivation ? derivation.degreeIndices : []);
    const characteristicNotes = new Set(
      [...characteristicIndices].map(i => (rootPitchClass + intervals[i]) % 12));

    this.rootPitchClass      = rootPitchClass;
    this.rootName             = rootName;
    this.modeName             = modeName;
    this.scaleNotes           = scaleNotes;
    this.derivation           = derivation;
    this.characteristicNotes  = characteristicNotes;
    this.siblings             = getSiblings(rootPitchClass, modeName);
    this.related              = findRelatedScales(rootPitchClass, modeName);

    score.beginRun(`${rootName} ${modeName}`, { scaleNotes, rootPitchClass, chordNotes: [] });
  }
}

export const practice = new PracticeState();
