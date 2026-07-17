// src/state/input.svelte.ts — pressed keys + MIDI/mic status

import { SvelteSet } from 'svelte/reactivity';
import type { MidiNote } from '../lib/types';

class InputState {
  pressedKeys = new SvelteSet<MidiNote>();

  /** Text shown in the status bar — either MIDI status or mic status (mic takes over while active). */
  displayStatus = $state('No MIDI device detected');
  micActive = $state(false);

  // Restored when mic stops, so a MIDI hot-plug event during mic use isn't lost.
  private lastMidiStatus = 'No MIDI device detected';

  press(midi: MidiNote): void {
    this.pressedKeys.add(midi);
  }

  release(midi: MidiNote): void {
    this.pressedKeys.delete(midi);
  }

  setMidiStatus(deviceName: string | null): void {
    this.lastMidiStatus = deviceName ? `MIDI: ${deviceName}` : 'No MIDI device detected';
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
