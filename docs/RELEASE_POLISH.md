# Final usability and release polish

Implementation reviewed locally on 19 October 2026. Existing visual-library changes and asset IDs were preserved. Nothing was pushed or deployed, and no live accounts or production data were changed.

## Delivered behavior

- First visits open an optional inline introduction. Create one task, then explicitly choose a quiet 25-minute session or keep planning. Existing workspaces retain their settings, themes, layouts, and tasks. Student/developer presets are available in Workspace settings.
- Today puts capture above planning context. Layout editing/import lives under Customize. Task inspectors progressively disclose study and scheduling tools, and empty project milestones are optional.
- Task creation honors saved priority and smart-parsing settings in inline capture, the composer, bulk capture, and assistant tools. Explicit fields take precedence. Parsing-disabled input stays literal. Capture previews distinguish deadlines from planned dates; task rows use the configured estimate fallback.
- Today offers Start, Resume, or Return to focus according to session state. Task-linked quick starts use the durable timer lifecycle. A live session cannot be implicitly replaced.
- Automatic scheduling previews changes after the next quarter-hour for today, uses the full workday for future dates, and is disabled for past dates. Existing scheduled work consumes the work budget. Tasks that do not fit remain unscheduled. Applying and Undo remain explicit.
- Calendar-file import validates before replacement, persists the source on this device, and reparses it for the selected date. File/feed event IDs are namespaced. Imported contents are excluded from cloud synchronization and portable JSON backups. Failed imports leave the previous file intact; obsolete asynchronous feed responses cannot overwrite newer results.
- Settings, account panels, and shared dialogs contain focus, block background interaction, respect the topmost dialog, and restore focus on close.
- Large lists measure a bounded scroll viewport. Keyboard-revealed virtual rows are scrolled into view after mounting.
- Image recommendations show twelve varied choices. Recommended, All, Favorites, and Recent replace the long tab strip; purpose and visual style remain available as filters. Preview space appears only after selection. Six featured Focus rooms span cozy, mountain, city, ocean, space, and minimal scenes. The existing 72 workspace images and 54 Focus backgrounds remain available; no additional media was necessary.
- Motion coordinates navigation, checkboxes, disclosures, and previews. Shared preferences cover Framer Motion, CSS, canvas celebrations, native transitions, and still fallbacks for video scenes.
- Local-mode account messaging, a dismissible backup reminder after meaningful use, copy/share/download feedback, and configured-origin social metadata complete the release pass.

## Local verification

Use Node 22. Latest local artifacts are ignored under `test-results/` and `screenshots/`.

| Check | Evidence |
|---|---|
| Unit/component suite | 669 passed across 103 files; `test-results/release-final-validation.log`. Two additional session-restoration regressions passed in `test-results/release-session-validation.log` (671 checks in total). |
| Lint and TypeScript | Passed in the same validation run |
| Production build | Passed with Node 22; `test-results/release-build-confirmed.log`. 44 precached entries, approximately 1.55 MiB; media remains on demand. |
| API/proxy security | 7 passed; `test-results/release-security-rules.log` |
| Firestore rules | 6 passed using a disposable emulator at 127.0.0.1:8088, project `demo-flowtask` |
| Edge/WebKit first-use journeys | 6 passed, at 320×568, 390×844, and 1440×1000 |
| Production Chromium journeys | 83 distinct journeys passed across the matrix and targeted reruns. The final first-use/settings/calendar/scheduling/image-library run passed 8/8 (`test-results/release-final-browser.log`). |
| Final large-workspace check | Passed with 1,000 tasks and 12 widgets; task rendering remains bounded and the keyboard-selected row must actually be in the viewport (`test-results/release-final-large.log`). |
| Social metadata | Actual Vite HTML transform checked with a test HTTPS origin; Open Graph, Twitter image, and canonical URL generation verified |

The production browser matrix covers first use, local dates, saved preferences, capture/edit/complete/Undo, projects and study navigation, scheduling, timer/break persistence, OS/PiP controls, settings and theme contrast, backup/restore, uncached offline sections, media packs, and large-workspace navigation. Tests include 320–1920px layouts, landscape, keyboard navigation, high contrast, reduced motion, and all 18 themes. Automated accessibility assertions reject serious/critical findings on the exercised surfaces.

The broad run passed 82 journeys and exposed one remaining obsolete image-picker tab selector. After updating all three use-case selectors to the new dropdown, the complete image-library journey passed on the final build. The final session guard also preserves saved interruption context when restoration is blocked by an active session.

Screenshots include `screenshots/release-first-visit-390.png` and `screenshots/release-today-1440.png`.

## Required before broad sharing

These checks need the deployed installation or people/devices outside this local environment; they have **not** been certified here.

1. Configure the real `APP_ORIGIN` (or confirm the Vercel production-host fallback). Check the actual shared-link preview in the messaging groups where the app will be shared.
2. If cloud sync will be advertised, verify real Google sign-in, account separation, guest import, offline/reconnect, and two-device synchronization on that deployment. Guest planning remains complete when cloud services are unavailable.
3. Walk through capture → focus → pause/resume → completion → backup on a physical Android phone and an iPhone. Check the software keyboard, touch targets, rotation, installation, and offline return. WebKit automation is an engine check, not iPhone certification.
4. Check a real screen reader and operating-system text zoom on the core flow.
5. Ask five unfamiliar users (three students and two developers) to create a task and begin focus without guidance. Record time to first task/focus, wrong turns, and whether they understand device-local saving. Target under one minute; automated journeys do not substitute for this observation.

The app remains a public beta. Local checks do not establish field Core Web Vitals or certify a production backend.
