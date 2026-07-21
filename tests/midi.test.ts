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

  it('ignores control changes that are not panics', () => {
    expect(parseMidiMessage([0xb0, 7, 100])).toBeNull(); // channel volume
    expect(parseMidiMessage([0xb0, 64, 127])).toBeNull(); // sustain pedal
  });

  it('ignores messages we do not act on', () => {
    expect(parseMidiMessage([0xe0, 0, 64])).toBeNull(); // pitch bend
    expect(parseMidiMessage([0xa0, 60, 80])).toBeNull(); // polyphonic aftertouch
    expect(parseMidiMessage([0xf8])).toBeNull(); // clock
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
