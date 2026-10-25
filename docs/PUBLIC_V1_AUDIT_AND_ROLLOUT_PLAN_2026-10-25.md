# FlowTask: first public release audit and development plan

25 October 2026 · Planning deliverable · Billing excluded

**Recommendation:** complete the product around a dependable daily loop: capture → organize → plan → focus → review. Give Life Areas and Goals real ownership of saved data and useful detail pages. Unify the interaction patterns across the product, then verify the resulting release on staging and real devices.

**Current release decision: hold public rollout.** The current working tree contains reproducible loss of user-created Areas and Goals, a deferral control that does not enforce its stated behavior, and release-budget failures. These findings require functional work as well as visual refinement.

This audit changes no application code. It preserves the existing implementation and recent uncommitted work. It does not approve, deploy, publish, or modify billing.

## 1. What was inspected and what the evidence means

The inspected product was the current development build at `http://localhost:5173/app`, including the uncommitted additions in this checkout. Git HEAD was `b2e8726b5a353f4a2ee3ebfb6faba74f2654d88c`; the working tree, rather than that commit alone, defines the audited version. The package identifies itself as `2.0.0-beta.1`.

Hands-on inspection covered first use, Today, task capture and details, Life Areas, Goals, Projects and project editing, automatic scheduling, both Plan presentations, Notes writing/preview/project assignment, global search, quick capture, Copilot summary, Focus Studio, routine execution, Review and its weekly-review stages, Study Hub templates, Settings/Data/About, mobile navigation, the landing page, and Help. Synthetic audit records were used in a separate in-app browser context; no customer account or hosted database was used.

Responsive inspection included measured CSS widths of 320, 390, 768, and 1440px. Early desktop evidence was captured at approximately 1309px. Browser zoom/device scale was accounted for by reading the rendered viewport; requested dimensions alone were not treated as evidence. These are desktop-browser responsive checks, not physical-phone or virtual-keyboard acceptance.

Findings use these evidence labels:

- **R — reproduced:** directly observed through the running interface.
- **S — source-confirmed:** a concrete contradiction or missing connection in the current code; the corresponding hosted/device failure has not necessarily been reproduced.
- **D — design finding:** a usability or consistency judgment from the inspected screens.
- **G — release gate:** evidence still required before shipping, rather than an allegation that the capability is broken.

Severity is release-oriented: **P0** blocks release because of lost/unprotected user data or a broken release gate; **P1** breaks a promised workflow or materially impedes use; **P2** affects clarity, consistency, or polish.

### Fresh verification

The machine's default Node is 25.6.1. Diagnostic checks were initially run there, then the unit suite, security suite, TypeScript/build, and budget evaluation were rerun with the required **Node 22.23.4**. Release conclusions below use the Node 22 results. Production output was built in a separate temporary directory; the existing `dist` and preview were preserved.

| Check | Current audit result |
|---|---|
| TypeScript | Pass |
| Lint | Pass; zero exit status |
| Unit/component tests on Node 22 | **1,280 passed across 161 files** |
| Security/server tests on Node 22 | **15 passed** |
| Fresh production compilation on Node 22 | Pass, with a warning about ineffective dynamic imports of `useNotes` |
| Existing bundle-budget script | **Fails** on planner initial CSS |
| Planner initial CSS, gzip | **36,920 bytes**, limit **35,840** |
| Planner initial JavaScript, gzip | 343,105 bytes, limit 409,600 |
| Landing initial JavaScript / CSS, gzip | 169,252 / 31,042 bytes; within existing limits |
| Core precache, independently measured | **1,748,017 bytes**, limit **1,677,721.6**; also over budget |
| Current hosted cloud/rules acceptance | Not rerun during this audit |
| Current production-build browser matrix / field performance | Not rerun during this audit |

The existing working tree also reports extra blank lines at EOF in several previously changed files under `git diff --check`. Those application files were left untouched during this planning audit; repository hygiene belongs in the implementation/release cleanup.

The budget script stops at the CSS assertion. The precache result above is a separate measurement of the fresh build against the checked-in limit, not a second failure emitted by that script.

Passing tests have value, but the Area/Goal tests currently check creation while a component remains mounted. They do not establish persistence through navigation, reload, export, or account sync. That missing coverage explains how visibly working forms can coexist with data loss.

Detailed logs, reproduction notes, and selected screenshots are in [the evidence index](evidence/2026-10-25-product-audit/verification.md).

## 2. What is already worth preserving

- **Local task capture and durable task storage:** a task created with a project, priority, date, and estimate survived reload.
- **Scheduling preview:** automatic scheduling proposed a future slot, applied it successfully, and offered Undo.
- **Connected Notes:** title, body, and project assignment persisted; global search returned the note and task together. Mobile editor/list separation is a useful existing pattern.
- **Focus lifecycle:** a task-linked session started, paused, survived reload, and could be finished. Copilot subsequently reported the six recorded seconds.
- **Product identity:** warm neutral surfaces, amber accents, self-hosted typography, and the more deliberate Focus Studio experience provide a usable design foundation.
- **Existing infrastructure:** workspace isolation, durable writes, recovery, domain commands, optional cloud sync, security tests, error boundaries, and release scripts should be extended rather than replaced.
- **Honest existing disclosures:** the landing page labels its preview as illustrative and explains local storage, optional sync, and backup limits. Keep that clarity throughout the application.

## 3. Findings that determine the work order

### Data integrity and domain behavior

| ID | Priority / evidence | Finding and practical effect | Required resolution |
|---|---|---|---|
| F01 | P0 · R/S | A newly saved Life Area disappears after Today → Life Areas. `LifeAreasView` owns `useState(DEFAULT_LIFE_AREAS)` instead of the workspace collection. | Route all Area operations through durable workspace commands and selectors. Verify navigation, reload, export/restore, and account boundaries. |
| F02 | P0 · R/S | A newly saved Goal disappears after leaving and returning. Goal status changes are also component-local. | Persist Goal creation and all lifecycle changes through the same command pipeline. |
| F03 | P0 · S | `SYNC_COLLECTIONS` and `SyncedEntity` omit Areas, Goals, Routines, and Habits. Updating the existing persistence service alone will not make these entities sync. | Implement their complete supported sync contract, including ownership, revisions, conflicts, recovery, account import, and deletion. Deploy compatible rules before frontend changes. |
| F04 | P0 · S | Task UI writes fields such as `deferUntil`, `areaId`, `goalId`, `cognitiveLoad`, and `isLifeAdmin`; the task Firestore `hasOnly` allowlist does not include them. These fields are also missing from the optional-field clearing list. | Reconcile client serializers, clearing/tombstone behavior, validation, and rules field by field. Confirm real writes and subsequent clears on isolated staging. Never silently discard a user's selection to make a write pass. |
| F05 | P0 · S | Advanced JSON export and manual checkpoint creation construct partial records without Areas/Goals/Routines/Habits. The backup builder then supplies empty arrays. The direct Settings backup uses the full store, so export paths disagree. | Use one full-workspace export/checkpoint adapter everywhere. Test a round trip containing every supported entity and relationship. |
| F06 | P1 · S | New Life arrays are accepted by casts or `raw.areas || []`, rather than bounded entity/relationship validation. | Add schema validation for IDs, lengths, dates, status, references, duplicates, archive state, and version migration at every import/hydration boundary. |
| F07 | P1 · S | `WorkspaceStore.run` persists Life changes through `hasOtherChanges`, but undo/outbox entries depend on `changes.length`, which does not include those entities. | Give supported entities first-class changes/inverses. Their edits must participate in Undo, recovery, and cloud delivery. |
| F08 | P1 · R/S | Setting a task's Defer Until to 1 November still leaves it in Today on 25 October after reload. The separate deferred/actionable selectors are not wired into the active Today selectors. | Define one availability predicate for Today, Focus queues, planning candidates, counts, search filters, and reminders. Keep deadlines visible without treating a deferred task as ready to work. |
| F09 | P1 · S | Quick Capture parses independently and forces `p3` and 30 minutes, bypassing configured defaults and the parsing preference. It also sends new task fields that need rule alignment. | Use the canonical capture command and settings-aware preview. Identical input must have identical meaning across entry points. |
| F10 | P1 · S | A second dependency/actionability implementation adds predecessor/sequential rules while existing scheduling/scoring uses the older dependency utility. | Consolidate task availability and dependency rules. Expose supported states consistently; keep unfinished sequential-project behavior outside the public promise. |

Primary code anchors: [Life Areas](../src/components/views/LifeAreasView.tsx), [Goals](../src/components/views/GoalsView.tsx), [Life services](../src/services/lifeOrganizationService.ts), [sync entities](../src/services/workspaceEntities.ts), [workspace mutations](../src/services/workspaceStore.ts), [Firestore rules](../firestore.rules), [advanced export/checkpoints](../src/components/modals/ExportImportModal.tsx), [backup validation](../src/utils/workspaceBackup.ts), [active task selectors](../src/utils/taskSelectors.ts), [new availability selectors](../src/services/workspaceSelectors.ts), and [Quick Capture](../src/components/capture/GlobalCaptureHUD.tsx).

### Life, Goals, routines, and reminders

| ID | Priority / evidence | Finding and practical effect | Required resolution |
|---|---|---|---|
| F11 | P1 · R/S | Five displayed Life Areas coexist with an empty task Area selector and an empty workspace Areas collection. Project editing consequently cannot use the displayed Areas. | Make every screen read the same records and provide contextual assignment/create actions. |
| F12 | P1 · R/S | Life Areas has no useful detail destination, edit/archive flow, or way to connect projects from an empty card. It promises habits and commitments without providing the complete workflow. | Add real Area detail and management. Show linked goals, projects, actionable tasks, relevant notes, and attention needed. Make the advertised scope match working capabilities. |
| F13 | P1 · R/S | Goals starts with three hard-coded objectives, including internal product-engineering copy, as if they belonged to a new user. Filters and creation are restricted to three fixed quarters. | Empty user-owned Goals by default; optional templates require explicit addition. Use dynamic quarters and arbitrary target dates. |
| F14 | P1 · R/S | New Goals cannot link to a project or Area through the form; there is no complete edit/archive/detail workflow. Several status values render as the same “In Progress” state. | Build the full Goal lifecycle and a single status model. Let users connect work and define measurable success. |
| F15 | P2 · R/S | Area “Velocity” is the percentage of tasks completed, without a time window. Project association also guesses from ID substrings. | Use explicit relationships and honest, dated metrics. An ongoing Life Area should not imply that a person's health or family is “complete.” |
| F16 | P1 · R/S | Routine launch always supplies a fixed morning example. Closing at step 2 and reopening restarts at step 1. Completion produces a toast rather than durable history. | Add a small routine editor/library, saved execution state, resume/restart choices, and a durable completion record. |
| F17 | P1 · R/S | The routine dialog opens while focus remains on the launcher. It uses its own modal implementation; it needs focus containment, Escape behavior, and focus restoration. | Adopt the shared accessible dialog primitive and verify keyboard behavior. |
| F18 | P1 · S/G | Routine timing decrements component state once per interval. It lacks the timestamp-based recovery used by the main focus lifecycle. | Derive elapsed time from timestamps; make hidden-tab, sleep, reload, pause, and step transitions deterministic and idempotent. Verify physical interruption cases. |
| F19 | P1 · S/G | Reminder scheduling ignores delays beyond 24 hours, and re-arms on task changes rather than through a rolling wake-up. An unchanged open workspace can miss a distant reminder when it enters range. | Add rolling reconciliation and foreground/wake recovery. Test distant reminders and workspace changes. State clearly that closed-app delivery is not supported unless a real push mechanism is built. |

Relevant code: [project Area source](../src/components/views/ProjectsView.tsx), [task relationships/reminders](../src/components/tasks/drawer/TaskDrawerProperties.tsx), [fixed routine](../src/components/modals/ModalRoot.tsx), [runner](../src/components/workflow/RoutineRunner.tsx), and [reminder scheduling](../src/services/reminderService.ts).

### Planning consistency and responsive operation

| ID | Priority / evidence | Finding and practical effect | Required resolution |
|---|---|---|---|
| F20 | P1 · R/S | On a 390px phone layout, the Multi-Day Grid keeps a 256px staging shelf beside the calendar. The useful time column is reduced to a narrow sliver. | Make backlog a collapsible tray/drawer on phones; default to a usable one-day agenda/grid with explicit scheduling controls. |
| F21 | P1 · S | Grid drop/resize handlers mutate task dates and estimates directly and do not enforce `scheduleLocked`; the lock is displayed as an icon. They also bypass shared conflict planning. | All planner surfaces must call the same validated schedule commands with lock, bounds, calendar-busy, and conflict behavior. |
| F22 | P1 · S | The Grid's inner date/range changes independently from `TimelineView`'s selected day. The parent refreshes calendar data for its own day, not the visible Grid range. | Own date/range in one place, fetch the displayed range, and keep header, capacity, events, and controls synchronized. |
| F23 | P1 · S | Grid deficit calculation uses the full canvas-hour window, while the main planner uses the configured task capacity. With defaults, a 15-hour canvas and a six-hour work budget mean different things. | Use one shared capacity summary, separating calendar window, available task budget, existing meetings, planned demand, and remaining work. |
| F24 | P1 · S | Grid resize publishes task updates on every pointer move. Blocks/resize handles are generic elements without equivalent keyboard controls. | Preview resize locally, commit once, support cancel/Undo, and provide keyboard/touch time editing. Arrange overlaps into readable lanes. |
| F25 | P1 · S | Scheduled work has competing representations: task schedule fields, session metadata, task `workBlocks`, and workspace-level work-block arrays. The work-block service has no connected editing surface. | Freeze one V1 scheduling contract. Recommended V1: one primary calendar block per task, with study-session structure preserved. Defer general split-task/multiple-block scheduling until it is integrated end to end. |

Relevant code: [Plan parent](../src/components/views/TimelineView.tsx), [new Grid](../src/components/views/CalendarTimeGrid.tsx), [shared planner](../src/services/schedulePlanner.ts), [capacity summary](../src/utils/dayPlanSummary.ts), and [work-block service](../src/services/workBlockService.ts).

### UX, accessibility, duplication, and release quality

| ID | Priority / evidence | Finding and practical effect | Required resolution |
|---|---|---|---|
| F26 | P1 · R/D | At 320px, Goal completion buttons shrink to approximately **8 × 20px**, long titles stack awkwardly, and status content clips. The document still reports no horizontal overflow. | Define responsive card layouts and non-shrinking controls; inspect internal clipping and interaction geometry, not only document width. |
| F27 | P1 · R/D | On phone Today, backup/header controls, four secondary actions, and the empty Top 3 panel push an existing task below the initial screen. | Put actionable work first; compact empty priorities and move infrequent controls into an overflow menu. Keep capture close to tasks. |
| F28 | P1 · R/S/D | Task details presents planning, Life, goals, deferral, admin classification, diagnostic actions, deadline, sessions, reminders, subtasks, and notes in a long form. Empty Life/Goal controls amplify the confusion. | Keep essential fields visible; reveal scheduling, relationships, recurrence, study tools, and history through coherent disclosure groups. |
| F29 | P2 · R/D | Today/Dashboard/Horizon, Timeline/Plan/Grid, capture HUD/New task/Brain Dump, Notes/Quick Notes/Scratchpad, and several theme/focus entry points overlap. Some alternate views are useful; their ownership is unclear. | Establish one destination and shared domain behavior per job. Keep deliberate shortcuts and alternate presentations without separate product semantics. |
| F30 | P2 · R/S | Areas and Goals fall back to “FlowTask” in the shell title. Labels such as “Omnichannel Quick-Capture HUD,” “Whole-Life Architecture,” and “Defer Until (Tickler)” expose implementation or specialist terminology. Command search still advertises “8 Colorways” while the app supports more themes. | Use consistent route metadata, plain labels, and generated capability counts. |
| F31 | P1 · R/S | Help directs users to Settings → About → Feedback, but About has no feedback control; feedback is elsewhere. Recovery checkpoints require an additional advanced-data route. | Put Help/Feedback and Backups/Recovery in explicit, directly reachable settings destinations and keep instructions in sync. |
| F32 | P1 · R/S/G | Modal implementations vary; the inspected weekly-review dialog also has an unnamed icon button. A screen fitting its viewport does not establish keyboard or screen-reader usability. | Audit shared modal/menu/select primitives, labels, focus order, focus visibility, return focus, and drag alternatives across core journeys. |
| F33 | P2 · R/S/D | Weekly Review substitutes estimates/default durations when actual time is missing, then calls the result “hours of focus.” It offers a reset flow without a durable review artifact. | Distinguish completed task estimates from measured focus time. Save review date, reflection, and next priorities so the review has a useful result. |
| F34 | P2 · D | Many surfaces use 10–12px labels, repeated pills, card borders, headings within headings, and large empty panels. Study tools and workflow vocabulary dominate some general task settings. | Apply one typography/spacing/elevation system and progressive disclosure; keep specialized study features contextual. |
| F35 | P0 · measured | Initial planner CSS and core precache exceed existing budgets. This will fail the intended release verification. | Remove obsolete/duplicated styles, restore lazy feature boundaries, and remeasure. Do not raise limits as the first fix. |
| F36 | P1 · S/G | Existing release evidence predates some of these additions. Docs describe earlier schemas and capability coverage. Passing older hosted tests cannot verify the current working tree. | Produce one current release manifest and rerun its required staging, browser, migration, device, and operational gates. |

Some apparent duplicates are only compatibility adapters: `services/audioEngine` re-exports the existing singleton and `CommandPaletteModal` aliases the existing palette. Do not create churn by treating these as independent engines. Prioritize actual duplicated behavior and user decisions.

## 4. The product shape to build

### First-release promise

FlowTask helps an individual organize responsibilities, choose a realistic day, work with focus, and review progress. Students and developers remain the first audiences, with specialized study functionality available when needed. Enterprise quality means dependable data, coherent interaction, accessible operation, and observable releases in this scope.

The first release should include:

1. **Today:** capture, actionable work, a compact Top 3, capacity, and one route into focus and planning.
2. **Inbox:** triage unorganized tasks with project, date, priority, and Someday actions.
3. **Plan:** one planner with day/multi-day presentations, a shared scheduler, calendar overlay, and usable non-drag editing.
4. **Projects:** outcome, target date, tasks, milestones, notes, and list/board/matrix presentations over the same records.
5. **Notes:** durable project/daily/reference notes with linking, task conversion, versions, export, archive, and recovery.
6. **Life:** Areas, Goals, and a small Routines library connected to real work.
7. **Review:** measured completions/focus, actionable weekly review, and a saved review result.
8. **Focus Studio:** retain the existing environment and lifecycle, with clear start/resume/finish behavior and sensible capability fallbacks.
9. **Settings and Help:** account/saving status, appearance, focused workflow preferences, calendar, backups/recovery, shortcuts, help, and feedback.

Keep Study Hub as an optional tool. Expose Waiting and Deferred through useful filters instead of adding more top-level destinations. Keep All Tasks, Someday, Archive, and Trash available without making them compete with daily work.

**Outside this release:** billing/subscriptions/paywalls; team administration, SSO/SCIM, and collaborative editing; a remote generative-AI service; broad two-way calendar OAuth; a standalone habit analytics suite; and general split-task scheduling. These require separate product promises and operating models. Existing unfinished scaffolding must not be presented as a finished capability.

### Life becomes a working system

An Area is an ongoing responsibility, a Goal is a desired outcome, a Project is a body of work, and a Task is an action. Their screens should explain this through useful content and actions.

- **Area index:** user-owned records, optional starter set added once, explicit edit/archive/reorder, compact attention summaries, and clear drill-down.
- **Area detail:** description, linked goals/projects, upcoming commitments, open work, relevant project notes, and contextual “Add project/task/goal.” Display archived or missing relationships clearly.
- **Goal detail:** measurable success, target date/quarter, Area, linked projects/tasks, status, and progress whose source is visible. Support editing, pausing, achieving, reopening, and archiving.
- **Relationship rules:** Projects have an optional Area; task Area normally inherits from its Project. Avoid contradictory independent defaults. Goals may reference multiple projects. Enforce valid references and safe reassignment on archive/delete.
- **Routines:** create/edit steps and durations, launch a selected routine, pause/resume, skip/back, interruption recovery, and completion history. A template is added explicitly and can be edited.
- **No fabricated ownership:** demonstration Goals stay in templates or an explicitly entered demo workspace. A new real workspace starts with the user's data.

Areas already lost when the current component unmounted cannot be reconstructed from a persistence migration. The fix must prevent future loss and preserve any records already present in workspace storage.

### Fewer competing interaction paths

| Job | Proposed ownership |
|---|---|
| Capture task / note / multiple tasks | One composer and shared parsing/validation command, opened contextually from Today, New, or a shortcut |
| Find or navigate | One command/search surface with grouped result types and useful empty results |
| Local planning assistance | Keep supported local proposals and explicit previews; make it easy to discover through commands without another unexplained header icon |
| Quick notes | Quick entry to a Notes draft; retain an explicitly device-only scratchpad option and explicit import of existing scratchpads |
| Plan a day | One shared planner dialog and scheduling command used by Today, Plan, and assistant actions |
| Focus | One lifecycle, with Studio, mini-player, and optional floating view as presentations of the same session |
| Appearance | One settings destination, with Studio environment controls contextual to Studio |
| Backups | One full-workspace export/restore/recovery implementation with clear differences between cloud sync, browser checkpoints, and downloaded copies |

Do not silently upload existing device-only scratchpad contents when simplifying Notes. Preserve storage/privacy choices and make any conversion explicit.

## 5. Design direction and small-detail specification

Retain FlowTask's warm identity. Make the workspace calmer, more legible, and more consistent with the stronger Focus Studio execution.

### Layout and hierarchy

- A stable desktop sidebar and compact header; one meaningful page title and one primary action per page.
- A consistent content grid, page gutters, form widths, inspector width, and action placement. Avoid a different header/card language in each feature.
- Today prioritizes current work. Empty Top 3 becomes a compact invitation; customization and routine launch are secondary. Backup guidance stays accessible without repeatedly dominating the task area.
- Phone navigation remains Today, Inbox, Add, Plan, More. More should organize destinations rather than reproduce a long desktop rail inside another “More” group.
- Phone planning uses a full-width day view; staged tasks live in a tray. A week can scroll deliberately, while the active day, time labels, and editing controls remain usable.
- Details become a stable side inspector on desktop and a full-height editing surface on phones, with important actions reachable when the keyboard is open.

### Components and tokens

- Standardize a small spacing scale, body/control typography, title sizes, radii, surface elevations, borders, icon weights, and semantic colors.
- Use 14–16px body/control text and approximately 12px secondary metadata. Do not solve crowded layouts by shrinking important controls or relying on 10px essential text.
- Aim for 44px touch targets on phones and comfortable desktop controls; keep icon hit areas independent of icon size. Meet the applicable WCAG target-size and spacing criteria rather than equating every small visible icon with a conformance failure.
- Keep neutral surfaces and amber emphasis. Use status colors consistently and pair them with words/icons. Do not use color or opacity as the only explanation of deferred, blocked, completed, or errored work.
- Keep shadows and filled pills selective. Empty states need an appropriate next action, not multiple nested cards and repeated zero metrics.
- Build reusable page headers, task rows, cards, buttons, fields, filter bars, segmented controls, dialogs, drawers, menus, toasts, and empty/error states.
- Define hover, keyboard focus, active, disabled, loading, saving, saved, error, offline, conflict, and read-only states for the components that need them.

### Wording and behavioral details

Use “Life,” “Goals,” “Plan,” “Quick capture,” and “Start after” where they are clearer than the current specialist labels. Distinguish planned date, deadline, start-after date, and scheduled time explicitly. Use the user's locale consistently for displayed dates, while preserving ISO formats in storage.

Make created/updated records immediately findable. Preserve selection, relevant filters, and scroll position where useful; restore focus after closing an inspector. Do not announce success or play completion feedback before durable saving is established. Show errors beside the action with a retry or safe alternative.

Use restrained, purposeful motion for feedback and spatial continuity. Honor reduced motion; avoid confetti on routine navigation, perpetual bouncing, and surprising audio for ordinary planning. Apply one behavior for Escape, click outside, cancellation, draft preservation, and destructive-action recovery.

### Accessibility and performance bar

Use **WCAG 2.2 AA** as the acceptance target, including keyboard operation, drag alternatives, contrast, programmatic labels, focus visibility/non-obscuration, and target-size requirements with their defined exceptions. Automated axe results are one input; screen-reader and keyboard journeys remain necessary. [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/)

Use Google's good Core Web Vitals thresholds as field targets: **LCP ≤2.5s, INP ≤200ms, CLS ≤0.1 at the 75th percentile**, assessed for mobile and desktop. Lab measurements support development; they are not a substitute for field data. [Google Web Vitals](https://web.dev/articles/vitals)

Map relevant security controls to **OWASP ASVS 5.0**, recording applicable checks and evidence. This is a verification framework, not a certification obtained by passing the repository's security suite. [OWASP ASVS](https://asvs.owasp.org/)

## 6. Development sequence and exit criteria

Effort sizes are relative: S is a contained change, M crosses a few components, L spans a domain and its persistence/integration. They are not delivery-date commitments. Data contracts precede feature completion; release gates apply to the final candidate.

| Phase | Work package | Size | Must be true before closing the phase |
|---|---|---|---|
| **0 — Freeze the release contract** | Inventory visible features, map every action to its command/data owner, agree the V1 scope above, consolidate route metadata, record current schemas and unsupported capabilities. Produce key screen specifications before styling implementation. | M | Every visible capability has an owner, expected result, persistence/sync policy, failure behavior, and acceptance journey. No ambiguous placeholder capability remains in the release surface. |
| **1 — Protect data and unify semantics** | F01–F10: canonical entities/commands/validation, Area/Goal durability, sync/rules, full backup/checkpoint fidelity, Undo, migration, and shared availability/capture behavior. | L | Create/edit/link/archive → navigate → reload → export → restore retains every supported entity. Invalid imports fail safely. Deferred tasks behave consistently. Local/cloud/account transitions preserve data. |
| **2 — Establish the UI system** | Shared tokens/primitives, navigation and route identity, page headers, task-row/inspector patterns, capture/search ownership, empty/loading/error states, mobile shells. Create approved reference implementations for Today, task details, and a Life detail page. | L | Three reference journeys look and behave coherently on desktop and phone, with keyboard operation and no clipped or shrinking controls. No further feature builds use ad hoc primitives. |
| **3 — Complete the connected workflows** | Real Area/Goal detail and lifecycle; editable/resumable routines; shared Plan/Grid scheduling and range loading; reminder reconciliation; Notes/capture consolidation; meaningful saved review results. | L | Each workflow completes from first use to a saved outcome and can be resumed or recovered after interruption. Every visible action has verified success and failure behavior. |
| **4 — Refine the entire surface** | Apply the reference design to Projects, Notes, Study, Review, settings, onboarding, Help, menus, forms, and all supported themes. Fix mobile priorities, content density, terminology, focus behavior, and touch geometry. Remove obsolete styles and unused feature exposure. | L | The same interaction rules hold across sections. No P1 usability defects remain in supported core journeys. First-task and returning-user flows work without configuration overload. CSS and precache return under existing limits. |
| **5 — Qualify the release candidate** | Full pinned-runtime verification, rules emulator, production browser matrix, actual staging cloud acceptance, fault/migration/update rehearsals, device/screen-reader checks, security review, performance measurement, operator readiness, and unfamiliar-user sessions. | L | Evidence belongs to one frozen candidate. Zero P0/P1 defects; remaining P2 issues are explicitly accepted with owners. Rollback and recovery are demonstrated. |
| **6 — Controlled public introduction** | Small invited cohort, observe real failures/support needs, fix regressions, then broaden availability. Carry forward the existing seven-day monitored-beta requirement. | M | At least seven consecutive monitored days on the candidate or its qualifying fixes; no unresolved data-loss incident or critical workflow failure; support and rollback are available. |

Recommended first development slice: **Area + Goal create/edit/link → durable save → navigation/reload → export/restore → Undo**. Complete its storage contract and the new entity sync/rules before promoting it. This slice directly resolves the user's Life-area concern and establishes the pattern for subsequent work.

Do not begin with a repository rewrite or a broad cosmetic reskin. The current architecture contains useful safeguards, and the observed failures come largely from bypassing or incompletely extending them.

## 7. Acceptance journeys for the finished product

| Journey | Required acceptance |
|---|---|
| First useful minute | Fresh visitor enters the planner, creates a real task, sees parsed details, finds it, and starts focus without an account or setup maze. Sample content is clearly optional. |
| Life to daily work | Create Area → Goal → Project → Task; link them; edit from either end; see meaningful summaries; navigate/reload; retain relationships. Archive/reassign safely and Undo. |
| Capture equivalence | Same input through inline capture, composer, quick shortcut, and multiline capture has consistent date/project/priority/duration behavior and respects settings. |
| Realistic planning | Schedule, move, resize, unschedule, lock, and Undo through each presentation. Respect busy events, boundaries, estimates, and capacity. Use keyboard/touch without dragging. |
| Deferred/blocked work | Start-after and dependency changes affect Today, counts, planner proposals, and focus queues consistently. At the correct date/completion, work becomes available once. |
| Focus continuity | Start, pause, navigate, reload, background, sleep/wake, resume, finish early, and finish naturally. Record one session once; no cross-account timer/audio leakage. |
| Routine continuity | Create and edit routine; run/skip/back/pause; close and resume; reload; complete once; show history and restart deliberately. |
| Notes to action | Write/search/link/project-assign; create a task with return context; edit and recover a version; preserve a draft on navigation; export/restore; explain unavailable references. |
| Reminders | Schedule inside and outside 24 hours; edit, snooze, dismiss, complete task, switch workspace, and wake device. Permission denial and unsupported/closed-app limits are understandable. |
| Recovery and portability | Export using every advertised path; import/merge/replace without duplicate or missing entities; restore a checkpoint; reject malformed/future formats; retain originals on failure. |
| Cloud trust | Two isolated staging accounts/devices: sign-in, explicit device import, offline queue, reconnect, conflicting edits, follower-tab handover, logout, account change, account deletion. Every V1 entity is included. |
| Review | Complete tasks and log focus; show correct date-range metrics; distinguish estimated work from measured time; save reflection and next priorities. |
| Accessibility | Keyboard-only core loop, screen-reader labels/announcements, Escape/focus return, 200% text/zoom and reflow checks, reduced motion, touch targets, and drag alternatives. |
| Update and failures | Offline reload after installation; old/new build migration; update deferral during active work; failed save/quota/network states; retry/export; demonstrated rollback. |

Run responsive acceptance at **320, 390, 768, 1024, 1440, and 1920px**, plus phone landscape and real software keyboards. Inspect internal clipping, empty/populated/long-content states, and overlapping events; a zero-document-overflow assertion alone is insufficient.

Test all supported themes for relevant contrast and state coverage. Exercise Chromium, Firefox, and WebKit in a functioning CI environment; retain Windows browser-launch limitations as explicit gaps until verified elsewhere. Include physical iOS Safari and Android Chrome for the public promise.

Usability release target: at least five unfamiliar people from the intended audience attempt the primary journeys with realistic tasks. Record task success, hesitation, wrong turns, and unassisted recovery. Aim for at least 90% completion across the selected core tasks, and resolve every observed critical blocker. This is a proposed product acceptance target, not a result already achieved.

## 8. Launch operations and scope control

Keep one release manifest tying source revision, frontend build, rules version, backend configuration, migrations, and evidence together. Existing October 22/25 reports remain historical evidence; do not reuse their pass counts as sign-off for new features.

Before broad release, verify compatible rules deployment, authentication/account deletion, calendar-proxy configuration where enabled, App Check rollout, content-free diagnostic consent, alert delivery, health checks, data retention, and a documented rollback owner. Confirm support/feedback can reach a real maintained destination without automatically uploading private workspace content.

Provide concise in-product explanations of local saving, cloud delivery, conflicts, recovery checkpoints, downloaded backups, and device-only media. Make Help match the actual controls. Include a small release note/known-limitations surface tied to the public version.

Use one tracked backlog with the finding IDs above, acceptance journeys, dependency, owner, evidence, and status. Close work only when its outcome is demonstrated. Avoid another disconnected feature wave or a new “finished” document that leaves old release gates unresolved.

Billing stays excluded throughout this plan. No payment provider, checkout, subscription, invoice, entitlement, or paywall work is proposed.

## 9. Proposed rollout decision

Proceed with the development sequence after review of this plan. Begin with data integrity and the Life/Goal vertical slice, then apply the shared UI direction and complete the remaining workflows.

Approve public rollout only when the frozen candidate passes its gates and the monitored introduction supports that decision. The current audit is a concrete starting backlog and design direction, not a claim that every feature, security control, or device is already qualified.
