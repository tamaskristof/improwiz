<script lang="ts">
  import { onMount } from 'svelte';
  import InfoPanel from './components/InfoPanel.svelte';
  import Keyboard from './components/Keyboard.svelte';
  import StatusBar from './components/StatusBar.svelte';
  import { initMidi } from './lib/midi';
  import { initMic, type MicController } from './lib/microphone';
  import { playNote } from './lib/sound';
  import { recordNoteOff, recordNoteOn } from './lib/tracker';
  import { input } from './state/input.svelte';
  import { practice } from './state/practice.svelte';
  import { score } from './state/score.svelte';

  const midiSupported = 'requestMIDIAccess' in navigator;

  let micController: MicController | null = null;

  function toggleMic() {
    if (micController) {
      micController.stop(); // resolves via onStatusChange(null) below
      micController = null;
      return;
    }
    input.setMicPending(); // instant visual feedback while the permission prompt shows
    micController = initMic(
      (midi) => input.press(midi),
      (midi) => input.release(midi),
      (status) => {
        input.setMicStatus(status);
        if (status === null) micController = null; // clean stop or access-denied/unavailable
      },
    );
  }

  // Only MIDI feeds the tracker — mouse clicks and mic input light keys but don't score.
  onMount(() => {
    initMidi(
      (midi, velocity) => {
        input.press(midi);
        recordNoteOn(midi, velocity);
        playNote(midi);
        score.refresh();
      },
      (midi) => {
        input.release(midi);
        recordNoteOff(midi);
        score.refresh();
      },
      (name) => input.setMidiStatus(name),
    );

    practice.randomize();
  });
</script>

{#if !midiSupported}
  <div class="unsupported-banner">
    <p>Your browser does not support the WebMIDI API. Please use Chrome or Edge.</p>
  </div>
{/if}

<header class="app-header">
  <h1>ImproWiz</h1>
</header>

<main class="app-main">
  <InfoPanel />
  <Keyboard
    scaleNotes={practice.scaleNotes}
    rootPitchClass={practice.rootPitchClass}
    characteristicNotes={practice.characteristicNotes}
    pressedKeys={input.pressedKeys}
    onNoteOn={(midi) => { input.press(midi); playNote(midi); }}
    onNoteOff={(midi) => input.release(midi)}
  />
</main>

<StatusBar onToggleMic={toggleMic} />

<style>
  .unsupported-banner {
    background: #7b1e1e;
    color: #fdd;
    text-align: center;
    padding: 0.75rem 1rem;
    font-weight: 600;
  }

  .app-header {
    background: var(--color-panel-bg);
    border-bottom: 1px solid var(--color-border);
    padding: 0.75rem 1.5rem;
  }

  .app-header h1 {
    font-size: 1.6rem;
    letter-spacing: 0.08em;
    font-weight: 700;
    color: #c9d6ff;
  }

  .app-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2rem;
    padding: 2rem 1rem;
  }
</style>
