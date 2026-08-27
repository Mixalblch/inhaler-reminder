# Design system: Inhaler Reminder

## Direction

The implemented direction is Claude Design `2a — Дыхание / Apple-grade`. It replaces the previous Breath Console treatment with a quieter Windows utility surface built around direct status, reversible actions, and real adherence history.

The settings window is 420 px wide and grows up to 968 px tall when the work area allows it. On shorter displays, the content scrolls while the app header and tray footer stay fixed. The always-on-top reminder is 400 × 236 px.

## Visual language

- Light: warm silver `#f2f2f0`, near-white grouped surfaces, dark graphite text.
- Dark: graphite `#151516` with elevated `#262628` grouped surfaces.
- Morning/action: teal `#12a594` (dark theme `#2fd3bc`).
- Evening: restrained lavender.
- Missed dose: a warm neutral notice, not an alarming red state.
- Type: the platform UI stack first, with local Manrope as the deterministic fallback.
- Shape: 12 px grouped settings cards, 20 px notification shell, compact circular steppers, platform-like segmented controls.

## Interaction rules

- Changes save immediately; the temporary “Saved” status is informational rather than a submit state.
- Schedule rows expand in place. Time buttons change values in 15-minute steps.
- Snooze offers 15, 30, and 60 minutes from the reminder, while settings retain the configured default.
- Confirming a dose shows an immediate result and offers Undo before the reminder closes.
- A missed historical dose can be marked retroactively and immediately undone.
- Appearance supports System, Light, and Dark. Reduced-motion preferences are respected.

## History

The last-14-days view is backed by `history.json` in Electron's local user-data directory. It displays real `pending`, `confirmed`, `missed`, and `disabled` states. Days from before installation or days the app never tracked remain unknown instead of being fabricated as missed.

## Assets

- `assets/icon-source.svg` is the source of the teal app icon from direction 2a.
- `npm run render-icon` deterministically regenerates `assets/icon.png` and `assets/tray.png` through Electron's renderer.
- The previous inhaler illustration remains packaged but is no longer used as the primary interface ornament.

## Accessibility

All settings remain native controls or keyboard-operable buttons. Focus rings use the active accent, state is communicated with text as well as color, localization covers Russian and English, and motion collapses under `prefers-reduced-motion`.
