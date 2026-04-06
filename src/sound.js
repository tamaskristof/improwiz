// src/sound.js — Web Audio API piano synth (no external files)

let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function playNote(midi) {
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
  gain.gain.linearRampToValueAtTime(0.35,  now + 0.008); // fast attack
  gain.gain.exponentialRampToValueAtTime(0.001, now + 1.8); // natural decay

  osc1.connect(gain); osc2.connect(gain);
  gain.connect(ctx.destination);

  osc1.start(now); osc2.start(now);
  osc1.stop(now + 1.8); osc2.stop(now + 1.8);
}
