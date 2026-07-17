// src/lib/midi.ts — WebMIDI initialization and message parsing

import type { MidiNote, NoteOffHandler, NoteOnHandler, StatusHandler } from './types';

export interface MidiController {
  getInputs: () => MIDIInputMap | null;
}

/**
 * Initializes WebMIDI and wires up note callbacks.
 */
export function initMidi(
  onNoteOn: NoteOnHandler,
  onNoteOff: NoteOffHandler,
  onStatusChange: StatusHandler,
): MidiController {
  let midiAccess: MIDIAccess | null = null;

  if (!navigator.requestMIDIAccess) {
    onStatusChange(null);
    return { getInputs: () => null };
  }

  navigator.requestMIDIAccess({ sysex: false })
    .then(access => {
      midiAccess = access;
      attachListeners();
      broadcastStatus();

      access.onstatechange = () => {
        attachListeners();
        broadcastStatus();
      };
    })
    .catch(() => {
      onStatusChange(null);
    });

  /** Attach midimessage listeners to every current input. */
  function attachListeners(): void {
    for (const input of midiAccess!.inputs.values()) {
      input.onmidimessage = handleMessage;
    }
  }

  /** Parse a raw MIDI message and invoke the appropriate callback. */
  function handleMessage(event: MIDIMessageEvent): void {
    const [status, note, velocity] = event.data!;
    const command = status & 0xf0;

    if (command === 0x90 && velocity > 0) {
      onNoteOn(note as MidiNote, velocity);
    } else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
      onNoteOff(note as MidiNote);
    }
  }

  /** Report the first connected device name (or null) to the UI. */
  function broadcastStatus(): void {
    const inputs = [...midiAccess!.inputs.values()];
    const active = inputs.find(i => i.state === 'connected' || i.connection !== 'closed');
    onStatusChange(active ? active.name : null);
  }

  return {
    getInputs: () => midiAccess?.inputs ?? null,
  };
}
