# UX audit and simplification — 25 October 2026

This pass preserves the existing workspace and its in-progress local changes. Changes are local; no production deployment or account changes were made.

## Fixed

- Background removal now saves an explicit plain-background choice. Clearing an image no longer brings the default scene back after refresh.
- Today customization has a direct **Remove background** action. Appearance settings now includes **Choose / Change / Remove background**, with a working nested image picker.
- Selecting a new background restores visibility after older “hide backgrounds” or plain-background preferences. Other desk settings and crop positions are preserved.
- An intentionally plain background is no longer reported as a missing personal image. Uploading disables applying an unfinished image, and non-image files receive an actionable error.
- Quick Add links now open reliably during initial application mounting and consume their URL action once.
- Life Areas, Goals and Routines retain their destination when opened directly or refreshed.
- Goals can link projects during creation and edit or clear their date, life area, project links and status later. New goals use the current quarter. Empty quarter filters offer a route back to all goals instead of offering duplicate starters.
- Goal deletion closes its editor, and creating/editing forms no longer overlap.
- The routine editor uses the shared accessible dialog, stays scrollable on small screens, supports Escape and keyboard focus containment, and focuses the title. Step inputs have labels, blank steps cannot be silently saved, and durations respect their limit.
- Life Areas renders legacy icon names as recognizable icons, offers keyboard access to area details, and lets users edit an area's color.
- Task/project forms, recovery search, Smart Filter icons/colors and quick capture have clearer accessible names. Recovery no longer lists Inbox twice.
- Board cards distinguish a planned date from a deadline instead of showing “No date” on scheduled tasks.
- Mobile header controls no longer reserve a large empty flex area; Copilot remains reachable and titles have room to wrap. Dialog footers can wrap their actions on narrow phones.
- Quick capture uses a short title, keeps keyboard focus inside its overlay, and reserves input space for its Capture button.
- Simplified several descriptions and report labels to use everyday language.

## Verification

- Automated browser checks wait for loaded section content, and for the actual widget grid on the dashboard.
- All 21 workspace views checked at 320, 390 and 1440 px: Today, Inbox, Plan, Projects, a project workspace, Notes, Life Areas, Goals, Routines, Upcoming, Study, Review, Insights, Logbook, All Tasks, Someday, Board, Matrix, Archive, Trash and Dashboard.
- All 10 Settings panels checked at 320 and 1440 px, including opening the nested background picker and removing a background.
- Persistence journeys cover default-background removal, applying another image, goal updates and routine creation after refresh. Mobile quick capture covers Tab cycling, Escape and cancellation without creating data.
- Additional manual journeys exercised task capture, project assignment, session add/remove, calendar slot assignment, multi-day calendar, project board/matrix, note writing/preview/trash, study templates/sprint pause/reset, Review tabs, Smart Views, scratchpad and recovery.
- 1,299 unit/component tests across 163 files passed. TypeScript/production build, lint and bundle budgets also passed.
- All 9 production-browser regression scenarios in `e2e/uxSimplification.spec.ts` passed. The existing entry/Notes development-browser run also passed 19 scenarios, with 2 production-only cases skipped in that run.

Evidence screenshots are in `screenshots/ux-appearance-320.png`, `screenshots/ux-appearance-1440.png` and `screenshots/ux-sections-{320,390,1440}.png`.

Live account sync, notification permissions, external calendar credentials and multi-device behavior were not exercised. The full legacy release-browser matrix was not used as a release gate for this local UX pass.
