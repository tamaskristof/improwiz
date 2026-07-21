import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';
import { getScaleNotes } from './lib/scales';
import { endRun, getRunScore, recordNoteOff, recordNoteOn, startRun } from './lib/tracker';
import { audio } from './state/audio.svelte';

const app = mount(App, {
  target: document.getElementById('app')!,
});

// Dev-only console handle for driving run scoring without MIDI hardware, e.g.:
//   improwiz.startRun({ scaleNotes: improwiz.getScaleNotes(0, 'Ionian'), rootPitchClass: 0, chordNotes: [0, 4, 7] })
//   improwiz.recordNoteOn(60, 100); improwiz.recordNoteOff(60); improwiz.endRun()
// `audio` is exposed for firing dense chords at full velocity to check for output clipping:
//   [60, 64, 67, 72, 76, 79].forEach(n => improwiz.audio.noteOn(n, 1.0))
if (import.meta.env.DEV) {
  (window as unknown as { improwiz: object }).improwiz = {
    startRun, recordNoteOn, recordNoteOff, endRun, getRunScore, getScaleNotes, audio,
  };
}

export default app;
