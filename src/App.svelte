<script lang="ts">
  import { onMount } from 'svelte';
  import AnnotationZone from './components/AnnotationZone.svelte';
  import Keyboard from './components/Keyboard.svelte';
  import SettingsDrawer from './components/SettingsDrawer.svelte';
  import StatusZone from './components/StatusZone.svelte';
  import TopBar from './components/TopBar.svelte';
  import { initComputerKeys } from './lib/computerKeys';
  import { initMidi } from './lib/midi';
  import { initMic, type MicController } from './lib/microphone';
  import { recordNoteOff, recordNoteOn } from './lib/tracker';
  import { audio } from './state/audio.svelte';
  import { input } from './state/input.svelte';
  import { practice } from './state/practice.svelte';
  import { score } from './state/score.svelte';

  const midiSupported = 'requestMIDIAccess' in navigator;

  let micController: MicController | null = null;
  let settingsOpen = $state(false);

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

  // The scored input path, shared by MIDI and the computer keyboard: both deliver real note-on/
  // note-off pairs with honest durations, which is what tracker.ts's duration-weighted scoring needs.
  // Mouse clicks and mic input light keys but don't score.
  function playNoteOn(midi: number, velocity: number) {
    input.press(midi);
    recordNoteOn(midi, velocity);
    audio.noteOn(midi, velocity / 127);
    score.refresh();
  }

  function playNoteOff(midi: number) {
    input.release(midi);
    recordNoteOff(midi);
    audio.noteOff(midi); // held keys now sustain until release
    score.refresh();
  }

  onMount(() => {
    // MIDI note events aren't a user gesture, so audio can't start from playing alone.
    audio.armAutoStart();

    initMidi(playNoteOn, playNoteOff, (name) => input.setMidiStatus(name));

    const keys = initComputerKeys(playNoteOn, playNoteOff, (base) => input.setKeyboardOctaveBase(base));

    practice.randomize();

    return () => keys.stop();
  });
</script>

{#if !midiSupported}
  <div class="unsupported-banner">
    <p>Your browser does not support the WebMIDI API. Please use Chrome or Edge.</p>
  </div>
{/if}

{#if audio.blocked}
  <div class="audio-banner">
    <p>Click anywhere to enable sound — your browser blocks audio until you interact with the page.</p>
  </div>
{/if}

<TopBar onToggleMic={toggleMic} onOpenSettings={() => (settingsOpen = true)} />
<StatusZone />
<AnnotationZone />
<Keyboard
  scaleNotes={practice.scaleNotes}
  rootPitchClass={practice.rootPitchClass}
  characteristicNotes={practice.characteristicNotes}
  pressedKeys={input.pressedKeys}
  onNoteOn={(midi) => { input.press(midi); audio.noteOn(midi, 0.7); }}
  onNoteOff={(midi) => { input.release(midi); audio.noteOff(midi); }}
/>

{#if settingsOpen}
  <SettingsDrawer onClose={() => (settingsOpen = false)} />
{/if}

<style>
  .unsupported-banner {
    background: #7b1e1e;
    color: #fdd;
    text-align: center;
    padding: 0.75rem 1rem;
    font-weight: 600;
  }

  .audio-banner {
    background: #6b4a12;
    color: #fde9c4;
    text-align: center;
    padding: 0.75rem 1rem;
    font-weight: 600;
  }
</style>
