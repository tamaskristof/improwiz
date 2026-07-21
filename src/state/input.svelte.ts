// src/state/input.svelte.ts — pressed keys + MIDI/mic status

import { SvelteSet } from 'svelte/reactivity';
import { DEFAULT_BASE_MIDI } from '../lib/computerKeys';
import type { MidiNote } from '../lib/types';

/** Idle text: doubles as the hint that the computer keyboard is playable without hardware. */
const NO_MIDI_STATUS = 'No MIDI — play with your computer keyboard';

class InputState {
  pressedKeys = new SvelteSet<MidiNote>();

  /** MIDI note the computer keyboard's lowest key currently plays (see lib/computerKeys.ts). */
  keyboardOctaveBase = $state<MidiNote>(DEFAULT_BASE_MIDI);

  /** Text shown in the status bar — either MIDI status or mic status (mic takes over while active). */
  displayStatus = $state(NO_MIDI_STATUS);
  micActive = $state(false);

  // Restored when mic stops, so a MIDI hot-plug event during mic use isn't lost.
  private lastMidiStatus = NO_MIDI_STATUS;

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
    this.lastMidiStatus = deviceName ? `MIDI: ${deviceName}` : NO_MIDI_STATUS;
    if (!this.micActive) this.displayStatus = this.lastMidiStatus;
  }

  setMicStatus(status: string | null): void {
    if (status === 'Mic: listening') {
      this.micActive = true;
      this.displayStatus = status;
    } else if (status === null) {
      // Clean stop — restore MIDI status
      this.micActive = false;
      this.displayStatus = this.lastMidiStatus;
    } else {
      // Error (access denied, unavailable, etc.)
      this.micActive = false;
      this.displayStatus = status;
    }
  }

  /** Instant visual feedback while the permission prompt is showing, before setMicStatus resolves it. */
  setMicPending(): void {
    this.micActive = true;
  }
}

export const input = new InputState();
