# Design QA — Claude Design 2a

## Comparison target

- Source visual truth: `design-source.dc.html`, direction `2a — Дыхание / Apple-grade`.
- Source settings capture: `qa/reference-2a-settings.png`.
- Source notification capture: `qa/reference-2a-notification.png`.
- Implementation settings capture: `qa/implementation-settings.png`.
- Implementation notification capture: `qa/implementation-notification.png`.
- Compact implementation capture: `qa/implementation-settings-compact.png`.
- State: Russian, light appearance, morning confirmed at 09:24, evening pending, previous evening missed, 14-day history populated.

## Viewport and normalization

- Settings source: 420 × 968 px; target CSS size 420 × 968; density 1.
- Settings implementation: Electron `webContents.capturePage()`, 420 × 968 px; CSS size 420 × 968; density 1.
- Notification source: 400 × 236 px; target CSS size 400 × 236; density 1.
- Notification implementation: Electron `webContents.capturePage()`, 400 × 236 px; CSS size 400 × 236; density 1.
- Compact implementation: 400 × 680 px; the content scrolls, has no horizontal overflow, and the fixed footer remains visible.
- Crops exclude browser and OS chrome. The settings source includes the mock's rounded outer presentation shell; the implementation capture is app-owned content inside a native framed BrowserWindow.

## Full-view comparison evidence

The final settings comparison confirms the same content order, 18 px page margins, 52 px header, 42 px tray footer, 14-day two-row history, grouped schedule card, grouped reminder and application cards, teal/lavender state palette, and matching 420 × 968 density. The real-data denominator is derived from tracked scheduled doses; the seeded QA state therefore reproduces `24 из 28` without hard-coded UI copy.

The final notification comparison confirms the 400 × 236 frame, 20 px shell radius, dose metadata row, title/body wrapping, source-derived breathing ornament, 42 px actions, and the intended primary/secondary widths.

## Focused region comparison evidence

- History and missed-dose card: dot count, row labels, date anchors, score, warm missed state, action placement, and copy match the target. Pending and missed history dots use neutral outlines; confirmed dots use teal.
- Schedule: the two collapsed rows share one grouped surface and expose time, status, and chevron exactly in the default state. Toggles live in the expanded editors as shown by the source interaction model.
- Reminder controls: default snooze is shown in minutes; catch-up values format whole hours as `2 ч` while persisting minutes internally.
- Application controls: Sound, autostart, System/Light/Dark, and RU/EN use source-matched switches and segmented controls.
- Notification: the ornament, typography, spacing, and action geometry remain readable at native size; no focused crop beyond the full 400 × 236 capture was necessary.

## Required fidelity surfaces

- Fonts and typography: platform UI stack with local Manrope fallback; hierarchy, wrapping, line height, and optical weights match the reference. Native Chromium antialiasing is sharper than the exported design capture, which is expected.
- Spacing and layout rhythm: equal source/implementation pixel sizes; section positions, card grouping, margins, footer, and reminder action alignment match. Compact width remains usable through vertical scrolling and in-place expansion.
- Colors and tokens: light and dark tokens are implemented; teal action/morning, lavender evening, neutral pending, warm missed, and red quit semantics match direction 2a.
- Image quality and asset fidelity: the source-provided breathing SVG geometry is reused directly in the reminder. The app/tray icon is generated from the source's teal icon direction and remains sharp at 256 and 32 px. No placeholder imagery is present.
- Copy and content: Russian and English cover today status, history, backdating, themes, notification result/snooze states, and tray actions. Dynamic dates, times, counts, and states come from stored data.

## Interaction and accessibility checks

- Schedule editor expanded and collapsed successfully.
- Numeric stepper changed and returned to its original persisted value.
- System, Light, and Dark appearance states applied successfully.
- Backdate and Undo completed against persisted history.
- Snooze choices opened; confirm result appeared; notification Undo restored the idle state.
- Focus-visible styling and reduced-motion behavior are present.
- Electron renderer console errors: none.

## Comparison history

1. Initial capture: implementation inherited the host dark theme while the selected source state was light; schedule rows were separate, toggles were visible while collapsed, pending dots were lavender-filled, and the history denominator excluded today's pending dose.
2. Fixes: forced a normalized light QA state, grouped schedule rows, moved toggles into expanded editors, neutralized pending dots, counted tracked pending doses, formatted catch-up hours, replaced the language select with a segmented control, matched header/footer heights, and tightened section rhythm.
3. Post-fix evidence: `qa/implementation-settings.png` and `qa/implementation-notification.png` have no actionable P0/P1/P2 differences from their source captures.

## Findings

No actionable P0, P1, or P2 findings remain.

## Follow-up polish

- P3: Native Windows title-bar and outer-window corner rendering are owned by Electron/Windows and are not represented in the app-content captures.
- P3: Exact glyph antialiasing varies between the Claude Design export and the installed Windows font renderer.

## Final result

final result: passed
