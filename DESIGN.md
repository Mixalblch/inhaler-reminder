# Design system: Inhaler Reminder

## Direction

The implemented direction is Claude Design `2a — Дыхание / Apple-grade`, from
`Inhaler Reminder Redesign.dc.html`. It replaces the previous Breath Console
treatment with a quieter Windows utility built around plain status, reversible
actions, and a real adherence record.

Surfaces:

| Surface | Size | Notes |
| --- | --- | --- |
| Settings | 420 × 968 | Shrinks to the work area; content scrolls, chrome stays pinned |
| Reminder | 400 × 236 | Frameless, always on top, bottom-right of the work area |

## Visual language

- **Light** — warm silver `#f2f2f0` page, white grouped cards, graphite `#1c1c1e` text.
- **Dark** — graphite `#151516` page, elevated `#1c1c1e` cards.
- **Morning / action** — teal `#12a594` (dark `#2fd3bc`).
- **Evening** — lavender `#c3c8f0` (dark indigo `#5b62d6`).
- **Missed** — a warm amber notice, never an alarming red.
- **Type** — the platform UI stack first, local Manrope as the deterministic fallback.
- **Shape** — 12 px grouped cards, 20 px reminder shell, circular steppers, platform-style segmented controls.

Every colour is a CSS custom property defined for both themes. `npm run design-check`
fails the build if a literal colour appears outside the token blocks, or if the dark
theme is missing a token the light theme defines — that is how the previous build ended
up with white switches glowing on a dark background.

### State is never carried by colour alone

| State | Shape |
| --- | --- |
| Taken | filled accent dot |
| Missed | filled muted dot (`#dedcd8` / `#3a3a3c`) |
| Waiting | open ring |
| Off / untracked | open ring at 40% opacity |

Taken and missed differ in fill; missed and waiting differ in silhouette. Every dot
also carries a localized tooltip.

## Interaction rules

- Changes save immediately. The transient "Сохранено" mark is a receipt, not a submit state.
- Schedule rows expand in place over 360 ms; nothing opens on top of the card.
- Time moves in 15-minute steps so a value can be reached without the keyboard.
- "Позже" offers 15 / 30 / 60 inline above the buttons — no floating panel.
- Confirming shows a drawn tick and an Undo, so no press is irreversible.
- A missed dose can be marked retroactively, and that too can be undone.
- The day track is a 24-hour scale: bands are derived from the configured windows and
  the marker follows the clock, updating once a minute.

## History

The 14-day view is backed by `history.json` in Electron's user-data directory, written
atomically with a `.bak` fallback. It shows real `confirmed`, `missed`, `pending`, and
`disabled` states. Days the app never tracked stay unknown rather than being backfilled
as missed, and disabled doses leave the adherence denominator entirely.

## Scheduling contract

`src/main/schedule.js` owns the time arithmetic, and both the scheduler and the history
store call it. That is deliberate: when the two computed the catch-up deadline separately,
a 3-hour snooze could fire a reminder an hour after history had already recorded the dose
as missed. A snooze is now clamped to the deadline, so the two records cannot disagree.

## Assets

- `assets/icon-source.svg` — direction 2a, variant A ("Тиловая").
- `npm run render-icon` regenerates `assets/icon.png` (256) and `assets/tray.png` (32)
  through Electron's own renderer. The label outline drops below 128 px and the exhale
  dots below 24 px; the cap and mouthpiece carry the silhouette at every size.

## Accessibility

Controls are native or real buttons, focus rings use the active accent, and motion
collapses under `prefers-reduced-motion`. Assistive labels come from the locale files —
`design-check` rejects any hardcoded Cyrillic in `aria-label`, `title`, or untranslated
markup, so the English build cannot ship Russian screen-reader text.

Schedule captions and history tooltips use separate strings (`status.*` and `dot.*`)
because "Ожидает" as a row caption and "ожидает" inside "14 авг · ожидает" need
different casing.

## Verification

`npm run capture` writes screenshots and an interaction report to `qa/`.

The reminder is fired **through the scheduler**, not by calling the window directly. That
matters: when a capture shows the reminder without the scheduler owning it, no dose is
pending, so Confirm and Undo silently no-op and the run reports success it did not earn.
`qa/results.json` records `firedThroughScheduler` so the report states which path it took.

Two inputs are stubbed for an unattended run, and only these: the idle timer reports 0
(the user is treated as present) and the rendered theme is forced so light and dark can
both be captured. Scheduling, history, and IPC run unmodified.

### Known, deliberate differences from the source mock

- The reminder's window label shows the live window that actually fired, so a capture
  reads e.g. `00:17 — 03:17` rather than the mock's static `18:00 — 21:00`.
- Dates, the "now" marker, and the missed-dose date are live data and track the real
  calendar rather than the mock's 14–27 August.
- Compound durations render as "1 ч 30 мин"; the mock abbreviates to "1 ч 30 м", which
  is ambiguous in Russian.
