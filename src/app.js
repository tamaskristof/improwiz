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
const modeDerivationEl   = document.getElementById('mode-derivation');
const siblingSection     = document.getElementById('sibling-scales-section');
const siblingChipsEl     = document.getElementById('sibling-chips-list');
const runScoreEl         = document.getElementById('run-score');
const runScoreHeadingEl  = document.getElementById('run-score-heading');
const runScoreScaleEl    = document.getElementById('run-score-scale');
const runScoreGradeEl    = document.getElementById('run-score-grade');
const runScoreAccuracyEl = document.getElementById('run-score-accuracy');
const runScoreDetailEl   = document.getElementById('run-score-detail');

// ── Scale settings ───────────────────────────────────────────
const LS_KEY = 'improwiz_enabled_scales';

function getEnabledModes() {
  const cbs = scaleCheckboxesEl.querySelectorAll('.scale-family-modes input[type="checkbox"]');
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
  return DEFAULT_ENABLED_SCALES;
}

function buildScaleCheckboxes() {
  const enabled = loadEnabledScales();
  scaleCheckboxesEl.innerHTML = Object.entries(SCALE_FAMILIES).map(([family, names]) => `
    <div class="scale-family-group">
      <label class="scale-family-label">
        <input type="checkbox" class="scale-family-toggle" data-family="${family}" />
        ${family}
      </label>
      <div class="scale-family-modes">
        ${names.map(name => `
          <label class="scale-checkbox-label">
            <input type="checkbox" value="${name}"${enabled.includes(name) ? ' checked' : ''} />
            ${name}
          </label>`).join('')}
      </div>
    </div>`).join('');

  scaleCheckboxesEl.addEventListener('change', (e) => {
    if (e.target.classList.contains('scale-family-toggle')) {
      const group = e.target.closest('.scale-family-group');
      const modeInputs = [...group.querySelectorAll('.scale-family-modes input')];
      modeInputs.forEach(cb => { cb.checked = e.target.checked; });
      const checked = [...scaleCheckboxesEl.querySelectorAll('.scale-family-modes input:checked')];
      if (checked.length === 0) {
        e.target.checked = true;
        modeInputs.forEach(cb => { cb.checked = true; });
      }
      applyCheckboxGuard();
      saveEnabledScales();
      return;
    }
    if (e.target.type !== 'checkbox') return;
    const checked = [...scaleCheckboxesEl.querySelectorAll('.scale-family-modes input:checked')];
    if (checked.length === 0) { e.target.checked = true; return; }
    applyCheckboxGuard();
    saveEnabledScales();
  });

  applyCheckboxGuard();
}

// At least one scale must stay enabled; disable the last checked box so it can't be
// unchecked, and keep each family's header toggle in sync with its members.
function applyCheckboxGuard() {
  const checked = [...scaleCheckboxesEl.querySelectorAll('.scale-family-modes input:checked')];
  scaleCheckboxesEl.querySelectorAll('.scale-family-modes input').forEach(cb => {
    cb.disabled = checked.length === 1 && cb.checked;
  });
  scaleCheckboxesEl.querySelectorAll('.scale-family-group').forEach(group => {
    const modeInputs = [...group.querySelectorAll('.scale-family-modes input')];
    const familyToggle = group.querySelector('.scale-family-toggle');
    const checkedCount = modeInputs.filter(cb => cb.checked).length;
    familyToggle.checked = checkedCount === modeInputs.length;
    familyToggle.indeterminate = checkedCount > 0 && checkedCount < modeInputs.length;
  });
}

// ── Run score card ───────────────────────────────────────────
// The card tracks the run in progress. Between a Randomize press and the first note
// of the new run there's nothing live to show, so it falls back to the run that just
// ended — otherwise hitting Randomize would wipe the grade you just earned.
let currentRunLabel = null;
let lastRunSummary  = null;
let lastRunLabel    = null;

function renderScoreCard() {
  const live = getRunScore();
  if (live)           return paintScoreCard(live, currentRunLabel, 'This run', true);
  if (lastRunSummary) return paintScoreCard(lastRunSummary, lastRunLabel, 'Last run', false);
  runScoreEl.hidden = true;
}

function paintScoreCard(summary, label, heading, isLive) {
  runScoreHeadingEl.textContent = heading;
  runScoreScaleEl.textContent   = label ?? '';
  runScoreGradeEl.textContent   = summary.grade ?? '';
  runScoreAccuracyEl.innerHTML  =
    `<span class="run-score-pct">${Math.round(summary.accuracy * 100)}%</span> in scale`;

  // Spell out what moved the grade, so it doesn't read as an arbitrary letter.
  const detail = [`${summary.strayNotes} stray / ${summary.totalNotes} played`];
  if (summary.passingNotes > 0) {
    detail.push(`${summary.passingNotes} passing tone${summary.passingNotes === 1 ? '' : 's'}`);
  }
  detail.push(`${summary.degreesUsed} of ${summary.scaleSize} degrees`);
  if (summary.chordToneRatio !== null) {
    detail.push(`${Math.round(summary.chordToneRatio * 100)}% chord tones`);
  }
  if (!summary.graded) {
    detail.push(`${summary.notesToGrade} more note${summary.notesToGrade === 1 ? '' : 's'} for a grade`);
  }
  runScoreDetailEl.textContent = detail.join(' · ');

  runScoreEl.classList.toggle('is-live', isLive);
  runScoreEl.hidden = false;
}

// ── Randomize ─────────────────────────────────────────────────
function randomize() {
  // Randomize is the run boundary: bank what was just played, then start fresh.
  // Only keep a graded run — a stray note or two shouldn't leave a bogus letter up.
  const finished  = endRun();
  lastRunSummary  = finished && finished.graded ? finished : null;
  lastRunLabel    = currentRunLabel;

  const { rootPitchClass, rootName, modeName, scaleNotes, triads } =
    randomKeyAndMode(getEnabledModes());
  const chord = pickRandomChord(triads, rootPitchClass);

  rootNameEl.textContent = rootName;
  modeNameEl.textContent = modeName;

  // Notes in scale-degree order (from root)
  const intervals = SCALE_DEFS[modeName];
  const derivation = getDerivation(modeName);
  const characteristicIndices = new Set(derivation ? derivation.degreeIndices : []);
  const characteristicNotes = new Set(
    [...characteristicIndices].map(i => (rootPitchClass + intervals[i]) % 12));

  scaleNotesEl.innerHTML = intervals
    .map((i, idx) => `<span class="scale-note-item${characteristicIndices.has(idx) ? ' is-characteristic' : ''}">${ROOT_NAMES[(rootPitchClass + i) % 12]}</span>`)
    .join('');

  // Step sizes between notes
  scaleStepsEl.innerHTML = getStepSizes(intervals)
    .map(s => `<span class="scale-step-item">${s}</span>`)
    .join('');

  // "= Major with #4" — hidden for the anchors (Ionian/Aeolian), which already show an alias.
  const derivationText = formatDerivation(derivation);
  if (derivationText) {
    modeDerivationEl.textContent = `= ${derivationText}`;
    modeDerivationEl.hidden = false;
  } else {
    modeDerivationEl.hidden = true;
  }

  // Siblings: same root, one degree moved
  const siblings = getSiblings(rootPitchClass, modeName);
  if (siblings.length > 0) {
    siblingChipsEl.innerHTML = siblings
      .map(s => `<span class="sibling-chip">${s.rootName} ${s.modeName} <span class="sibling-chip-change">${s.noteChange}</span></span>`)
      .join('');
    siblingSection.hidden = false;
  } else {
    siblingSection.hidden = true;
  }

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
    flavorBrightnessEl.setAttribute('data-brightness', getBrightness(modeName));
    if (info.alias) {
      modeAliasEl.textContent = info.alias;
      modeAliasEl.hidden = false;
    } else {
      modeAliasEl.hidden = true;
    }
  }

  applyKeyHighlights(scaleNotes, rootPitchClass, characteristicNotes);

  currentRunLabel = `${rootName} ${modeName}`;
  startRun({ scaleNotes, rootPitchClass, chordNotes: chord.notes });
  renderScoreCard();
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

// Only MIDI feeds the tracker — mouse clicks and mic input light keys but don't score.
initMidi(
  (midi, velocity) => { setPressedState(midi, true);  recordNoteOn(midi, velocity); playNote(midi); renderScoreCard(); },
  (midi) =>           { setPressedState(midi, false); recordNoteOff(midi);          renderScoreCard(); },
  (name) =>             updateMidiStatus(name),
);

// Note events cover most of the card's movement, but a note being *held* keeps changing
// the duration-weighted score with no event to hang off — so tick while keys are down.
setInterval(() => { if (hasHeldNotes()) renderScoreCard(); }, 250);

buildScaleCheckboxes();
randomize();

randomizeBtn.addEventListener('click', randomize);

micBtn.addEventListener('click', () => {
  if (micController) {
    micController.stop();  // calls updateMicStatus(null) → clears is-active
  } else {
    micBtn.classList.add('is-active');  // instant visual feedback while permission prompt shows
    micController = initMic(
      (midi) =>   setPressedState(midi, true),
      (midi) =>   setPressedState(midi, false),
      updateMicStatus,
    );
  }
});
