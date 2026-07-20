// scripts/fetch-samples.mjs — download the self-hosted Salamander piano samples.
//
// @tonejs/piano normally streams its samples from https://tambien.github.io/Piano/Salamander/,
// which breaks offline (the app is a PWA) and can't be precached cross-origin. This mirrors the
// note samples into public/salamander/ so we serve them from our own origin under the /improwiz/
// base path. Run once: `node scripts/fetch-samples.mjs` (or `npm run fetch-samples`).
//
// We build the piano with `release:false, pedal:false` (see src/state/audio.svelte.ts), so only the
// per-note velocity layers are needed — no rel*/harmS*/pedal* files. All 16 velocity layers of every
// sampled pitch are fetched so any `velocities` setting works; the app only actually *plays* the
// subset a given setting selects (per @tonejs/piano's velocitiesMap).

import { mkdir, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// The samples that @tonejs/piano expects (its default `githubURL`) live on the repo's gh-pages
// branch under Salamander/, but the published Pages site no longer serves them — fetch from raw.
const BASE_URL = 'https://raw.githubusercontent.com/tambien/Piano/gh-pages/Salamander/';
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'salamander');

// Salamander samples every third note; matches allNotes in @tonejs/piano's Salamander.ts.
const SAMPLED_MIDI = Array.from({ length: 30 }, (_, i) => 21 + i * 3); // 21..108
const VELOCITIES = Array.from({ length: 16 }, (_, i) => i + 1); // 1..16
const CONCURRENCY = 12;

// Mirror of @tonejs/piano's midiToNote (Tone's Frequency(midi,'midi').toNote()), with '#' -> 's'.
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function sampleName(midi) {
  const name = NOTE_NAMES[midi % 12] + (Math.floor(midi / 12) - 1);
  return name.replace('#', 's');
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function fetchOne(file) {
  const dest = join(OUT_DIR, file);
  if (await exists(dest)) return { file, skipped: true };
  const res = await fetch(BASE_URL + file);
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
  return { file, bytes: buf.length };
}

async function run() {
  await mkdir(OUT_DIR, { recursive: true });

  const files = [];
  for (const midi of SAMPLED_MIDI) {
    for (const vel of VELOCITIES) files.push(`${sampleName(midi)}v${vel}.mp3`);
  }

  console.log(`Fetching ${files.length} samples into ${OUT_DIR} …`);
  let done = 0;
  let downloaded = 0;
  let totalBytes = 0;

  const queue = files.slice();
  async function worker() {
    while (queue.length) {
      const file = queue.shift();
      const r = await fetchOne(file);
      done++;
      if (!r.skipped) {
        downloaded++;
        totalBytes += r.bytes;
      }
      if (done % 40 === 0 || done === files.length) {
        process.stdout.write(`\r  ${done}/${files.length}`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(
    `\nDone. ${downloaded} downloaded (${(totalBytes / 1e6).toFixed(1)} MB), ${
      files.length - downloaded
    } already present.`,
  );
}

run().catch((err) => {
  console.error('\nfetch-samples failed:', err.message);
  process.exit(1);
});
