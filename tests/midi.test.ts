import { describe, expect, it } from 'vitest';
import { parseMidiMessage } from '../src/lib/midi';

describe('parseMidiMessage', () => {
  it('parses a note-on', () => {
    expect(parseMidiMessage([0x90, 60, 100])).toEqual({ type: 'noteOn', note: 60, velocity: 100 });
  });

  it('ignores the channel nibble', () => {
    // The app is monotimbral — a controller on channel 6 should play like one on channel 1.
    expect(parseMidiMessage([0x95, 60, 100])).toEqual({ type: 'noteOn', note: 60, velocity: 100 });
    expect(parseMidiMessage([0x8f, 60, 64])).toEqual({ type: 'noteOff', note: 60 });
  });

  it('treats note-on with velocity 0 as a note-off', () => {
    // Many controllers never send 0x80 at all — this is the usual cause of stuck notes when missed.
    expect(parseMidiMessage([0x90, 60, 0])).toEqual({ type: 'noteOff', note: 60 });
  });

  it('parses an explicit note-off', () => {
    expect(parseMidiMessage([0x80, 60, 64])).toEqual({ type: 'noteOff', note: 60 });
  });

  it('parses the channel-mode panic messages', () => {
    expect(parseMidiMessage([0xb0, 123, 0])).toEqual({ type: 'panic' }); // All Notes Off
    expect(parseMidiMessage([0xb0, 120, 0])).toEqual({ type: 'panic' }); // All Sound Off
  });

  it('ignores control changes it does not act on', () => {
    expect(parseMidiMessage([0xb0, 7, 100])).toBeNull(); // channel volume
    expect(parseMidiMessage([0xb0, 10, 64])).toBeNull(); // pan
  });

  it('ignores other unhandled messages', () => {
    expect(parseMidiMessage([0xa0, 60, 80])).toBeNull(); // polyphonic aftertouch
    expect(parseMidiMessage([0xf8])).toBeNull(); // clock
  });

  it('parses the sustain pedal (CC64) as a boolean, thresholded at 64', () => {
    expect(parseMidiMessage([0xb0, 64, 127])).toEqual({ type: 'sustain', down: true });
    expect(parseMidiMessage([0xb0, 64, 64])).toEqual({ type: 'sustain', down: true });
    expect(parseMidiMessage([0xb0, 64, 63])).toEqual({ type: 'sustain', down: false });
    expect(parseMidiMessage([0xb0, 64, 0])).toEqual({ type: 'sustain', down: false });
  });

  it('parses the sostenuto pedal (CC66) as a boolean', () => {
    expect(parseMidiMessage([0xb0, 66, 127])).toEqual({ type: 'sostenuto', down: true });
    expect(parseMidiMessage([0xb0, 66, 0])).toEqual({ type: 'sostenuto', down: false });
  });

  it('parses the soft pedal (CC67) as a boolean', () => {
    expect(parseMidiMessage([0xb0, 67, 127])).toEqual({ type: 'soft', down: true });
    expect(parseMidiMessage([0xb0, 67, 0])).toEqual({ type: 'soft', down: false });
  });

  it('parses the mod wheel (CC1) as a 0..1 value', () => {
    expect(parseMidiMessage([0xb0, 1, 0])).toEqual({ type: 'modWheel', value: 0 });
    expect(parseMidiMessage([0xb0, 1, 127])).toEqual({ type: 'modWheel', value: 1 });
  });

  it('ignores the channel nibble for control changes too', () => {
    expect(parseMidiMessage([0xb3, 64, 127])).toEqual({ type: 'sustain', down: true });
  });

  it('parses pitch bend (0xE0) as a -1..1 value centered at the 14-bit midpoint', () => {
    expect(parseMidiMessage([0xe0, 0, 64])).toEqual({ type: 'pitchBend', value: 0 }); // center (0x2000)
    expect(parseMidiMessage([0xe0, 0, 0])).toEqual({ type: 'pitchBend', value: -1 }); // min (0x0000)
    // Max (0x3FFF = 16383) is 8191 above center out of a possible 8192, i.e. just short of +1 — the
    // 14-bit range isn't symmetric around its own center, same as real MIDI pitch-bend hardware.
    const max = parseMidiMessage([0xe0, 0x7f, 0x7f]);
    expect(max?.type).toBe('pitchBend');
    expect((max as { value: number }).value).toBeCloseTo(8191 / 8192, 6);
    expect(parseMidiMessage([0xef, 0, 64])).toEqual({ type: 'pitchBend', value: 0 }); // channel ignored
  });

  it('survives short or empty data without throwing', () => {
    expect(parseMidiMessage([])).toBeNull();
    expect(parseMidiMessage([0x90])).toBeNull();
    expect(parseMidiMessage([0x90, 60])).toBeNull();
  });

  it('accepts a Uint8Array, which is what WebMIDI actually delivers', () => {
    expect(parseMidiMessage(new Uint8Array([0x90, 60, 100])))
      .toEqual({ type: 'noteOn', note: 60, velocity: 100 });
  });
});
