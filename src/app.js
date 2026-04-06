// src/app.js — entry point, wires everything together

// ── DOM refs ─────────────────────────────────────────────────
const rootNameEl        = document.getElementById('root-name');
const modeNameEl        = document.getElementById('mode-name');
const scaleNotesEl      = document.getElementById('scale-notes-list');
const scaleStepsEl      = document.getElementById('scale-steps-list');
const relatedScalesEl   = document.getElementById('related-scales-list');
const relatedSection    = document.getElementById('related-scales-section');
const chordLabelEl      = document.getElementById('chord-label');
const chordNotesEl      = document.getElementById('chord-notes');
const midiStatusEl      = document.getElementById('midi-status');
const micBtn            = document.getElementById('mic-btn');
const randomizeBtn      = document.getElementById('randomize-btn');
const keyboardCont      = document.getElementById('keyboard-container');
const scaleCheckboxesEl = document.getElementById('scale-checkboxes');
const flavorFeelEl      = document.getElementById('flavor-feel');
const flavorGenresEl    = document.getElementById('flavor-genres');
const flavorTipEl       = document.getElementById('flavor-tip');
const flavorBrightnessEl = document.getElementById('flavor-brightness');
const modeAliasEl        = document.getElementById('mode-alias');

// ── Scale settings ───────────────────────────────────────────
const LS_KEY = 'improwiz_enabled_scales';

function getEnabledModes() {
  const cbs = scaleCheckboxesEl.querySelectorAll('input[type="checkbox"]');
  return [...cbs].filter(cb => cb.checked).map(cb => cb.value);
}

function saveEnabledScales() {
  localStorage.setItem(LS_KEY, JSON.stringify(getEnabledModes()));
}

function loadEnabledScales() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY));
    if (Array.isArray(saved) && saved.length > 0) return saved;
  } catch (_) {}
  return Object.keys(SCALE_DEFS);
}

function buildScaleCheckboxes() {
  const enabled = loadEnabledScales();
  scaleCheckboxesEl.innerHTML = Object.keys(SCALE_DEFS).map(name => `
    <label class="scale-checkbox-label">
      <input type="checkbox" value="${name}"${enabled.includes(name) ? ' checked' : ''} />
      ${name}
    </label>`).join('');

  scaleCheckboxesEl.addEventListener('change', (e) => {
    if (e.target.type !== 'checkbox') return;
    const checked = [...scaleCheckboxesEl.querySelectorAll('input:checked')];
    if (checked.length === 0) { e.target.checked = true; return; }
    scaleCheckboxesEl.querySelectorAll('input').forEach(cb => {
      cb.disabled = checked.length === 1 && cb.checked;
    });
    saveEnabledScales();
  });

  // Apply initial guard state
  const checked = [...scaleCheckboxesEl.querySelectorAll('input:checked')];
  scaleCheckboxesEl.querySelectorAll('input').forEach(cb => {
    cb.disabled = checked.length === 1 && cb.checked;
  });
}

// ── Randomize ─────────────────────────────────────────────────
function randomize() {
  const { rootPitchClass, rootName, modeName, scaleNotes, triads } =
    randomKeyAndMode(getEnabledModes());
  const chord = pickRandomChord(triads, rootPitchClass);

  rootNameEl.textContent = rootName;
  modeNameEl.textContent = modeName;

  // Notes in scale-degree order (from root)
  const intervals = SCALE_DEFS[modeName];
  scaleNotesEl.innerHTML = intervals
    .map(i => `<span class="scale-note-item">${ROOT_NAMES[(rootPitchClass + i) % 12]}</span>`)
    .join('');

  // Step sizes between notes
  scaleStepsEl.innerHTML = getStepSizes(intervals)
    .map(s => `<span class="scale-step-item">${s}</span>`)
    .join('');

  // Scales sharing the same note set
  const related = findRelatedScales(rootPitchClass, modeName);
  if (related.length > 0) {
    relatedScalesEl.textContent = related.map(r => `${r.rootName} ${r.modeName}`).join(', ');
    relatedSection.hidden = false;
  } else {
    relatedSection.hidden = true;
  }

  chordLabelEl.textContent = chord.label;
  chordNotesEl.textContent = `(${chord.notes.map(pc => ROOT_NAMES[pc]).join(' – ')})`;

  // Flavor card
  const info = SCALE_INFO[modeName];
  if (info) {
    flavorFeelEl.textContent = info.feel;
    flavorGenresEl.innerHTML = info.genres
      .map(g => `<span class="flavor-genre-tag">${g}</span>`).join('');
    flavorTipEl.textContent = info.tip;
    flavorBrightnessEl.setAttribute('data-brightness', info.brightness);
    if (info.alias) {
      modeAliasEl.textContent = info.alias;
      modeAliasEl.hidden = false;
    } else {
      modeAliasEl.hidden = true;
    }
  }

  applyKeyHighlights(scaleNotes, rootPitchClass);
}

// ── Status bar helpers ───────────────────────────────────────
let lastMidiStatus  = 'No MIDI device detected';
let micController   = null;

function updateMidiStatus(deviceName) {
  lastMidiStatus = deviceName ? `MIDI: ${deviceName}` : 'No MIDI device detected';
  // Don't overwrite the status bar while mic is active
  if (!micController) midiStatusEl.textContent = lastMidiStatus;
}

function updateMicStatus(status) {
  if (status === 'Mic: listening') {
    midiStatusEl.textContent = status;
    micBtn.classList.add('is-active');
  } else if (status === null) {
    // Clean stop — restore MIDI status
    midiStatusEl.textContent = lastMidiStatus;
    micBtn.classList.remove('is-active');
    micController = null;
  } else {
    // Error (access denied, unavailable, etc.)
    midiStatusEl.textContent = status;
    micBtn.classList.remove('is-active');
    micController = null;
  }
}

// ── Init ──────────────────────────────────────────────────────
buildKeyboard(
  keyboardCont,
  (midi) => { setPressedState(midi, true);  playNote(midi); },
  (midi) => { setPressedState(midi, false); },
);

initMidi(
  (midi) => { setPressedState(midi, true);  playNote(midi); },
  (midi) =>   setPressedState(midi, false),
  (name) =>   updateMidiStatus(name),
);

buildScaleCheckboxes();
randomize();

randomizeBtn.addEventListener('click', randomize);

micBtn.addEventListener('click', () => {
  if (micController) {
    micController.stop();  // calls updateMicStatus(null) → clears is-active
  } else {
    micBtn.classList.add('is-active');  // instant visual feedback while permission prompt shows
    micController = initMic(
      (midi) => { setPressedState(midi, true);  playNote(midi); },
      (midi) =>   setPressedState(midi, false),
      updateMicStatus,
    );
  }
});
