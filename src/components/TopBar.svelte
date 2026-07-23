<script lang="ts">
  import { input } from '../state/input.svelte';
  import { practice } from '../state/practice.svelte';
  import { quiz } from '../state/quiz.svelte';
  import { theme } from '../state/theme.svelte';

  interface Props {
    onToggleMic: () => void;
    onPanic: () => void;
    onOpenSettings: () => void;
  }

  let { onToggleMic, onPanic, onOpenSettings }: Props = $props();

  // A device/mic is live when the status text isn't the idle default.
  let connected = $derived(input.micActive || input.displayStatus.startsWith('MIDI:'));

  // Fullscreen: manual toggle (entering fullscreen requires a user gesture, so it can't be automatic).
  // Feature-detected — the button self-hides where the page Fullscreen API is unavailable (e.g. iPadOS).
  const fullscreenSupported = typeof document !== 'undefined' && document.fullscreenEnabled;
  let isFullscreen = $state(false);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      // request/exit can reject (permissions, transient state) — ignore; the label stays in sync via
      // the fullscreenchange listener below regardless.
    }
  }

  // Sync from the source of truth, not the click, so exiting via Esc/system gesture updates the label too.
  function syncFullscreen() {
    isFullscreen = !!document.fullscreenElement;
  }
</script>

<svelte:document onfullscreenchange={syncFullscreen} />

<header class="top-bar">
  <div class="brand">
    <div class="logo" aria-hidden="true"></div>
    <span class="wordmark">ImproWiz</span>
  </div>

  <div class="divider"></div>
  <div class="tabs">
    <button class="tab" class:is-active={!quiz.active} type="button" onclick={() => quiz.setActive(false)}>Free Play</button>
    <button class="tab" class:is-active={quiz.active} type="button" onclick={() => quiz.setActive(true)}>Find the Scale</button>
  </div>

  <div class="right">
    <div class="status">
      <span class="status-dot" class:is-live={connected}></span>
      <span class="status-text">{input.displayStatus}</span>
    </div>

    <button
      class="pill"
      type="button"
      title="Silence all notes (Esc)"
      onclick={onPanic}
    >⏹ Panic</button>

    <button
      class="pill"
      class:is-active={input.micActive}
      type="button"
      title="Toggle microphone pitch detection"
      onclick={onToggleMic}
    >🎤 Mic</button>

    <button class="pill primary" type="button" onclick={() => practice.randomize()}>Next scale</button>

    {#if fullscreenSupported}
      <button
        class="pill"
        type="button"
        title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        onclick={toggleFullscreen}
      >⛶ {isFullscreen ? 'Exit' : 'Fullscreen'}</button>
    {/if}

    <button class="pill icon" type="button" title="Scale settings" aria-label="Scale settings" onclick={onOpenSettings}>⚙</button>

    <button class="pill" type="button" onclick={() => theme.toggle()}>{theme.dark ? 'Light mode' : 'Dark mode'}</button>
  </div>
</header>

<style>
  .top-bar {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 9px 24px;
    border-bottom: 1px solid var(--border);
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 9px;
  }

  .logo {
    width: 20px;
    height: 20px;
    border-radius: 6px;
    background: var(--primary);
    flex-shrink: 0;
  }

  .wordmark {
    font: 700 16px var(--font-display);
    letter-spacing: -0.01em;
  }

  .divider {
    width: 1px;
    height: 18px;
    background: var(--border);
  }

  .tabs {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .tab {
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    padding: 0 0 3px;
    cursor: pointer;
    font: 700 13px var(--font-body);
    color: var(--muted);
  }

  .tab:hover { color: var(--ink); }

  .tab.is-active {
    color: var(--primary);
    border-bottom-color: var(--primary);
  }

  .right {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .status {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--faint);
  }

  .status-dot.is-live {
    background: var(--good);
    animation: iw-pulse 2s infinite;
  }

  .status-text {
    font: 600 11px var(--font-body);
    color: var(--muted);
  }

  .pill {
    background: none;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 6px 12px;
    cursor: pointer;
    color: var(--ink);
    font: 700 11px var(--font-body);
    transition: border-color 0.15s, color 0.15s, background 0.15s;
  }

  .pill:hover { border-color: var(--muted); }

  .pill.icon {
    padding: 6px 10px;
    font-size: 13px;
  }

  .pill.primary {
    background: var(--primary);
    border-color: var(--primary);
    color: var(--bg);
  }

  .pill.primary:hover { filter: brightness(1.08); }

  .pill.is-active {
    border-color: var(--n-root);
    color: var(--n-root);
    animation: iw-pulse 1.6s ease-in-out infinite;
  }
</style>
