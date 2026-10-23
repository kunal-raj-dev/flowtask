# FlowTask implementation review — 23 October 2026

Antigravity's implementation needed further fixes. Its passing unit tests did not cover several of the requested behaviours. The review changes are in the local working tree; this review does not publish or deploy them.

## Findings and corrections

| Area | Gap found | Correction |
| --- | --- | --- |
| Dashboard image | A chosen image could be saved without being rendered on the modular canvas. | Render the saved cover with its focal point; unavailable files show a replacement action. Export/import is verified in the production suite. |
| Dashboard templates | Different previews could still render the same guided desk; starter arrangements had little differentiation. | Dashboard explicitly renders its saved grid. Study, Developer and Minimal have distinct arrangements at desktop, tablet and phone widths. Starter previews remain drafts until Save; Cancel preserves the saved desk, name, cover and focal point. |
| Scrolling | Widget overflow trapped wheel scrolling at its boundary. | Widgets retain usable internal scrolling and chain to the dashboard page at their boundary. Empty widgets no longer trap the page. Dragging remains restricted to handles. |
| Focus Studio | Break-only content and long titles changed the action frame; narrow screens could push controls outside the viewport. | Reserved title and prompt space, a three-column action row, and accessible mobile icon buttons. Setup and running-session layouts remain separate. Restart round is in the Session panel. |
| Estimates | Several summaries, scheduling and the full backup still used stale parent estimates. Bulk updates could bypass normalization. | Timed subtasks determine the parent total on create/update/bulk commands and in the shared read model. Manual overrides are disabled while derived. Removing the final timed estimate clears the stale parent; Undo restores it. Calendar endpoints stay explicit. |
| Remaining work | Parent-only recorded time could incorrectly be absorbed into completed estimates. | Completed estimates stay in the total. Unfinished subtask estimates lose their own attributed time, then parent-only time is subtracted once. Untimed subtasks are counted separately. |
| Task sessions | An open, unapplied composer draft could become a saved session; edits could leak through Cancel. Invalid intervals were accepted. | One shared local draft editor; only Apply commits. Empty/zero intervals are rejected; overnight intervals work. Session suggestions follow the selected planned day and exclude archived/deleted tasks. Calendar duration does not overwrite workload. Removal preserves estimates and subtasks. |
| Project moves | Picker accessibility, archived-project filtering, featured-row discovery and nested dismissal had gaps. | Searchable picker with native arrow/Enter/Escape navigation in row, drawer and bulk actions. Moves clear the old milestone and offer Undo/View project. IDs, subtasks, dates, dependencies, recorded time and the active timer survive the move. Already-in-project tasks keep their milestone in mixed bulk moves. |
| Shortcuts | Master Off missed several view, popup and floating-timer handlers. Help listed some nonexistent bindings. Legacy hint Off could be lost. | Shared dispatch-time guards for master state, typing, selection, IME, repeat and modifiers. Native navigation/dismissal stays available. Searchable shared guide and Settings controls; platform modifier labels and legacy hint preferences are preserved. Removed stale bindings and resolved duplicate/destructive actions. |
| Highlights | Selection fill and border had inconsistent geometry and hardcoded amber. | Whole-row, theme-aware fill with a 12px radius; keyboard focus uses the same rounded geometry. |
| Startup and membership | Dashboard startup resolved to Today; study/triage/upcoming rules diverged. | Explicit Dashboard startup with URL priority. Shared Inbox/study predicates and day budgets; no arbitrary checklist fallback in Study. Past planned study sessions are marked overdue. |
| Development ownership | StrictMode cleanup could leave a fresh tab falsely read-only. | Serialize ownership cleanup/re-entry and prevent a stale owner from freezing a replacement. Genuine second tabs remain read-only followers. |

## Verification

All final commands completed successfully:

| Check | Result |
| --- | --- |
| Node 22 release verification | Passed: lint, TypeScript, unit/component tests, security, Firestore emulator rules, production build and performance budgets |
| Unit/component tests | 143 files; **1,145 passed**, including 15 added regression cases |
| Security/telemetry checks | **15 passed** |
| Isolated Firestore security rules | **9 passed** |
| Production Chrome browser suite | **54 passed** across entry, focus, dashboard and implementation-review flows |
| Production Edge regression suite | **9 passed** |
| Development/StrictMode regression suite | **9 passed** |
| Whitespace/diff validation | Passed |

The broader production suite includes offline entry, focus history and reload, real second-tab ownership, 1,000-task virtualization, accessible workspace hierarchy, phone/tablet layouts and 12 theme variants. Firefox/WebKit and physical-device checks were not run in this review.

Local command logs: `verification-review-final.log`, `browser-review-chromium.log`, `browser-review-edge.log`, `browser-review-development.log`. Test screenshots are in `screenshots/`; browser attachments are in `test-results-review-chromium/` and `test-results-review-edge/` (generated artifacts, excluded from Git).

New browser regressions cover the exact 220-minute example, editing to 230 minutes, session Apply/Cancel/removal, project moves with a live timer, bulk/drawer moves, Undo, View project, nested Escape, empty-widget wheel scrolling, starter cancellation, persisted shortcut Off and explicit startup routing.

Focus, paused and break states were measured at **355px, 768px and 1440px**. The timer and main action centres stay within **1 CSS pixel** between states. Reset, Pause/Resume and Finish remain inside the viewport and pass centre hit-testing.

Existing user edits in ProjectsView, ReviewView and vite.config.ts were preserved. Tests use isolated local browser data. Real cloud-account round trips, physical phones, and a live deployment are outside this verification; emulator security checks are distinct from live cloud sync.
