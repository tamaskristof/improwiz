<script lang="ts">
  import ScaleSettings from './ScaleSettings.svelte';
  import SoundSettings from './SoundSettings.svelte';

  interface Props {
    onClose: () => void;
  }

  let { onClose }: Props = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="overlay" onclick={onClose}>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <aside class="drawer" onclick={(e) => e.stopPropagation()} aria-label="Scale settings">
    <header class="drawer-head">
      <h2>Settings</h2>
      <button class="close" type="button" aria-label="Close settings" onclick={onClose}>✕</button>
    </header>

    <section class="section">
      <h3 class="section-title">Scales</h3>
      <p class="hint">Pick which scales the "Next scale" button draws from.</p>
      <ScaleSettings />
    </section>

    <section class="section">
      <h3 class="section-title">Sound</h3>
      <SoundSettings />
    </section>
  </aside>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: flex-end;
    z-index: 50;
  }

  .drawer {
    width: min(440px, 90vw);
    height: 100%;
    background: var(--surface);
    border-left: 1px solid var(--border);
    padding: 20px 24px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .drawer-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .drawer-head h2 {
    font: 700 18px var(--font-display);
    color: var(--ink);
  }

  .close {
    background: none;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 4px 9px;
    cursor: pointer;
    color: var(--muted);
    font-size: 13px;
  }

  .close:hover { color: var(--ink); border-color: var(--muted); }

  .hint {
    font: 500 12px var(--font-body);
    color: var(--faint);
    margin-bottom: 4px;
  }

  .section {
    border-top: 1px solid var(--border);
    padding-top: 14px;
  }

  .section:first-of-type {
    border-top: none;
    padding-top: 0;
  }

  .section-title {
    font: 700 13px var(--font-display);
    color: var(--ink);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 8px;
  }
</style>
