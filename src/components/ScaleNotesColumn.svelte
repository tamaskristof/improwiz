<script lang="ts">
  import {
    ROOT_NAMES,
    SCALE_DEFS,
    formatDerivation,
    getDegreeLabel,
    getNoteRole,
    prettifyAccidental,
    type NoteRole,
  } from '../lib/scales';
  import { practice } from '../state/practice.svelte';

  const ROLE_WORD: Record<Exclude<NoteRole, null>, string> = {
    root: 'Root',
    characteristic: 'Characteristic',
    scale: 'Scale',
  };

  function roleColor(role: NoteRole): string {
    return role === 'root'           ? 'var(--n-root)'
         : role === 'characteristic' ? 'var(--n-tension)'
         : role === 'scale'          ? 'var(--n-chord)'
         : 'var(--faint)';
  }

  let rows = $derived(
    (SCALE_DEFS[practice.modeName] ?? []).map((interval) => {
      const pc = (practice.rootPitchClass + interval) % 12;
      const role = getNoteRole(pc, practice.rootPitchClass, practice.characteristicNotes, practice.scaleNotes);
      return {
        pc,
        name: prettifyAccidental(ROOT_NAMES[pc]),
        degree: getDegreeLabel(interval),
        role,
        word: role ? ROLE_WORD[role] : '',
        color: roleColor(role),
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
        <span class="note-degree" class:is-characteristic={row.role === 'characteristic'} style={row.role === 'characteristic' ? `color: ${row.color}` : ''}>{row.degree} · {row.word}</span>
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
