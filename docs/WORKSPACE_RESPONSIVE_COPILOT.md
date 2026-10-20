# Responsive workspace and local Copilot

Implemented 20 October 2026. The workspace remains local-first and uses the existing workspace schema, theme registry, media library and undo history.

## Today and shared layout

Today has one full-area background below both Horizon and the modular dashboard. Both views resolve the same active/default desk and reuse its saved `coverImage` and `coverFocalPoint`. Customize Today opens the existing image picker directly or takes the user to dashboard widgets and layout tools. The former rectangular dashboard cover is removed. Missing images leave a theme-backed workspace and a replacement action.

The background uses a theme-derived tint; content panels remain opaque enough to preserve readable foreground/background pairs. Existing image visibility preferences still apply. Personal images remain device-local and excluded from portable backups.

Today owns its viewport; each main content area has one scrolling region. Onboarding and backup notices scroll with the page. The 300px timeline rail appears only when the Today container has at least 960px; smaller containers use an accessible timeline dialog. Shared dialogs constrain the whole panel to the dynamic viewport, scroll the body and keep footer actions reachable. Mobile navigation reserves its safe area. Layout editing retains move and size buttons and disables drag/resize gestures at the one-column breakpoint.

Page padding is 16/24/32px for phone/tablet/desktop. Headers, action bars, widget controls and long text wrap. The narrow mobile header reflows instead of squeezing its title. Focus modes also adapt to short landscape screens.

## Local Copilot

Five explicit actions are available on desktop and mobile: Add task, Break into steps, Plan / schedule day, Start focus, Daily summary. An optional command input accepts a bounded set of commands; unsupported or ambiguous commands show help instead of silently selecting an unrelated action.

Examples: `add Read chapter 3 p2 ~30m`, `decompose Prepare presentation`, `plan my day`, `schedule tasks for 2026-10-25`, `focus 25m on Read chapter`, `daily summary`.

Breakdowns use editable local templates, with editable estimates and a starter action. Applying creates one parent task with actual subtasks in one undoable operation. Existing-task breakdowns preserve existing steps and reject stale task previews. Failed saves are visible and retryable; repeated Apply clicks are guarded. Focus links to an existing task and resumes/opens an existing session instead of replacing it.

The WebMCP `createTask` interface adds optional `nextAction` and `subtasks: { title, estimatedMinutes? }[]`. Existing callers remain compatible. New subtask IDs are generated on application; invalid entries are rejected before creating a task.

## Shared scheduling

Copilot, Today Auto-Slot and Plan call the same read-only planner and editable review dialog. Default candidates are active, unscheduled tasks for the selected local day. Including other tasks requires explicit selection. Completed, deleted, archived, locked and dependency-blocked tasks are excluded.

The planner honors existing blocks, explicit scheduled ends, calendar commitments for that date, working hours, buffers on both sides of occupied time, duration estimates, priorities and same-day timed deadlines. It uses the shared capacity summary, subtracting unique timed meetings and scheduled work once. All-day events remain informational. Today starts after the current local time; past dates are disabled. Tasks use whole blocks. Overdue deadlines are explained, and tasks without a fitting slot stay unscheduled with a reason.

Previewing never changes tasks. Applying revalidates the current workspace/calendar and available time, refreshes stale proposals for review, and commits the chosen slots as one undoable operation. Scheduling does not overwrite deadlines. Calendar refresh failures explicitly identify that locally stored events are being used.

This release adds no external AI service, automatic background replanning, calendar writeback or new account requirement.

## Research and verification

Scheduling inputs were informed by the official [Motion auto-scheduling guide](https://www.usemotion.com/help/time-management/auto-scheduling) and [Reclaim scheduling guide](https://help.reclaim.ai/en/articles/6207587-how-reclaim-manages-your-schedule-automatically). The product uses deterministic local scheduling with a review step.

Responsive and accessibility criteria follow W3C guidance on [reflow](https://www.w3.org/WAI/WCAG21/Understanding/reflow), [contrast](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html) and [target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html). Primary mobile controls target 44px; dense secondary controls keep sufficient size/spacing.

Verification covers:

- Full Vitest suite, production TypeScript/Vite build and lint.
- Seven security checks and six Firestore rules checks against a disposable emulator on `127.0.0.1:8088`, project `demo-flowtask`, official emulator 1.19.8 / Java 17. No production rules were changed.
- Chrome at 320, 360, 390, 768, 1024, 1280 and 1440px across workspace views, Settings, nested planning dialogs and the public landing page; portrait, short landscape, first-run setup, task drawers and keyboard focus restoration.
- All 18 themes with and without backgrounds, plus bright, dark and busy wallpapers in light/dark themes, with automated serious/critical accessibility checks and screenshot inspection.
- Background selection, focal-point persistence, reload/view switching, failed images, widget image configuration, task capture/completion, Copilot subtask persistence, scheduling, Undo and task-linked focus.
- WebKit mobile layout, background persistence and the Copilot-to-focus flow.

Evidence is written under ignored `test-results/planner*` and `screenshots/planner-*` paths. Firefox could not finish launching on this host; it is not counted as verified. Browser automation is not a physical-device or screen-reader usability study. Manual mobile keyboard/zoom and real-device checks remain release validation work.

Final recorded results: 1,045 unit tests passed; lint and production build passed; 7 security and 6 emulator rules checks passed; 19 distinct Chrome browser scenarios passed, with 6 additional responsive/focus follow-up runs after the final header changes; 3 WebKit scenarios passed. See `planner-final-browser.log`, `planner-header.log`, `planner-plan.log`, `planner-scheduling.log`, `planner-webkit.log` and `planner-webkit-responsive.log` for the corresponding runs. The final Plan-only rerun records the corrected storage-fixture read and the expected absence of an auto-slot action on an empty past day.
