// src/state/input.svelte.ts — pressed keys + MIDI status

import { SvelteSet } from 'svelte/reactivity';
import { DEFAULT_BASE_MIDI } from '../lib/computerKeys';
import type { MidiNote } from '../lib/types';

/** Idle text: doubles as the hint that the computer keyboard is playable without hardware. */
const NO_MIDI_STATUS = 'No MIDI — play with your computer keyboard';

class InputState {
  pressedKeys = new SvelteSet<MidiNote>();

  /** MIDI note the computer keyboard's lowest key currently plays (see lib/computerKeys.ts). */
  keyboardOctaveBase = $state<MidiNote>(DEFAULT_BASE_MIDI);

  /** Text shown in the status bar — the current MIDI status. */
  displayStatus = $state(NO_MIDI_STATUS);

  press(midi: MidiNote): void {
    this.pressedKeys.add(midi);
  }

  release(midi: MidiNote): void {
    this.pressedKeys.delete(midi);
  }

  setKeyboardOctaveBase(midi: MidiNote): void {
    this.keyboardOctaveBase = midi;
  }

  setMidiStatus(deviceName: string | null): void {
    this.displayStatus = deviceName ? `MIDI: ${deviceName}` : NO_MIDI_STATUS;
  }
}

export const input = new InputState();
