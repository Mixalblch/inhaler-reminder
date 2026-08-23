# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary user is a person with asthma who works at a Windows computer and needs discreet support remembering prescribed inhaler use during the day.

## Product Purpose

Inhaler Reminder is a local Windows tray application that reminds the user to use an inhaler during configured morning and evening windows. Success means the reminders are noticeable without being disruptive, and routine setup remains quick and understandable.

## Positioning

The product is a deliberately narrow, local reminder utility focused on two daily inhaler windows rather than a general medication-management system.

## Operating Context

The application runs in the Windows system tray. The user configures morning and evening reminder windows, then receives a small always-on-top notification with actions to confirm use or be reminded later. Closing the settings window returns the application to the tray.

## Capabilities and Constraints

- Preserve all current functionality and data behavior during the redesign.
- Support Russian and English.
- Keep morning and evening schedules, snooze timing, catch-up timing, notification sound, autostart, saved-state feedback, tray behavior, confirmation, and snooze actions.
- Remain a compact Electron application with no new runtime dependency required for the visual redesign.
- Continue operating locally; do not introduce accounts, cloud services, analytics, or medical claims.

## Brand Commitments

- Product name: Inhaler Reminder.
- Voice: calm, direct, and respectful rather than alarming or clinical.
- Claude Code is a requested visual reference for the redesign; exact visual decisions belong to the design direction, not the product record.

## Evidence on Hand

- Working Electron source for settings, notification, tray, scheduling, configuration, localization, and autostart.
- Existing application and tray icons under `assets/`.
- No testimonials, medical efficacy evidence, or external brand assets are present and none should be fabricated.

## Product Principles

- Protect the user's routine without demanding attention.
- Make the next action obvious at a glance.
- Keep configuration compact and reversible.
- Preserve privacy through local operation.
- Prefer trustworthy restraint over decorative novelty.

## Accessibility & Inclusion

Controls must remain keyboard accessible, retain visible focus states, and communicate state without relying on color alone. Russian and English copy must fit the fixed Windows surfaces without clipping.
