---
version: 1
slug: "src-renderer-settings-settings-html"
primary_target: "src/renderer/settings/settings.html"
related_targets: ["src/renderer/notification/notification.html"]
---

# Settings and notification surfaces

## Scope and mode

- Scope: `src/renderer/settings/settings.html` and `src/renderer/notification/notification.html`.
- Mode: Operate.
- Approved comp: `.impeccable/mocks/comparison-preview.png` with the notification detail in `.impeccable/mocks/comparison-preview-lower.png`.

## User, task, and constraints

- A person with asthma configures two daily reminder windows and acts on a compact Windows notification.
- Preserve every existing ID, action, IPC flow, localization key, tray behavior, time and number input, switch, and keyboard affordance.
- Keep Russian and English copy fitting the fixed 480x680 settings and 380x230 notification windows.

## Chosen direction

Breath Console translates Claude Code's disciplined utility character into a home medical reminder without copying a terminal. A charcoal equipment rail holds one authored inhaler illustration; the warm work surface uses thin rules, quiet hierarchy, and clay/sage state color. The memorable moment is the same real inhaler crossing from the rail into the notification, making both windows unmistakably one product.

## Sampled visual record

| Role | Value |
| --- | --- |
| Page ground | `#f2efe7` |
| Raised work surface | `#fbf8f0` |
| Equipment rail and primary ink | `#28251f` |
| Action and enabled state | `#c45f42` |
| Saved state | `#61705c` |
| Structural rule | `#c8c0b4` |

## Fidelity inventory

| Ingredient | Medium | Commitment |
| --- | --- | --- |
| Settings equipment rail | Semantic HTML/CSS | Narrow opaque charcoal column, not a card or gradient |
| Inhaler object | Generated transparent raster | `.impeccable/mocks/inhaler-illustration-v1.png`, prepared for shipping as `assets/inhaler-illustration.png` |
| Settings schedule | Native inputs and switches in semantic HTML/CSS | Two aligned daily rows with time as the numeric emphasis |
| Notification and preferences | Native inputs/select/switches in semantic HTML/CSS | Quiet ruled groups, no nested cards |
| Notification | Semantic HTML/CSS plus the same inhaler raster | 112px object bay, clear message, primary confirm and secondary snooze actions |
| Icons | Existing authored inline SVG where useful | Consistent 2px stroke; no emoji or Unicode stand-ins |
| Text and controls | Semantic HTML/CSS | Never rasterized; visible focus and disabled states remain functional |

## Unresolved decisions

None for implementation. The user approved the before/after comp and requested a GitHub branch for testing.
