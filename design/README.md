# Handoff: ImproWiz Main Practice View

## Overview
The main/home screen of ImproWiz — a real-time improvisation practice tool. It shows the current scale/key, the target chord progression, the chord currently sounding, a live performance score, and a full-width virtual keyboard that highlights which notes are in-scale, chord tones, or "avoid until you resolve" tensions, both for the notes physically in reach (active octave zone) and notes further up/down the keyboard.

## About the Design Files
The bundled HTML file is a **design reference built as a standalone prototype**, not production code to copy directly. It uses a template/logic scripting system (custom `<sc-for>`/`<sc-if>` markup and a `DCLogic` class) that only exists in the design tool — none of that scaffolding should be ported. Treat this as the source of truth for **layout, color, type, spacing, and interaction behavior**, and reimplement it using the target codebase's actual framework (React/Vue/Swift/etc.) and existing component patterns.

## Fidelity
**High-fidelity.** Colors, type sizes/weights, spacing, and the keyboard's coloring logic are final — implement pixel-for-pixel where practical.

## Layout Overview
Single-column desktop layout (`min-width: 1140px`), four stacked horizontal zones, no cards/borders as containers — zones are separated only by 1px hairlines (`var(--border)`). Root container is `display:flex; flex-direction:column`, filling the viewport height (`min-height:100vh`).

1. **Top bar** (`flex-shrink:0`, ~42px content height, `padding:9px 24px`, bottom hairline)
2. **Status zone** (`padding:13px 26px`, bottom hairline)
3. **Annotation zone** — 3-column CSS grid: `grid-template-columns: 230px 1fr 260px`, columns separated by vertical hairlines, each column `padding:12px 22px` (center column `26px` horizontal)
4. **Hero keyboard** — fills all remaining vertical space (`flex:1`), keyboard itself pinned to the bottom edge

### 1. Top bar
- Left: 20×20px solid rounded-square logo mark (`border-radius:6px`, fill `var(--primary)`) + wordmark "ImproWiz" (Space Grotesk 700, 16px)
- 1px vertical divider (18px tall, `var(--border)`)
- Mode toggle: "Free Play" / "Target" text tabs (13px→12px Hanken Grotesk 700; active = `var(--primary)` text + 2px bottom border in that color; inactive = `var(--muted)` text, transparent border)
- 1px vertical divider
- Difficulty toggle: "Beginner" / "Intermediate" / "Advanced" (same tab pattern; active uses `var(--ink)` for text+underline instead of the accent color, inactive `var(--faint)`)
- Right side (`margin-left:auto`, gap 20px):
  - MIDI status: 7px dot (`var(--good)`, pulsing opacity 1→0.3 over 2s) + "MIDI · Roland FP-30" (11px 600, `var(--muted)`)
  - Streak: "Streak" label (11px 500 muted) + "12" (Space Grotesk 700 13px, `var(--n-tension)`) + "days" (11px 500 muted)
  - Theme toggle button: bordered pill, `border:1px solid var(--border)`, `border-radius:8px`, `padding:6px 12px`, text "Light mode"/"Dark mode" (11px 700)

### 2. Status zone
Single row, `align-items:center`, gap 20px:
- Scale name "C Dorian" — Space Grotesk 700, **46px**, `letter-spacing:-.02em`
- Key signature note: "2 flats · B♭, E♭" (14px 600, `var(--muted)`)
- `margin-left:auto` pushes the rest right:
  - **Target** stack (right-aligned column): label "TARGET" (10px 800, letter-spacing .1em, `var(--primary)`) over "ii–V–I in B♭ · Bar 3/8" (13px 600, `var(--ink)`)
  - Progress bar: 110×6px pill track (`var(--track)`), filled portion `var(--primary)`, currently 37%
  - 1px vertical divider, 36px tall
  - **Now Playing**: 8px pulsing dot (`var(--primary)`, 1.2s pulse) + label "NOW PLAYING" (10px 700 uppercase, `var(--faint)`) over chord name "Cm7" (Space Grotesk 700, **34px**)
  - **Score ring**: 56px circle, `conic-gradient(var(--n-chord) 0 87%, var(--track) 87% 100%)`, inner 42px circle punched out in `var(--bg)` showing "87" (Space Grotesk 700 16px) centered

### 3. Annotation zone (3 columns, grid `230px 1fr 260px`)

**Left — "Notes of the scale"** (single column list, NOT a 2-col grid):
- Eyebrow: "NOTES OF THE SCALE" (10px 700 uppercase, letter-spacing .08em, `var(--faint)`) + "Parent: B♭ Major" (11px 600, `var(--faint)`)
- 7 rows, `gap:5px`, each row: note letter fixed-width 26px column (Hanken Grotesk **700, 20px**, colored by role — root=`var(--n-root)`, chord tone=`var(--n-chord)`, tension=`var(--n-tension)`) + role label (13px 500, `var(--faint)`, or bold+colored for the starred/emphasized tension note "★ 13")
  - Rows: C (1·Root), D (9·Tension), E♭ (♭3·Chord), F (11·Tension), G (5·Chord), A (★13, tension-colored+bold), B♭ (♭7·Chord)
- Hairline divider
- "SOUNDS GOOD OVER" eyebrow + "Cm7 · Cm6 · Cm9 · Cm11" (13px 600, `var(--muted)`)

**Center — "Scale identity · score"**:
- Eyebrow label
- Row: descriptive sentence (14px/1.5 500, `var(--muted)`, max-width 280px) — "Minor, but hopeful — the natural 6th lifts the shadows." — next to a 2×2 metric grid (`gap:8px 24px`) of labeled progress bars: In-key 96, Resolution 82, Rhythm 78, Phrasing 64. Each metric: label+value row (12px 600) over a 5px pill track (`var(--track)`) filled with `var(--meter)`.

**Right — "Where to go next"**:
- Eyebrow + tab switcher "Theory"/"Goal" (11px 700; active `var(--ink)`, inactive `var(--faint)`, no underline on these small tabs)
- Single column list (NOT side-by-side), `gap:6px`: two suggested next chords, each as one line — chord name in **Space Grotesk 700, 20px** followed inline by a lighter annotation (13px 500, `var(--muted)`): "F7 V7, pulls home" and "E♭maj7 stays warm"
- Hairline divider
- Coach tip line (13px/1.4 500, `var(--muted)`): "**Coach:** lean on **A** at the end of a phrase to show off the raised 6th." — "Coach:" and "A" are bold; "A" is colored `var(--n-tension)`.

### 4. Hero keyboard
- Legend row above the keys (`padding:0 24px 6px`, gap 16px): three items, each a 9×9px rounded-square swatch + label (11px 600, `var(--muted)`) — Root (`var(--n-root)`), Chord tone (`var(--n-chord)`), Tension (`var(--n-tension)`)
- Keyboard strip: **155px tall**, full viewport width, **edge-to-edge with no outer margin/padding**, flush left and right, hairline top border only
- 52 white keys rendered as equal-width flex children (`flex:0 0 (100/52)%`) filling 100% width and height, each with a 1px right border (`var(--key-border)`); black keys absolutely positioned on top at `left/width` computed from white-key spacing, 62% of the strip's height, `border-radius:0 0 4px 4px`
- Every "C" white key shows its octave label ("C3", "C4"...) centered near the top, 10px 700, `var(--faint)`
- **Key coloring is fully edge-to-edge — no rounded insets, gaps, or padding versus the key's own bounds** (`position:absolute; inset:0`):
  - **Held / currently played** notes: full-bleed fill in the role color (root/chord/tension), with the note's letter name label bottom-aligned in white, Space Grotesk 700 (14px on white keys, 10px on black keys)
  - **In active-zone, not held** notes (the octaves within comfortable hand reach — currently octaves 3–5): full-bleed fill in the role color at reduced opacity (white keys 0.55, black keys 0.7) — no label
  - **Out-of-zone** notes (same pitch class elsewhere on the keyboard): small tick mark only — a `4px` tall rounded bar near the bottom of the key, inset 8px (white) / 5px (black) from the sides, role color at 0.5 opacity
  - Non-functional notes (not in scale/chord role) get no coloring at all

## Interactions & Behavior
- **Mode toggle** (Free Play / Target): switches active tab styling; no other behavior specified in this prototype — wire to whatever practice-mode logic exists.
- **Difficulty toggle** (Beginner / Intermediate / Advanced): same tab-switch pattern, default selected = Advanced.
- **Theory / Goal tabs** in the right column: switches which annotation content the column shows (this prototype only mocks the "Theory" state's content — the "Goal" state's content needs to be defined/wired to real data).
- **Theme toggle button**: swaps every CSS custom property listed under Design Tokens below between the dark and light sets. Default is dark mode.
- **MIDI status dot** and **Now Playing dot**: continuous opacity pulse, 1→0.3→1, 2s and 1.2s loop respectively (`ease` implied, simple keyframes).
- All colored keyboard/annotation states are **derived from data**, not hardcoded: which pitch classes are chord tones vs. tensions vs. root, which octave range counts as the "active zone," and which notes are currently held all come from the current scale/chord/reach state — this prototype hardcodes one example (C Dorian over Cm7, chord tones 0/3/7/10, tensions 2/5/9, active octaves 3–5, held notes C-E♭-G-B♭ in octave 4).

## State Management
Minimum state needed to reproduce this screen:
- `theme`: 'dark' | 'light'
- `mode`: 'free' | 'target'
- `difficulty`: 'beginner' | 'intermediate' | 'advanced'
- `rightPanelTab`: 'theory' | 'goal'
- Musical state (from the app's real engine, not UI state): current scale/key, its note roles (root/chord-tone/tension per pitch class), current chord name, target progression + progress, active/reachable octave range, currently held note(s), and the four score metrics (in-key, resolution, rhythm, phrasing) plus overall score (87 in this mock).

## Design Tokens

### Typography
- Display font: **Space Grotesk** (500/600/700) — used for the logo wordmark, scale name, chord names, score number, "Where to go next" chord names
- Body font: **Hanken Grotesk** (400/500/600/700/800) — everything else
- Scale name: 46px/700; Now Playing chord: 34px/700; next-chord names: 20px/700; scale note letters: 20px/700; score ring number: 16px/700

### Colors — Dark (default)
| Token | Hex | Role |
|---|---|---|
| `--bg` | `#161514` | Page background |
| `--surface` | `#1f1e1c` | (reserved for raised surfaces, unused as a container here) |
| `--card` | `#242220` | (reserved) |
| `--ink` | `#eae6dd` | Primary text |
| `--muted` | `#8f8a7e` | Secondary text |
| `--faint` | `#6f6a5e` | Tertiary/eyebrow text |
| `--border` | `rgba(255,255,255,.09)` | Hairlines |
| `--primary` / `--n-root` | `#c2a05c` | Brass — root note, target/active accents |
| `--n-chord` / `--good` | `#7ea395` | Muted teal — chord tones, score ring fill, MIDI-connected dot |
| `--n-tension` | `#b3847c` | Dusty rose — tension notes, streak count |
| `--n-avoid` | `#8f8a7e` | Reserved for avoid-notes (unused in this scene) |
| `--n-dim` | `#3a3733` | Reserved dim fill |
| `--meter` | `#8f8a7e` | Score-metric bar fill |
| `--track` | `#2b2925` | Progress/meter bar track |
| `--key-white` | `#ece7da` | White key fill |
| `--key-black` | `#17150f` | Black key fill |
| `--key-border` | `#c9c3b2` | White key divider |

### Colors — Light
| Token | Hex |
|---|---|
| `--bg` | `#f2ede2` |
| `--surface` | `#f9f6ee` |
| `--card` | `#fcfaf3` |
| `--ink` | `#221f1a` |
| `--muted` | `#7d7568` |
| `--faint` | `#9a9284` |
| `--border` | `#e1d9c8` |
| `--primary` / `--n-root` | `#a3813f` |
| `--n-chord` / `--good` | `#4f7a6c` |
| `--n-tension` | `#9c6b62` |
| `--n-avoid` | `#a89f8f` |
| `--n-dim` | `#eee7d6` |
| `--meter` | `#8a8272` |
| `--track` | `#e4dbc7` |
| `--key-white` | `#fefcf6` |
| `--key-black` | `#211d16` |
| `--key-border` | `#ddd3bf` |

**Color usage rule**: only three functional accent colors ever appear — brass (root), muted teal (chord tone), dusty rose (tension) — reused consistently across the note list, the keyboard, the score ring, and the streak counter. Everything else is neutral ink/muted/faint on a warm graphite (dark) or warm paper (light) background. Do not introduce additional accent hues.

### Spacing / structure
- Zone padding: top bar `9px 24px`; status zone `13px 26px`; annotation columns `12px 22px` (center `12px 26px`)
- Annotation grid columns: `230px 1fr 260px`
- Hairlines: `1px solid var(--border)` everywhere (never a heavier border or drop shadow as a separator)
- Keyboard strip height: fixed `155px`, full width, zero outer padding/margin
- Root container: `min-width: 1140px` (desktop-only; add horizontal scroll below that width rather than reflowing)

## Assets
No images/icons — the logo mark is a plain 20×20px filled rounded square (`var(--primary)`), not an image asset.

## Files
- `ImproWiz Main v5.dc.html` — the full design reference described above (open directly in a browser; the templating tags are prototype-only, see "About the Design Files").
