// src/lib/midi.ts — WebMIDI initialization and message parsing

import type { MidiNote, NoteOffHandler, NoteOnHandler, StatusHandler } from './types';

export interface MidiController {
  getInputs: () => MIDIInputMap | null;
}

/** Channel-mode controller numbers that mean "stop everything". */
const CC_ALL_SOUND_OFF = 120;
const CC_ALL_NOTES_OFF = 123;

/** Continuous-controller numbers this app reads. */
const CC_MOD_WHEEL = 1;
const CC_SUSTAIN = 64;
const CC_SOSTENUTO = 66;
const CC_SOFT = 67;

/** On/off pedal CCs are technically 0–127, but the app treats them as booleans like most gear does. */
const PEDAL_ON_THRESHOLD = 64;

/**
 * The subset of ParsedMidi that carries continuous-controller state (pedals, wheels) rather than a
 * discrete note/panic event — exported so callers can type the `onController` handler below.
 */
export type ControllerMessage =
  | { type: 'sustain'; down: boolean }
  | { type: 'sostenuto'; down: boolean }
  | { type: 'soft'; down: boolean }
  | { type: 'modWheel'; value: number } // 0..1
  | { type: 'pitchBend'; value: number }; // -1..1, 0 = center

export type ParsedMidi =
  | { type: 'noteOn'; note: MidiNote; velocity: number }
  | { type: 'noteOff'; note: MidiNote }
  | { type: 'panic' }
  | ControllerMessage
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
  if (command === 0xb0) {
    if (data1 === CC_ALL_SOUND_OFF || data1 === CC_ALL_NOTES_OFF) return { type: 'panic' };
    if (data1 === CC_MOD_WHEEL) return { type: 'modWheel', value: data2 / 127 };
    if (data1 === CC_SUSTAIN) return { type: 'sustain', down: data2 >= PEDAL_ON_THRESHOLD };
    if (data1 === CC_SOSTENUTO) return { type: 'sostenuto', down: data2 >= PEDAL_ON_THRESHOLD };
    if (data1 === CC_SOFT) return { type: 'soft', down: data2 >= PEDAL_ON_THRESHOLD };
    return null;
  }
  if (command === 0xe0) {
    // 14-bit value, LSB first: data1 is the low 7 bits, data2 the high 7 bits. 0x2000 (8192) is
    // center; normalize to -1..1 and clamp since the raw range (0..16383) is very slightly
    // asymmetric around center.
    const raw = data1 | (data2 << 7);
    const value = Math.max(-1, Math.min(1, (raw - 8192) / 8192));
    return { type: 'pitchBend', value };
  }
  return null;
}

/**
 * Initializes WebMIDI and wires up note callbacks.
 *
 * `onPanic` fires when the controller asks for all notes off, and when a device disconnects — both
 * leave notes ringing forever otherwise, since the matching note-offs never arrive.
 *
 * `onController` covers every pedal/wheel message in one callback rather than one param per CC —
 * computerKeys.ts has no analog for any of these, so this stays MIDI-only.
 */
export function initMidi(
  onNoteOn: NoteOnHandler,
  onNoteOff: NoteOffHandler,
  onStatusChange: StatusHandler,
  onPanic: () => void,
  onController: (msg: ControllerMessage) => void,
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
    else if (parsed.type === 'panic') onPanic();
    else onController(parsed);
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
