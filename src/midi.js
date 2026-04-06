// src/midi.js — WebMIDI initialization and message parsing

/**
 * Initializes WebMIDI and wires up note callbacks.
 *
 * @param {(midi: number, velocity: number) => void} onNoteOn
 * @param {(midi: number) => void}                   onNoteOff
 * @param {(deviceName: string | null) => void}      onStatusChange
 * @returns {{ getInputs: () => MIDIInputMap | null }}
 */
function initMidi(onNoteOn, onNoteOff, onStatusChange) {
  let midiAccess = null;

  if (!navigator.requestMIDIAccess) {
    const banner = document.getElementById('unsupported-banner');
    if (banner) banner.hidden = false;
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
  function attachListeners() {
    for (const input of midiAccess.inputs.values()) {
      input.onmidimessage = handleMessage;
    }
  }

  /** Parse a raw MIDI message and invoke the appropriate callback. */
  function handleMessage(event) {
    const [status, note, velocity] = event.data;
    const command = status & 0xf0;

    if (command === 0x90 && velocity > 0) {
      onNoteOn(note, velocity);
    } else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
      onNoteOff(note);
    }
  }

  /** Report the first connected device name (or null) to the UI. */
  function broadcastStatus() {
    const inputs = [...midiAccess.inputs.values()];
    const active = inputs.find(i => i.state === 'connected' || i.connection !== 'closed');
    onStatusChange(active ? active.name : null);
  }

  return {
    getInputs: () => midiAccess?.inputs ?? null,
  };
}
