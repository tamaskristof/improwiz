// src/lib/midi.ts — WebMIDI initialization and message parsing

import type { MidiNote, NoteOffHandler, NoteOnHandler, StatusHandler } from './types';

export interface MidiController {
  getInputs: () => MIDIInputMap | null;
}

/** Channel-mode controller numbers that mean "stop everything". */
const CC_ALL_SOUND_OFF = 120;
const CC_ALL_NOTES_OFF = 123;

export type ParsedMidi =
  | { type: 'noteOn'; note: MidiNote; velocity: number }
  | { type: 'noteOff'; note: MidiNote }
  | { type: 'panic' }
  | null;

/**
 * Parses a raw MIDI message into an app-level event, or null for anything we don't act on.
 * Pure and exported so the rules below are unit-testable without WebMIDI hardware.
 *
 * The channel nibble is deliberately ignored — the app is monotimbral, so a controller sending on
 * channel 5 should play just like one sending on channel 1.
 */
export function parseMidiMessage(data: Uint8Array | readonly number[]): ParsedMidi {
  if (data.length < 3) return null;
  const [status, data1, data2] = data;
  const command = status & 0xf0;

  // Note-on with velocity 0 is the conventional note-off — many controllers never send 0x80 at all.
  if (command === 0x90) {
    return data2 > 0 ? { type: 'noteOn', note: data1, velocity: data2 } : { type: 'noteOff', note: data1 };
  }
  if (command === 0x80) return { type: 'noteOff', note: data1 };
  if (command === 0xb0 && (data1 === CC_ALL_SOUND_OFF || data1 === CC_ALL_NOTES_OFF)) {
    return { type: 'panic' };
  }
  return null;
}

/**
 * Initializes WebMIDI and wires up note callbacks.
 *
 * `onPanic` fires when the controller asks for all notes off, and when a device disconnects — both
 * leave notes ringing forever otherwise, since the matching note-offs never arrive.
 */
export function initMidi(
  onNoteOn: NoteOnHandler,
  onNoteOff: NoteOffHandler,
  onStatusChange: StatusHandler,
  onPanic: () => void,
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

      access.onstatechange = (event) => {
        attachListeners();
        broadcastStatus();
        // A controller unplugged mid-chord never sends the note-offs for what it was holding.
        if (event.port?.type === 'input' && event.port.state === 'disconnected') onPanic();
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

  function handleMessage(event: MIDIMessageEvent): void {
    const parsed = event.data && parseMidiMessage(event.data);
    if (!parsed) return;
    if (parsed.type === 'noteOn') onNoteOn(parsed.note, parsed.velocity);
    else if (parsed.type === 'noteOff') onNoteOff(parsed.note);
    else onPanic();
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
