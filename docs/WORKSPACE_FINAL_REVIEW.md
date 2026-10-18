# FlowTask — final UI/UX and functional review

Reviewed on **17 October 2026** against the current working tree. This review preserves the warm planner, Ribbon F identity and immersive Focus Studio. Existing uncommitted work was retained. No deployment, live account deletion or production-data mutation was performed.

## Verdict

**Suitable for a controlled beta with the verification limits below.** The audit found defects that passing unit tests had missed, reproduced them and added regression coverage. This is a tested beta assessment, not a claim that every browser/device combination or every possible interaction is certified.

The historical report containing nine accessibility failures was stale: the initial fresh production run passed all 33 existing workspace/Studio checks. The new audit then found additional bugs through negative tests, cross-account boundaries and complete user journeys.

## Findings and final changes

| Severity | Reproduction / user impact | Resolution and evidence |
|---|---|---|
| P1 | Use the assistant bridge to create a task in a loaded planner. It wrote through a separate fallback store, so the visible workspace did not update and later writes could use a stale record. | Register tools with the hydrated, active workspace store. Remove the fallback writer. Old bridge handles are invalid after replacement/cleanup. Browser regression interleaves assistant and manual capture and checks all tasks survive refresh. |
| P1 | Start a session through the assistant. It existed in the timer store without the workspace checkpoint/durable record. | Persist the session with its workspace ID and checkpoint. Reject replacing a live session or targeting a task outside the current workspace. Reload regression checks the timer and task linkage. |
| P1 | Pause/stop through OS media controls or floating-timer controls, then refresh. These controls bypassed the workspace persistence/accounting actions. | Route OS controls and PiP buttons through the same lifecycle as Studio. Verify paused-state recovery and exactly-once history. OS Play also restores the soundscape gain and media position after an audio-only pause. |
| P1 | From Today, open the guided planner and save without reselecting tasks. The controlled dialog started with empty selection. | Initialize from the current day and priorities; reopen from step one. Existing locked blocks cannot be moved by selection. Browser regression confirms an unchanged plan keeps its tasks/priorities. |
| P1 | Load the planner online, go offline and open an uncached lazy section. The application-level error screen replaced the whole planner. | Feature-level boundaries retain navigation, task capture and the running session. Provide a clear return action and connect/reload guidance. A production service-worker regression verifies offline capture after returning to Today. |
| P1 | Export workspace JSON from Settings. The v4-shaped payload omitted customized dashboards. | One v5 workspace-backup builder includes dashboards, preferences, recipes/history and saved views; it excludes timers, lifecycle checkpoints, sync queues and undo internals. Download and full restore are exercised in the browser. |
| P2 | Use emergency recovery after a rendering failure. It exported legacy localStorage values rather than current IndexedDB workspace data. | Recover the last saved IndexedDB record; choose a workspace when several are stored. An isolated component test verifies that choosing the guest workspace does not export another account. Personal media remains a separate export. |
| P2 | Launch a fresh guest workspace in India before UTC midnight. Sample tasks used the previous UTC date. | Generate the local calendar date. A timezone-controlled browser test covers 01:30 in Asia/Kolkata. |
| P2 | Save a valid dashboard containing 24 widgets to the emulator. Detailed repeated validators exceeded Firestore's 1,000-expression budget. | Keep owner isolation, explicit document fields, revisions, collection/layout limits and required widget shape/type checks within the budget. Optional widget metadata remains bounded/whitelisted by import and cloud-receive normalization. Boundary tests cover 24/25 widgets, unknown types, stale revisions, device-only layouts and account isolation. |
| P2 | Weekly widgets, guided planning and the day view could count the same work differently; overlapping meetings reduced capacity twice. | Use shared day/week calculations. A task planned earlier is not counted again on its deadline. Calendar overlap is merged. Explicit scheduled end times are respected by the Plan canvas. |
| P2 | Close a task inspector with Escape before a blur/debounce commit. The next action could disappear. | Flush pending edits to the original task on close or task change. The title path and quick-note flush behavior also have regression coverage. |
| P2 | A pending wake-lock grant resolved after pause/unmount, or several requests were made before the first grant. Studio and sprint UI also duplicated runtime ownership. | One app runtime owns the session lock; deduplicate pending requests and release stale grants. PiP requests are likewise deduplicated and late windows are closed. Floating windows close when their portal/account is unmounted. |
| P2 | Sound-profile selection relied on clicking a generic card; some labels and active badges failed contrast checks. | Add actual, named selection buttons. Use readable active foregrounds and stronger effect/feedback colors. Replace missing OS artwork URLs with the shipped brand icon. |
| P2 | Appearance contained sound controls while a separate Sound tab also existed. The legacy mute label implied that all audio was muted. | Separate Appearance and Sound. Label interface effects independently from atmosphere/music. Task-only notes explain that a task must be selected. Remove the repeated landing footer tagline. |
| P2 | The in-app reduced-motion preference did not stop native View Transitions; utility indicators and repeated settings fades created unnecessary movement. | Respect both OS and app preferences. Keep planner status indicators still and settings content immediate. Preserve immersive scene controls and short shared-dialog transitions. |
| P2 | Backup/onboarding dialogs lacked consistent focus containment; the export close icon lacked an accessible name. | Apply the shared focus trap, respect the topmost modal, restore focus and provide a named close action. |

Severity: P1 = potential data/session loss or a blocked primary workflow; P2 = significant usability, consistency or edge-case reliability defect.

## Verification matrix

Final machine-readable results are kept under the ignored `test-results` directory. Browser runs use the production build on a local preview server with disposable contexts. No production Firebase credentials were used.

| Gate | Result |
|---|---|
| Unit/component suite | **529 passed across 82 files**; `audit-unit-final.json` |
| Production TypeScript/build | Passed; PWA precache approximately 1.22 MiB |
| Oxlint | Passed with zero reported errors/warnings |
| API/proxy security | 6 passed |
| Firestore emulator rules | 6 passed, including the new dashboard boundary test |
| Chromium production journeys | **55 passed**, zero skipped/flaky; `audit-release-browser.json` |
| Edge / WebKit core journeys | **20 passed**, ten per browser, zero skipped/flaky; `audit-release-cross.json` |
| Firefox | Blocked during page setup by a Windows SWGL/framebuffer graphics failure before app verification |
| Background technical QA | 48 unique stills across eight collections; six silent videos; files, dimensions, variants and provenance fields checked |
| Audio technical QA | 30 distinct playable files: 12 ambient loops and 18 tracks, three in each of six genres |

### Browser coverage

- Complete capture → project assignment → next action → auto-slot preview/apply → task-linked focus → pause/resume → completion → review → JSON export → malformed-input rejection → restore journey.
- First-run developer setup, task capture and task-linked Studio entry; guest launch/local-date handling.
- Dashboard edit isolation, accessible move controls, undo, mobile preview/save, draft recovery, dashboard switching, delete/undo, cover/export/import and pinned destinations.
- Notes on immediate navigation, inspector title save, durable OS pause/stop, PiP control lifecycle, missing offline chunks and offline starter-pack playback.
- Populated and empty sections, all eighteen planner themes and every settings group in light/dark. The audited scans retain serious/critical checks, including color contrast.
- Layout checks at 360, 390, 768, 1280, 1440 and 1920 pixels, plus an 844×390 landscape viewport and a 720-pixel zoom-equivalent layout. This is not a physical-device/browser-zoom certification.
- 1,000-task virtualization and keyboard navigation; twelve-widget layout. Rendering remains bounded rather than mounting the entire task collection.

### Local performance interpretation

The performance tests attach raw LCP, CLS, observed event durations, long tasks and rendered-row counts to the browser JSON report. They run against local production assets without CPU/network throttling. These are diagnostic samples, **not field p75, not a measured field INP, and not a mobile-device speed guarantee**. Field Web Vitals still require a deployed beta and representative users.

| Final local sample, 1,000 tasks | Desktop 1440px | Narrow viewport 390px |
|---|---:|---:|
| LCP | 600 ms | 596 ms |
| CLS | 0.00000087 | 0 |
| Largest observed interaction event | 64 ms | 64 ms |
| Largest observed long task | 113 ms | 85 ms |
| Task rows mounted after the journey | 15 | 14 |

The final sidebar-only polish was followed by another successful production build, brand-component tests and three desktop/mobile/dark accessibility/visual checks. It did not change task or session behavior.

The planner's Shift+Tab wrap, Escape dismissal and focus return were also checked manually in the browser. A final compact-sidebar adjustment removes the cramped tagline beside header controls; the full tagline remains on the landing page.

### Screenshots and motion review

Before-review captures are preserved as `screenshots/audit-before-{desktop,mobile,dark}.png`. Final desktop/mobile/dark and Studio/welcome captures live alongside them. Some screenshots change only subtly: the main work in this pass was reliable behavior, clearer controls and accessibility rather than another visual redesign.

A separate self-contained motion review with reduced-motion-aware demonstrations is available in `motion-audits/flowtask-2026-10-17.html`.

## Remaining release limits

1. **Live accounts and real devices:** verify deployed rules/functions, sign-in, cross-device conflicts/retry and account deletion with a dedicated beta account. Local tests do not validate a deployment's credentials or access configuration.
2. **Firefox and native integrations:** rerun Firefox on a working graphics runner. Test real iOS Safari/Android Chrome, screen readers, touch behavior, OS media buttons, physical PiP windows and device power-management behavior. A mocked popup exercises PiP state/persistence; it does not certify native window-manager behavior.
3. **Cold offline sections:** the reduced precache does not make every never-opened lazy screen available offline. Missing screens now fail locally with a return path. The selected/downloaded offline media pack and core planner/timer are covered separately.
4. **Human quality checks:** conduct headphone listening across all loop seams/mixes and student/developer usability sessions. The automated first-session/two-action paths do not establish human completion times.
5. **Performance and observability:** collect opt-in beta signals and field p75 after deployment. No retention or production-speed claim is made.
6. **Assistant interface:** the current WebMCP feature is a local JavaScript bridge. Its workspace binding/lifecycle is tested; native browser/third-party assistant discovery is not certified by these tests.

No new major product features, cloud-media storage, paid services, deployment or live-account operations were added in this audit.
