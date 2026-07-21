// src/lib/sound.ts — Web Audio API piano synth (no external files)

import type { MidiNote } from './types';

let audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext {
  if (!audioCtx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new Ctor();
  }
  return audioCtx;
}

function midiToFreq(midi: MidiNote): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function playNote(midi: MidiNote): void {
  const ctx = getAudioCtx();
  if (ctx.state === 'suspended') ctx.resume();

  const freq = midiToFreq(midi);
  const now  = ctx.currentTime;

  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  osc1.type = 'triangle';
  osc2.type = 'triangle';
  osc1.frequency.setValueAtTime(freq,         now);
  osc2.frequency.setValueAtTime(freq * 1.003, now); // slight detune for warmth

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, now);
  // Peak kept low: this runs on its own AudioContext, so it can't route through the master
  // soft-clipper in audio.svelte.ts. At 0.18 about five simultaneous notes stay under full scale.
  gain.gain.linearRampToValueAtTime(0.18,  now + 0.008); // fast attack
  gain.gain.exponentialRampToValueAtTime(0.001, now + 1.8); // natural decay

  osc1.connect(gain); osc2.connect(gain);
  gain.connect(ctx.destination);

  osc1.start(now); osc2.start(now);
  osc1.stop(now + 1.8); osc2.stop(now + 1.8);
}
