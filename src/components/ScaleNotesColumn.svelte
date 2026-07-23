<script lang="ts">
  import {
    ROOT_NAMES,
    SCALE_DEFS,
    formatDerivation,
    getDegreeLabel,
    getNoteRole,
    getStabilityRole,
    getTensionNotes,
    getTonicChordTones,
    prettifyAccidental,
    type NoteRole,
    type StabilityRole,
  } from '../lib/scales';
  import { practice } from '../state/practice.svelte';
  import { quiz } from '../state/quiz.svelte';

  // How stable each note is over the scale — see getStabilityRole for why this is
  // stability rather than the classical tonic/subdominant/dominant functions.
  const ROLE_WORD: Record<Exclude<StabilityRole, null>, string> = {
    tonic: 'Tonic',
    stable: 'Stable',
    tension: 'Tension',
    characteristic: 'Characteristic',
    colour: 'Colour',
  };

  // The note letter keeps its original three-colour axis (brass / rose / teal),
  // shared with the keyboard. Stability is a second, orthogonal axis, carried by
  // the word alone so no fourth accent hue enters the palette.
  function roleColor(role: NoteRole): string {
    return role === 'root'           ? 'var(--n-root)'
         : role === 'characteristic' ? 'var(--n-tension)'
         : role === 'scale'          ? 'var(--n-chord)'
         : 'var(--faint)';
  }

  // Derived here rather than in practice state: this column is the only consumer
  // (unlike characteristicNotes, which App.svelte also feeds to the keyboard).
  let tonicChordTones = $derived(getTonicChordTones(practice.rootPitchClass, practice.modeName));
  let tensionNotes = $derived(getTensionNotes(practice.rootPitchClass, practice.modeName));

  let rows = $derived(
    (SCALE_DEFS[practice.modeName] ?? []).map((interval) => {
      const pc = (practice.rootPitchClass + interval) % 12;
      const role = getNoteRole(pc, practice.rootPitchClass, practice.characteristicNotes, practice.scaleNotes);
      const stability = getStabilityRole(
        pc, practice.rootPitchClass, tonicChordTones, tensionNotes,
        practice.characteristicNotes, practice.scaleNotes);
      const revealed = !quiz.active || quiz.foundNotes.has(pc);
      return {
        pc,
        name: revealed ? prettifyAccidental(ROOT_NAMES[pc]) : '?',
        degree: revealed ? getDegreeLabel(interval) : '?',
        role,
        stability,
        // Masked in quiz mode along with the name and degree — the role would
        // otherwise narrow down which note is hiding behind the '?'.
        word: revealed && stability ? ROLE_WORD[stability] : '',
        color: revealed ? roleColor(role) : 'var(--faint)',
      };
    }),
  );

  let parentLabel = $derived(practice.derivation?.refLabel ?? null);
  let derivationText = $derived(formatDerivation(practice.derivation));
</script>

<div class="column notes-column">
  <div class="head">
    <span class="eyebrow">Notes of the scale</span>
    {#if parentLabel}<span class="parent">Parent: {parentLabel}</span>{/if}
  </div>

  <div class="rows">
    {#each rows as row (row.pc)}
      <div class="note-row">
        <span class="note-letter" style="color: {row.color}">{row.name}</span>
        <span class="note-degree" class:is-characteristic={row.role === 'characteristic'} style={row.role === 'characteristic' ? `color: ${row.color}` : ''}>{row.degree}{#if row.word}{' '}<span class="note-word" class:is-tension={row.stability === 'tension'}>· {row.word}</span>{/if}</span>
      </div>
    {/each}
  </div>

  {#if derivationText}
    <div class="hairline"></div>
    <span class="derivation">= {derivationText}</span>
  {/if}
</div>

<style>
  .column {
    padding: 16px 26px;
    display: flex;
    flex-direction: column;
    gap: 7px;
    text-align: left;
  }

  .notes-column {
    border-right: 1px solid var(--border);
  }

  .head {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .eyebrow {
    font: 700 12px var(--font-body);
    color: var(--faint);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .parent {
    font: 600 13px var(--font-body);
    color: var(--faint);
  }

  .rows {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .note-row {
    display: flex;
    align-items: baseline;
    gap: 12px;
  }

  .note-letter {
    width: 30px;
    font: 700 24px var(--font-body);
  }

  .note-degree {
    font: 500 15px var(--font-body);
    color: var(--faint);
  }

  .note-degree.is-characteristic {
    font-weight: 700;
  }

  /* Own span, so a note that is both characteristic and a tension (Phrygian's ♭2)
     keeps the rose+bold degree while the word still reads as a caveat. Grey rather
     than a fourth accent hue, matching how the keyboard greys out-of-scale keys —
     but --n-avoid sits close to the --faint the degree already uses, and the two
     invert between themes, so the italic is what actually carries the distinction. */
  .note-word.is-tension {
    color: var(--n-avoid);
    font-style: italic;
  }

  .hairline {
    height: 1px;
    background: var(--border);
    margin: 3px 0;
  }

  .derivation {
    font: 600 15px var(--font-body);
    color: var(--muted);
  }
</style>
