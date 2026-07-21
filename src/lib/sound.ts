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

/** Notes currently sounding, so they can be released early — see stopNote(). */
const active = new Map<MidiNote, { osc1: OscillatorNode; osc2: OscillatorNode; gain: GainNode }>();

const RELEASE_S = 0.06;

/**
 * Damp a sounding note. Needed because this synth is only a stand-in for the sampled piano while its
 * samples load: without it, notes were fire-and-forget for a fixed 1.8s regardless of key release,
 * so any still ringing when the piano took over kept sounding *underneath* it — audible as a synth
 * layer playing in parallel with the piano.
 */
export function stopNote(midi: MidiNote): void {
  const voice = active.get(midi);
  if (!voice || !audioCtx) return;
  active.delete(midi);
  const now = audioCtx.currentTime;
  const g = voice.gain.gain;
  g.cancelScheduledValues(now);
  // exponentialRamp can't touch zero, so pin the current level first and decay from there.
  g.setValueAtTime(Math.max(g.value, 0.0001), now);
  g.exponentialRampToValueAtTime(0.0001, now + RELEASE_S);
  voice.osc1.stop(now + RELEASE_S + 0.01);
  voice.osc2.stop(now + RELEASE_S + 0.01);
}

/** Damp every sounding note — used at the handover once the sampled piano is ready. */
export function stopAllNotes(): void {
  for (const midi of [...active.keys()]) stopNote(midi);
}

export function playNote(midi: MidiNote): void {
  const ctx = getAudioCtx();
  if (ctx.state === 'suspended') ctx.resume();

  stopNote(midi); // retrigger cleanly if this note is already sounding

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

  active.set(midi, { osc1, osc2, gain });
  // Drop the entry when the note ends on its own, so it isn't "released" later by mistake.
  osc1.onended = () => {
    if (active.get(midi)?.osc1 === osc1) active.delete(midi);
  };
}
