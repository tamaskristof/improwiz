<script lang="ts">
  import { SCALE_FAMILIES } from '../lib/scales';
  import { practice } from '../state/practice.svelte';

  function familyChecked(names: string[]): boolean {
    return names.every(n => practice.isEnabled(n));
  }

  function familyIndeterminate(names: string[]): boolean {
    const checkedCount = names.filter(n => practice.isEnabled(n)).length;
    return checkedCount > 0 && checkedCount < names.length;
  }

  /** `indeterminate` isn't a reflected HTML attribute — it must be set as a DOM property. */
  function indeterminate(node: HTMLInputElement, value: boolean) {
    node.indeterminate = value;
    return {
      update(newValue: boolean) {
        node.indeterminate = newValue;
      },
    };
  }
</script>

<details class="scale-settings">
  <summary class="scale-settings-summary">Scale Settings</summary>
  <div class="scale-checkboxes">
    {#each Object.entries(SCALE_FAMILIES) as [family, names] (family)}
      <div class="scale-family-group">
        <label class="scale-family-label">
          <input
            type="checkbox"
            checked={familyChecked(names)}
            use:indeterminate={familyIndeterminate(names)}
            onchange={(e) => practice.setFamilyEnabled(family, e.currentTarget.checked)}
          />
          {family}
        </label>
        <div class="scale-family-modes">
          {#each names as name (name)}
            <label class="scale-checkbox-label">
              <input
                type="checkbox"
                checked={practice.isEnabled(name)}
                disabled={practice.isOnlyEnabled(name)}
                onchange={(e) => practice.setModeEnabled(name, e.currentTarget.checked)}
              />
              {name}
            </label>
          {/each}
        </div>
      </div>
    {/each}
  </div>
</details>

<style>
  .scale-settings {
    border-top: 1px solid var(--color-border);
    padding-top: 0.5rem;
  }

  .scale-settings-summary {
    cursor: pointer;
    font-size: 0.8rem;
    color: #78909c;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    user-select: none;
    list-style: none;
  }

  .scale-settings-summary::-webkit-details-marker { display: none; }
  .scale-settings-summary::before { content: '\25B6  '; font-size: 0.7em; }
  .scale-settings[open] .scale-settings-summary::before { content: '\25BC  '; }

  .scale-checkboxes {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    padding: 0.75rem 0 0.25rem;
    text-align: left;
  }

  .scale-family-group {
    border-top: 1px solid var(--color-border);
    padding-top: 0.5rem;
  }

  .scale-family-label {
    display: flex;
    align-items: center;
    gap: 0.4em;
    font-size: 0.85rem;
    font-weight: 600;
    color: #cfd8dc;
    cursor: pointer;
    margin-bottom: 0.4rem;
  }

  .scale-family-label input[type="checkbox"] {
    accent-color: var(--color-root);
    cursor: pointer;
  }

  .scale-family-modes {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.4rem 1rem;
    padding-left: 1.4rem;
  }

  .scale-checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.4em;
    font-size: 0.9rem;
    color: #b0bec5;
    cursor: pointer;
  }

  .scale-checkbox-label input[type="checkbox"] {
    accent-color: var(--color-root);
    cursor: pointer;
  }
</style>
