---
name: Inhaler Reminder
description: A calm local Windows breath console for a dependable twice-daily routine.
colors:
  paper: "#f2efe7"
  paper-high: "#fbf8f0"
  paper-low: "#e8e3d9"
  ink: "#28251f"
  clay: "#c45f42"
  clay-dark: "#8f432f"
  sage: "#61705c"
  line: "#c8c0b4"
  line-strong: "#aea598"
  notification-line: "#b8afa2"
  muted: "#6f685e"
  danger: "#9b4139"
  control-surface: "#fffdf7"
  rail-accent: "#ed7957"
typography:
  display:
    fontFamily: "Manrope Local, sans-serif"
    fontSize: "22px"
    fontWeight: 720
    lineHeight: 1.1
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Manrope Local, sans-serif"
    fontSize: "17px"
    fontWeight: 720
    lineHeight: 1.16
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Manrope Local, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "Manrope Local, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "Manrope Local, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "0.065em"
rounded:
  control: "6px"
  notification: "10px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "7px"
  md: "13px"
  lg: "18px"
components:
  button-primary:
    backgroundColor: "{colors.clay-dark}"
    textColor: "{colors.paper-high}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 10px"
    height: "33px"
  button-primary-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper-high}"
  button-secondary:
    backgroundColor: "{colors.control-surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 10px"
    height: "33px"
  field:
    backgroundColor: "{colors.control-surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 8px"
    height: "32px"
---

# Design System: Inhaler Reminder

## Overview

**Creative North Star: "Breath Console"**

Breath Console makes a twice-daily health routine feel like a calm, dependable instrument. Both local Electron surfaces belong to one authored world: a warm paper workspace is anchored by charcoal equipment bays, quiet rules, and a single inhaler object rather than generic healthcare decoration.

The system is compact, tactile, and operational. It uses clay for intentional action, sage for confirmation, and restrained motion only to clarify state. The settings ledger moves from schedule to notification behavior to preferences and then recedes to the tray; the notification identifies the dose, presents the reminder, and offers confirm or defer without demanding navigation. The redesign preserves the existing element IDs, actions, localization, IPC behavior, and native control semantics.

**Key Characteristics:**

- Warm paper fields anchored by charcoal equipment bays.
- Clay is action, sage is confirmation, and thin rules organize content.
- Manrope drives the interface; monospace is reserved for measurements and small equipment metadata.
- One authored inhaler illustration links settings and notification.

## Colors

Warm mineral neutrals carry almost the entire interface; clay and sage appear sparingly as legible operational signals.

### Primary

- **Fired Clay:** Marks enabled switches and the decisive notification action.
- **Deep Clay:** Carries the confirm button, text selection, and visible keyboard-focus outline.

### Secondary

- **Quiet Sage:** Confirms saved state and distinguishes evening or informational status without competing with actions.

### Neutral

- **Workshop Paper:** Main settings ground.
- **Raised Paper:** Headers, notification message field, and switch knobs.
- **Tray Paper:** Settings footer and low-emphasis grounded regions.
- **Charcoal Equipment Ink:** Primary text and the object rail or bay.
- **Graphite Muted:** Supporting copy, labels, and hints.
- **Rule and Strong Rule:** Section boundaries and control strokes; the notification uses its dedicated slightly darker rule.
- **Control Porcelain:** Native input and secondary-button surface.
- **Signal Coral:** Small brand-mark accent on charcoal only.
- **Reserved Red:** Quit and destructive intent only.

### Named Rules

**The Instrument Signal Rule.** Clay means action, sage means confirmation or quiet state, and neither becomes a decorative wash.

## Typography

**Display Font:** Manrope Local (with sans-serif fallback)

**Body Font:** Manrope Local (with sans-serif fallback)
**Label/Mono Font:** Cascadia Mono (with Consolas and monospace fallbacks)

**Character:** Variable Manrope gives the small Windows surfaces a compact, humane equipment-label clarity. Monospace appears only where measured values or terse device metadata benefit from fixed rhythm.

### Hierarchy

- **Display:** The settings-window title and top-level orientation.
- **Headline:** The reminder message title.
- **Title:** Morning and evening row names and other compact object labels.
- **Body:** Default settings copy; the notification body steps down for its tighter fixed window.
- **Label:** Uppercase section labels and concise high-signal metadata.
- **Metric:** Native time values, dose chips, and equipment-rail metadata.

### Named Rules

**The Measurement Voice Rule.** Monospace is reserved for time, dose, and machine-like metadata; prose and actions stay in Manrope.

## Layout

The settings window is a compact equipment ledger built for its fixed 480-by-680 Windows surface. A 104px charcoal rail anchors a flexible paper workspace; below 440px it contracts to 88px while schedule rows preserve usable native time inputs. The workspace stacks a 58px header, a scrollable ruled content region, and a 43px tray footer. Interior rhythm is dense and regular, with 18px outer horizontal padding and compact 4px, 7px, and 13px intervals.

The settings story is fixed: schedule first, notification timing second, preferences third, then the tray footer. Rows and thin dividers replace card stacks. The 380-by-230 notification uses a 112px dark object bay beside a flexible paper message field; the dose chip and reminder lead, while confirm and defer actions close the surface at the bottom.

## Elevation & Depth

The settings workspace is flat: paper tones and one-pixel rules create structure without ambient card shadows. Depth is reserved for physical or interruptive objects—the inhaler illustration casts a soft object shadow, the switch knob gains a small tactile lift, and the always-on-top notification receives the system's only substantial ambient elevation.

### Shadow Vocabulary

- **Notification Ambient:** A paired broad and near shadow separates the always-on-top reminder from the Windows desktop.
- **Object Shadow:** A compact drop shadow makes the authored inhaler read as a physical object crossing both surfaces.
- **Control Lift:** A small shadow under the switch knob communicates manipulability.

### Named Rules

**The Flat Workspace Rule.** Routine settings stay flat and ruled; substantial shadow is reserved for the interruptive notification and the shared physical inhaler object.

## Shapes

The form language is compact equipment rather than soft wellness cards. Native fields and buttons use gently rounded control corners, the notification alone uses the larger container radius, and switches use a full pill track with a circular knob. Structural regions remain rectilinear; one-pixel borders and clipped object bays do the organizing.

## Components

### Buttons

- **Shape:** Compact control corners with a 33px minimum height.
- **Primary:** Deep clay with warm-white text; hover turns charcoal and active state moves down by one pixel.
- **Secondary:** Porcelain paper with charcoal text and a structural border; hover deepens the paper tone.
- **Focus:** A two-pixel deep-clay outline with a two-pixel offset remains visible for keyboard users.

### Chips

- **Style:** A borderless, uppercase monospace dose label using deep clay by default and sage for evening state.
- **State:** Color and localized text work together; color never carries dose identity alone.

### Cards / Containers

- **Settings Ledger:** Flat paper with thin ruled groups and no nested card shells.
- **Notification:** One rounded, elevated container split into a charcoal object bay and paper message field.
- **Equipment Rail:** Opaque charcoal, compact uppercase metadata, signal-coral mark, and the authored inhaler crossing the lower edge.

### Inputs / Fields

- **Style:** Native time, number, and select controls on porcelain paper with a strong neutral stroke and compact control corners.
- **Focus:** The same deep-clay focus outline used by buttons.
- **Error / Disabled:** Disabled controls retain their form and reduce opacity; validation behavior remains native and functional.

### Switches

- **Style:** Muted neutral pill at rest, fired clay when enabled, and a raised warm-paper knob.
- **Focus:** The track receives the shared visible focus outline.

### Saved Status

The settings header reveals a sage checkmark and localized label with a short fade-and-rise transition. Confirmation stays quiet, adjacent to the title, and is announced through the existing live region.

## Do's and Don'ts

### Do:

- **Do** treat settings and notification as one local Windows product with the same paper, equipment bay, typography, and inhaler object.
- **Do** keep schedule, notification behavior, preferences, and tray behavior in that operational order.
- **Do** preserve native controls, visible focus, disabled states, reduced-motion behavior, localization fit, and every existing element ID and action.
- **Do** use thin rules and tonal paper changes to organize routine content.

### Don't:

- **Don't** introduce teal glassmorphism, purple gradients, translucent panels, or stacked generic healthcare cards.
- **Don't** turn clay or sage into broad decorative backgrounds; they are operational signals.
- **Don't** add decorative dashboard modules, cloud/account patterns, or medical efficacy claims.
- **Don't** substitute stock medical imagery, emoji, or multiple illustrations for the single authored inhaler object.
