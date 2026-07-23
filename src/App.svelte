<script lang="ts">
  import { onMount } from 'svelte';
  import AnnotationZone from './components/AnnotationZone.svelte';
  import ChordStrip from './components/ChordStrip.svelte';
  import Keyboard from './components/Keyboard.svelte';
  import SettingsDrawer from './components/SettingsDrawer.svelte';
  import StatusZone from './components/StatusZone.svelte';
  import TopBar from './components/TopBar.svelte';
  import { initComputerKeys, type ComputerKeysController } from './lib/computerKeys';
  import { initMidi } from './lib/midi';
  import { initMic, type MicController } from './lib/microphone';
  import { recordNoteOff, recordNoteOn } from './lib/tracker';
  import { audio } from './state/audio.svelte';
  import { input } from './state/input.svelte';
  import { practice } from './state/practice.svelte';
  import { score } from './state/score.svelte';

  const midiSupported = 'requestMIDIAccess' in navigator;

  let micController: MicController | null = null;
  let computerKeys: ComputerKeysController | null = null;
  let settingsOpen = $state(false);
  // Chord being previewed from the strip — a single voicing from C4, as MIDI notes. Lights those
  // keys on the keyboard and whispers the rest; sounds nothing (hover, not press).
  let highlightNotes = $state<Set<number> | undefined>(undefined);

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

  /**
   * Release everything, everywhere. Reachable from Esc, the top-bar pill, the controller's own
   * All Notes Off / All Sound Off, and a device disconnect — any of which can otherwise leave a note
   * ringing with no note-off ever coming.
   *
   * Deliberately not a run boundary: playNoteOff records the note-offs, so held durations finalize
   * honestly and the run in progress carries on. "Next scale" stays the only thing that ends a run.
   */
  function panic() {
    // First, so its own notes leave input.pressedKeys before the sweep below and aren't released twice.
    computerKeys?.releaseAll();
    for (const midi of [...input.pressedKeys]) playNoteOff(midi);
    // Backstop: silences anything still sounding that pressedKeys never knew about.
    audio.allNotesOff();
  }

  function handleWindowKeydown(e: KeyboardEvent) {
    if (e.key !== 'Escape') return;
    if (settingsOpen) settingsOpen = false; // the drawer wins Esc while it's open
    else panic();
  }

  onMount(() => {
    // MIDI note events aren't a user gesture, so audio can't start from playing alone.
    audio.armAutoStart();

    initMidi(playNoteOn, playNoteOff, (name) => input.setMidiStatus(name), panic, (msg) => {
      switch (msg.type) {
        case 'sustain': audio.setSustain(msg.down); break;
        case 'sostenuto': audio.setSostenuto(msg.down, input.pressedKeys); break;
        case 'soft': audio.setSoft(msg.down); break;
        case 'modWheel': audio.setModWheel(msg.value); break;
        case 'pitchBend': audio.setPitchBend(msg.value); break;
      }
    });

    computerKeys = initComputerKeys(playNoteOn, playNoteOff, (base) => input.setKeyboardOctaveBase(base));

    practice.randomize();

    return () => computerKeys?.stop();
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

<svelte:window onkeydown={handleWindowKeydown} />

<TopBar onToggleMic={toggleMic} onPanic={panic} onOpenSettings={() => (settingsOpen = true)} />
<StatusZone />
<AnnotationZone />
<ChordStrip onHover={(notes) => (highlightNotes = notes ?? undefined)} />
<Keyboard
  scaleNotes={practice.scaleNotes}
  rootPitchClass={practice.rootPitchClass}
  characteristicNotes={practice.characteristicNotes}
  pressedKeys={input.pressedKeys}
  {highlightNotes}
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
