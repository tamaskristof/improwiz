<script lang="ts">
  import { input } from '../state/input.svelte';

  interface Props {
    onToggleMic: () => void;
  }

  let { onToggleMic }: Props = $props();
</script>

<footer class="midi-status-bar">
  <span class="midi-status">{input.displayStatus}</span>
  <button
    class="mic-btn"
    class:is-active={input.micActive}
    type="button"
    title="Toggle microphone pitch detection"
    onclick={onToggleMic}
  >🎤 Mic</button>
</footer>

<style>
  .midi-status-bar {
    background: var(--color-panel-bg);
    border-top: 1px solid var(--color-border);
    padding: 0.4rem 1rem 0.4rem 1.5rem;
    font-size: 0.8rem;
    color: #78909c;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .mic-btn {
    flex-shrink: 0;
    padding: 0.2rem 0.7rem;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: transparent;
    color: #78909c;
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }

  .mic-btn:hover {
    background: rgba(58, 107, 196, 0.15);
    color: #b0bec5;
    border-color: #3a6bc4;
  }

  .mic-btn.is-active {
    background: rgba(224, 124, 36, 0.15);
    border-color: var(--color-root);
    color: var(--color-root);
    animation: mic-pulse 1.6s ease-in-out infinite;
  }
</style>
